"""Bring the master scene in line with layout v2 and re-render the stills and the fly-in.

The master .blend was built on 2026-09-05 with the first layout (27 plots, bounding-box clearing).
plots.json / road.json / trees.json moved on 2026-09-08 to the parcel-based layout (28 plots).
This script keeps the terrain, textures, water, existing buildings and cameras from the master
scene, and rebuilds only what the layout owns: the trees (kept / cleared), the houses and the roads.

Run:  blender -b --python pipeline/relayout_v2.py -- [--no-anim] [--no-stills]
"""
import bpy
import json
import math
import sys
import time
from pathlib import Path
from mathutils import Vector

KN = Path(r"C:/Users/anwar/Downloads/knotten")
DATA = KN / "data"
REN = KN / "renders"
ANIM = REN / "anim"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DO_STILLS = "--no-stills" not in argv
DO_ANIM = "--no-anim" not in argv
t_start = time.time()

bpy.ops.wm.open_mainfile(filepath=str(KN / "blender" / "knotten_master.blend"))
scn = bpy.context.scene
print("opened master; objects:", len(bpy.data.objects), flush=True)

# the aerial textures were first loaded from a temp folder; point every missing image at the
# copies in source/ (same file names) so the terrain renders with its imagery
import os
for img in bpy.data.images:
    fp = bpy.path.abspath(img.filepath) if img.filepath else ""
    if fp and not os.path.exists(fp):
        alt = KN / "source" / os.path.basename(fp)
        if alt.exists():
            img.filepath = str(alt)
            img.reload()
            print("image repointed:", img.name, "->", alt, flush=True)
        else:
            print("image still missing:", img.name, fp, flush=True)

SPECIES = {
    "spruce": {"color": (0.0115, 0.0225, 0.0105), "layers": 3, "seg": 7, "trunk_frac": 0.26},
    "pine":   {"color": (0.019, 0.032, 0.0125), "layers": 2, "seg": 7, "trunk_frac": 0.42},
    "birch":  {"color": (0.048, 0.072, 0.021), "layers": 2, "seg": 6, "trunk_frac": 0.40},
}


def mesh_object(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    scn.collection.objects.link(ob)
    return ob


def principled(name, rgb, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = (*rgb, 1.0)
    bs.inputs["Roughness"].default_value = roughness
    bs.inputs["Metallic"].default_value = metallic
    return mat


# ------------------------------------------------------------ clear the layout
for ob in list(bpy.data.objects):
    if ob.name.startswith(("Trees_", "plot-", "road-", "Cam_Fly", "Fly_Target")):
        bpy.data.objects.remove(ob, do_unlink=True)
for me in list(bpy.data.meshes):
    if me.users == 0:
        bpy.data.meshes.remove(me)
print("layout objects removed", flush=True)


# ------------------------------------------------------------------- trees
def tree_geometry(x, y, z, h, crown, species, rot, store):
    spec = SPECIES[species]
    seg = spec["seg"]
    base = len(store["v"])
    trunk_h = h * spec["trunk_frac"]
    r_trunk = max(0.06, h * 0.016)
    for k in range(4):
        a = rot + k * math.pi / 2
        store["v"].append((x + math.cos(a) * r_trunk, y + math.sin(a) * r_trunk, z - 0.3))
    for k in range(4):
        a = rot + k * math.pi / 2
        store["v"].append((x + math.cos(a) * r_trunk * 0.7, y + math.sin(a) * r_trunk * 0.7, z + trunk_h))
    for k in range(4):
        store["f"].append((base + k, base + (k + 1) % 4, base + 4 + (k + 1) % 4, base + 4 + k))
    canopy_h = h - trunk_h
    layers = spec["layers"]
    for li in range(layers):
        frac0 = li / layers
        frac1 = (li + 1.35) / layers
        zc0 = z + trunk_h + canopy_h * frac0 * 0.82
        zc1 = min(z + h, z + trunk_h + canopy_h * frac1)
        radius = crown * (1.0 - frac0 * (0.25 if species == "birch" else 0.5))
        ring_start = len(store["v"])
        for k in range(seg):
            a = rot + k * math.tau / seg
            store["v"].append((x + math.cos(a) * radius, y + math.sin(a) * radius, zc0))
        apex = len(store["v"])
        store["v"].append((x, y, zc1))
        for k in range(seg):
            store["f"].append((ring_start + k, ring_start + (k + 1) % seg, apex))
        store["f"].append(tuple(range(ring_start + seg - 1, ring_start - 1, -1)))
    return len(store["v"]) - base


def foliage_material(species):
    name = "Foliage_%s" % species
    if bpy.data.materials.get(name):
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bs = nt.nodes["Principled BSDF"]
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "Col"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    col = SPECIES[species]["color"]
    mix.inputs[6].default_value = (col[0] * 1.05, col[1] * 1.15, col[2] * 0.85, 1.0)
    nt.links.new(attr.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.88
    if "Specular IOR Level" in bs.inputs:
        bs.inputs["Specular IOR Level"].default_value = 0.18
    return mat


def build_tree_set(records, label):
    stores = {k: {"v": [], "f": [], "c": []} for k in SPECIES}
    for t in records:
        s = stores[t["species"]]
        n = tree_geometry(t["x"], t["y"], t["z"], t["h"], t["crown"], t["species"], t["rot"], s)
        s["c"].extend([(t["tint"], t["tint"], t["tint"], 1.0)] * n)
    made = []
    for species, s in stores.items():
        if not s["v"]:
            continue
        ob = mesh_object("Trees_%s_%s" % (label, species), s["v"], s["f"])
        ob.data.materials.append(foliage_material(species))
        ca = ob.data.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
        ca.data.foreach_set("color", [c for rgba in s["c"] for c in rgba])
        made.append(ob)
    return made


trees = json.loads((DATA / "trees.json").read_text(encoding="utf-8"))["trees"]
trees_keep = build_tree_set([t for t in trees if not t["cleared"]], "keep")
trees_clear = build_tree_set([t for t in trees if t["cleared"]], "cleared")
print("trees rebuilt:", len(trees), "cleared:", sum(1 for t in trees if t["cleared"]), round(time.time() - t_start), "s", flush=True)


# ------------------------------------------------------------------ houses
plots = json.loads((DATA / "plots.json").read_text(encoding="utf-8"))["plots"]
# the same three wall colours, roof and glass as site/src/components/scene/Proposal.tsx (sRGB hex -> linear)
def srgb(h):
    r, g, bch = int(h[1:3], 16) / 255, int(h[3:5], 16) / 255, int(h[5:7], 16) / 255
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(bch))
mat_walls = [principled("House_Wall_Lime", srgb("#e6e1d6"), 0.8),
             principled("House_Wall_Tar", srgb("#4a413a"), 0.8),
             principled("House_Wall_Ochre", srgb("#cfc6b6"), 0.8)]
mat_roof = principled("House_Roof_Slate", srgb("#2e353b"), 0.45, 0.15)
mat_pv = principled("House_PV", srgb("#1c2a33"), 0.25, 0.3)
mat_glass = principled("House_Glass", srgb("#1c2a33"), 0.15, 0.6)
mat_terrace = principled("House_Terrace", srgb("#e6e1d6"), 0.8)
house_objs = []


def box(P, u0, u1, v0, v1, z0, z1):
    p = [P(u0, v0, z0), P(u1, v0, z0), P(u1, v1, z0), P(u0, v1, z0), P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)]
    f = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7), (3, 2, 1, 0)]
    return p, f


for i, p in enumerate(plots):
    x, y = p["local"]["x"], p["local"]["y"]
    floor = p["local"]["z_floor"]
    w, d = p["house"]["width_m"], p["house"]["depth_m"]
    eaves, ridge = floor + p["house"]["eaves_m"], floor + p["house"]["ridge_m"]
    ground = floor - p["house"].get("plinth_m", 1.0)     # the terrace plinth on the downhill side
    face = math.radians(p["house"]["facing_deg"])          # the front faces the water
    ca, sa = math.cos(face), math.sin(face)

    def W(u, v, z, x=x, y=y, ca=ca, sa=sa):
        return (x + u * ca + v * sa, y - u * sa + v * ca, z)

    hw, hd = w / 2, d / 2
    bv, bf = box(W, -hw, hw, -hd, hd, ground, eaves)
    ob = mesh_object(p["id"], bv, bf)
    ob.data.materials.append(mat_walls[i % 3])
    house_objs.append(ob)
    gv, gf = box(W, -hw + 0.7, hw - 0.7, hd, hd + 0.08, floor + 0.4, eaves - 0.5)
    gob = mesh_object(p["id"] + "-glass", gv, gf)
    gob.data.materials.append(mat_glass)
    house_objs.append(gob)
    tv, tf = box(W, -hw + 0.6, hw - 0.6, hd, hd + 3.2, floor - 0.35, floor)
    tob = mesh_object(p["id"] + "-terrace", tv, tf)
    tob.data.materials.append(mat_walls[i % 3])
    house_objs.append(tob)
    ov = 0.55
    rv = [W(-hw - ov, -hd - ov, eaves), W(hw + ov, -hd - ov, eaves), W(hw + ov, hd + ov, eaves), W(-hw - ov, hd + ov, eaves), W(-hw - ov, 0.0, ridge), W(hw + ov, 0.0, ridge)]
    rf = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)]
    rob = mesh_object(p["id"] + "-roof", rv, rf)
    rob.data.materials.append(mat_roof)
    rob.data.materials.append(mat_pv)
    rob.data.polygons[1].material_index = 1     # the pitch facing the view carries PV
    house_objs.append(rob)
print("houses rebuilt:", len(plots), flush=True)


# ------------------------------------------------------------------- roads
road = json.loads((DATA / "road.json").read_text(encoding="utf-8"))
mat_road = principled("Road_Asphalt", (0.04, 0.04, 0.042), 0.7)
road_objs = []


def runs(segments):
    out, cur = [], []
    for s in segments:
        if not cur:
            cur = [s["from"], s["to"]]
            continue
        a, b = cur[-1], s["from"]
        if abs(a[0] - b[0]) < 0.05 and abs(a[1] - b[1]) < 0.05:
            cur.append(s["to"])
        else:
            if len(cur) > 1:
                out.append(cur)
            cur = [s["from"], s["to"]]
    if len(cur) > 1:
        out.append(cur)
    return out


for k, run in enumerate(runs(road["segments"])):
    rv, rf = [], []
    for j, pt in enumerate(run):
        px, py, _ = run[max(j - 1, 0)]
        nx, ny, _ = run[min(j + 1, len(run) - 1)]
        dx, dy = nx - px, ny - py
        ln = math.hypot(dx, dy) or 1.0
        ox, oy = -dy / ln * 2.5, dx / ln * 2.5
        rv.append((pt[0] + ox, pt[1] + oy, pt[2] + 0.2))
        rv.append((pt[0] - ox, pt[1] - oy, pt[2] + 0.2))
    for j in range(len(run) - 1):
        a = j * 2
        rf.append((a, a + 1, a + 3, a + 2))
    ob = mesh_object("road-%02d" % (k + 1), rv, rf)
    ob.data.materials.append(mat_road)
    road_objs.append(ob)
print("roads rebuilt:", len(road_objs), flush=True)

for o in bpy.data.objects:
    if o.name.startswith(("web_", "tree_template_")):
        o.hide_render = True

bpy.ops.wm.save_as_mainfile(filepath=str(KN / "blender" / "knotten_master.blend"))
print("SAVED master blend (layout v2)", round(time.time() - t_start), "s", flush=True)


# ----------------------------------------------------------------- renders
def set_state(after):
    for o in trees_clear:
        o.hide_render = after
    for o in house_objs + road_objs:
        o.hide_render = not after


try:
    cp = bpy.context.preferences.addons["cycles"].preferences
    cp.compute_device_type = "OPTIX"
    cp.get_devices_for_type("OPTIX")
    for dev in cp.devices:
        dev.use = (dev.type == "OPTIX")
    scn.cycles.device = "GPU"
    scn.cycles.denoiser = "OPTIX"
    print("GPU:", [dev.name for dev in cp.devices if dev.use], flush=True)
except Exception as exc:
    print("GPU setup failed:", exc, flush=True)
scn.cycles.use_adaptive_sampling = True
scn.cycles.adaptive_min_samples = 16


def render(cam, filename, after, w=1920, h=1080, samples=64):
    set_state(after)
    scn.camera = bpy.data.objects[cam]
    scn.cycles.samples = samples
    scn.render.resolution_x, scn.render.resolution_y = w, h
    scn.render.image_settings.file_format = "PNG"
    scn.render.filepath = str(REN / filename)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("RENDERED", filename, round(time.time() - t0), "s", flush=True)


if DO_STILLS:
    render("Cam_Site", "site_after.png", True)
    render("Cam_Drone", "drone_after.png", True)
    render("Cam_Site", "site_before.png", False)
    render("Cam_Drone", "drone_before.png", False)
    render("Cam_Knoll", "knoll_view_after.png", True)
    render("Cam_Farms", "farms_after.png", True)

if DO_ANIM:
    ANIM.mkdir(parents=True, exist_ok=True)
    for f in ANIM.glob("fly_*.png"):
        f.unlink()

    def ground(x, y):
        dg = bpy.context.evaluated_depsgraph_get()
        hit, loc, *_ = scn.ray_cast(dg, Vector((x, y, 800.0)), Vector((0, 0, -1)))
        return loc.z if hit else 0.0

    FRAMES = 72
    cam_data = bpy.data.cameras.new("Cam_Fly")
    cam_data.lens = 32.0
    cam_data.clip_end = 60000.0
    cam = bpy.data.objects.new("Cam_Fly", cam_data)
    scn.collection.objects.link(cam)
    target = bpy.data.objects.new("Fly_Target", None)
    scn.collection.objects.link(target)
    con = cam.constraints.new("TRACK_TO")
    con.target = target
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    # over the fjord, sweep in over the farms, settle above the field looking down the sea corridor
    path = [
        (1,  (650.0, -1500.0, 520.0), (0.0, -100.0, 40.0)),
        (30, (120.0, -620.0, 300.0), (-20.0, -40.0, 60.0)),
        (55, (-160.0, -260.0, 190.0), (-10.0, 30.0, 70.0)),
        (72, (10.0, 60.0, ground(10.0, 60.0) + 22.0), (40.0, -400.0, 20.0)),
    ]
    for f, loc, tgt in path:
        cam.location = Vector(loc)
        cam.keyframe_insert("location", frame=f)
        target.location = Vector(tgt)
        target.keyframe_insert("location", frame=f)
    set_state(True)
    scn.camera = cam
    scn.frame_start, scn.frame_end = 1, FRAMES
    scn.render.fps = 24
    scn.cycles.samples = 24
    scn.render.resolution_x, scn.render.resolution_y = 1280, 720
    scn.render.image_settings.file_format = "PNG"
    for f in range(1, FRAMES + 1):
        scn.frame_set(f)
        scn.render.filepath = str(ANIM / ("fly_%04d.png" % f))
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        print("FRAME", f, round(time.time() - t0), "s", flush=True)
    scn.sequence_editor_create()
    se = scn.sequence_editor
    strips = se.strips if hasattr(se, "strips") else se.sequences   # Blender 5.x names them strips
    strip = strips.new_image("fly", str(ANIM / "fly_0001.png"), 1, 1)
    for f in range(2, FRAMES + 1):
        strip.elements.append("fly_%04d.png" % f)
    if hasattr(scn.render.image_settings, "media_type"):
        scn.render.image_settings.media_type = "VIDEO"                 # Blender 5.x: video formats sit under media_type
    scn.render.image_settings.file_format = "FFMPEG"
    scn.render.ffmpeg.format = "MPEG4"
    scn.render.ffmpeg.codec = "H264"
    scn.render.ffmpeg.constant_rate_factor = "HIGH"
    scn.render.ffmpeg.ffmpeg_preset = "GOOD"
    scn.render.use_sequencer = True
    scn.render.filepath = str(REN / "knotten_flyin_720p.mp4")
    bpy.ops.render.render(animation=True)
    print("ANIM DONE", flush=True)

print("ALL DONE", round(time.time() - t_start), "s", flush=True)
