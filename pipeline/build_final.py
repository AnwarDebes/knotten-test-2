"""Final Knotten package: master scene + proposed layout + web GLB exports + renders.

Run inside Blender (headless or live). Everything lands in C:/Users/anwar/Downloads/knotten.
"""
import array
import bpy
import json
import math
import runpy
import sys
import time
from pathlib import Path
from mathutils import Vector

SC = Path(r"C:/Users/anwar/AppData/Local/Temp/claude/c--Users-anwar-Downloads-blender-mcp/b13af21a-c1cc-463b-8ceb-aa1e6a01edea/scratchpad")
KN = Path(r"C:/Users/anwar/Downloads/knotten")
WEB = KN / "web" / "models"
TEX = KN / "web" / "textures"
DATA = KN / "data"
REN = KN / "renders"
for d in (WEB, DATA, REN, KN / "blender"):
    d.mkdir(parents=True, exist_ok=True)

DO_RENDER = "--no-render" not in sys.argv
t_start = time.time()

# ------------------------------------------------------------ master scene
ns = runpy.run_path(str(SC / "build_gjedeland_kv.py"))
elev, HALF, RES, STEP = ns["elev"], ns["HALF"], ns["RES"], ns["STEP"]
DTM, SPECIES, trees_kv = ns["DTM"], ns["SPECIES"], ns["trees_kv"]
principled, mesh_object, link, make_camera = ns["principled"], ns["mesh_object"], ns["link"], ns["make_camera"]
sur, hor = ns["sur"], ns["hor"]

plots = json.loads((DATA / "plots.json").read_text(encoding="utf-8"))["plots"]
road = json.loads((DATA / "road.json").read_text(encoding="utf-8"))
clearing = json.loads((DATA / "clearing.json").read_text(encoding="utf-8"))["polygon_local"]
cx0 = min(p[0] for p in clearing); cx1 = max(p[0] for p in clearing)
cy0 = min(p[1] for p in clearing); cy1 = max(p[1] for p in clearing)
GRILLBU = (138.0, 0.0)
scn = bpy.context.scene


def in_clearing(x, y):
    return cx0 <= x <= cx1 and cy0 <= y <= cy1


# ------------------------------------------------------- trees, split in two
for ob in list(bpy.data.objects):
    if ob.name.startswith("Trees_"):
        bpy.data.objects.remove(ob, do_unlink=True)


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
    mat = bpy.data.materials.new("Foliage_%s" % species)
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


tree_records = []
rng = 0
for i, t in enumerate(trees_kv):
    x, y = t["xy"]
    z = elev(x, y)
    if z < 0.45:
        continue
    rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF
    rot = (rng / 0x7FFFFFFF) * math.tau
    tint = 0.34 + (rng % 1000) / 1000.0 * 0.20
    if math.hypot(x - GRILLBU[0], y - GRILLBU[1]) < 8.0:
        continue
    tree_records.append({"id": "tree-%05d" % i, "x": x, "y": y, "z": round(z, 2), "h": t["h"],
                         "crown": t["crown"], "species": t["species"], "rot": round(rot, 4),
                         "tint": round(tint, 3), "cleared": in_clearing(x, y)})
kept = [t for t in tree_records if not t["cleared"]]
cleared = [t for t in tree_records if t["cleared"]]
trees_keep = build_tree_set(kept, "keep")
trees_clear = build_tree_set(cleared, "cleared")
(DATA / "trees.json").write_text(json.dumps({
    "count": len(tree_records), "cleared_count": len(cleared),
    "source": "Kartverket NHM DOM-DTM canopy height model, treetops by local maxima + gap fill",
    "fields": "id, x, y (local m), z (ground, m asl), h (height m), crown (radius m), species, rot (rad), tint, cleared",
    "instancing": "three.js: position (x, z, -y); scale (crown, h, crown) on the unit template; rotateY(rot)",
    "trees": tree_records,
}), encoding="utf-8")

# --------------------------------------------------------- proposed houses
mat_wall = principled("House_Wall", (0.70, 0.68, 0.63), roughness=0.55)
mat_wall_dark = principled("House_Wall_Dark", (0.10, 0.09, 0.085), roughness=0.6)
mat_roof_h = principled("House_Roof", (0.035, 0.037, 0.04), roughness=0.5)
mat_pv = principled("House_PV", (0.02, 0.03, 0.05), roughness=0.15, metallic=0.3)
house_objs = []
for p in plots:
    x, y = p["local"]["x"], p["local"]["y"]
    floor = p["local"]["z_floor"]
    w, d = p["house"]["width_m"], p["house"]["depth_m"]
    eaves, ridge = floor + p["house"]["eaves_m"], floor + p["house"]["ridge_m"]
    ground = floor - 0.6
    face = math.radians(p["house"]["facing_deg"])          # downhill = front
    ca, sa = math.cos(face), math.sin(face)
    # local u along the long side (parallel to contour), v toward the front

    def W(u, v, z):
        # u runs along the contour (long side), v points downhill toward the view
        return (x + u * ca + v * sa, y - u * sa + v * ca, z)

    hw, hd = w / 2, d / 2
    vs = [W(-hw, -hd, ground), W(hw, -hd, ground), W(hw, hd, ground), W(-hw, hd, ground),
          W(-hw, -hd, eaves), W(hw, -hd, eaves), W(hw, hd, eaves), W(-hw, hd, eaves)]
    fs = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)]
    ob = mesh_object(p["id"], vs, fs)
    ob.data.materials.append(mat_wall if p["row"] % 2 else mat_wall_dark)
    ov = 0.45
    rv = [W(-hw - ov, -hd - ov, eaves), W(hw + ov, -hd - ov, eaves),
          W(hw + ov, hd + ov, eaves), W(-hw - ov, hd + ov, eaves),
          W(-hw - ov, 0.0, ridge), W(hw + ov, 0.0, ridge)]
    rf = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)]
    rob = mesh_object(p["id"] + "-roof", rv, rf)
    rob.data.materials.append(mat_roof_h)
    rob.data.materials.append(mat_pv)
    rob.data.polygons[1].material_index = 1     # south-facing pitch carries PV
    house_objs += [ob, rob]

# ---------------------------------------------------------------- roads
mat_road = principled("Road_Asphalt", (0.04, 0.04, 0.042), roughness=0.7)
road_objs = []


def ribbon(pts, width, z_off, name):
    rv, rf = [], []
    for k, (x, y) in enumerate(pts):
        px_, py_ = pts[max(k - 1, 0)]
        nx_, ny_ = pts[min(k + 1, len(pts) - 1)]
        dx, dy = nx_ - px_, ny_ - py_
        ln = math.hypot(dx, dy) or 1.0
        ox, oy = -dy / ln * width / 2, dx / ln * width / 2
        for sx, sy in ((x + ox, y + oy), (x - ox, y - oy)):
            rv.append((sx, sy, elev(sx, sy) + z_off))
    for k in range(len(pts) - 1):
        a = k * 2
        rf.append((a, a + 1, a + 3, a + 2))
    if not rf:
        return None
    ob = mesh_object(name, rv, rf)
    ob.data.materials.append(mat_road)
    return ob


for rr in road["rows"]:
    ob = ribbon(rr["pts"], 5.0, 0.2, "road-row-%d" % rr["row"])
    if ob:
        road_objs.append(ob)
for i, rp in enumerate(road["ramps"]):
    ob = ribbon(rp["pts"], 5.0, 0.2, "road-ramp-%d" % (i + 1))
    if ob:
        road_objs.append(ob)

# --------------------------------------------------------------- web meshes
def textured_material(name, jpg):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bs = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(TEX / jpg), check_existing=True)
    nt.links.new(tex.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in bs.inputs:
        bs.inputs["Specular IOR Level"].default_value = 0.0
    return mat


def grid_mesh(name, half, n, zfunc, hole_half=None, z_off=0.0, mat=None):
    verts, faces = [], []
    step = 2 * half / (n - 1)
    for j in range(n):
        y = half - j * step
        for i in range(n):
            x = -half + i * step
            verts.append((x, y, zfunc(x, y) + z_off))
    for j in range(n - 1):
        for i in range(n - 1):
            a = j * n + i
            quad = (a, a + 1, a + n + 1, a + n)
            if hole_half is not None and all(abs(verts[k][0]) < hole_half and abs(verts[k][1]) < hole_half for k in quad):
                continue
            faces.append(quad)
    ob = mesh_object(name, verts, faces, smooth=True)
    uv = ob.data.uv_layers.new(name="UVMap")
    flat = []
    for poly in ob.data.polygons:
        for vi in poly.vertices:
            j, i = divmod(vi, n)
            flat.extend((i / (n - 1), 1.0 - j / (n - 1)))
    uv.data.foreach_set("uv", flat)
    if mat:
        ob.data.materials.append(mat)
    ob.hide_render = True
    ob.hide_viewport = True
    return ob


sample_sur = ns["SGRID"]
SW, SHALF = ns["SW"], ns["SHALF"]
HGRID, HW, HHALF = ns["HGRID"], ns["HW"], ns["HHALF"]


def sur_elev(x, y):
    fx = (x + SHALF) / (2 * SHALF) * (SW - 1)
    fy = (SHALF - y) / (2 * SHALF) * (SW - 1)
    i, j = min(SW - 2, max(0, int(fx))), min(SW - 2, max(0, int(fy)))
    tx, ty = fx - i, fy - j
    r0, r1 = sample_sur[j], sample_sur[j + 1]
    a = r0[i] + (r0[i + 1] - r0[i]) * tx
    b = r1[i] + (r1[i + 1] - r1[i]) * tx
    return max(0.0, a + (b - a) * ty)


def hor_elev(x, y):
    fx = (x + HHALF) / (2 * HHALF) * (HW - 1)
    fy = (HHALF - y) / (2 * HHALF) * (HW - 1)
    i, j = min(HW - 2, max(0, int(fx))), min(HW - 2, max(0, int(fy)))
    tx, ty = fx - i, fy - j
    r0, r1 = HGRID[j], HGRID[j + 1]
    a = r0[i] + (r0[i + 1] - r0[i]) * tx
    b = r1[i] + (r1[i + 1] - r1[i]) * tx
    return max(0.0, a + (b - a) * ty)


web_site = grid_mesh("web_site_terrain", 350.0, 351, lambda x, y: max(elev(x, y), 0.0),
                     mat=textured_material("Web_Site", "site_aerial.jpg"))
web_context = grid_mesh("web_context_terrain", HALF, 201, lambda x, y: max(elev(x, y), 0.0),
                        hole_half=345.0, z_off=-0.3, mat=textured_material("Web_Context", "context_aerial.jpg"))
web_surround = grid_mesh("web_surround_terrain", SHALF, 161, sur_elev, hole_half=495.0, z_off=-1.5,
                         mat=textured_material("Web_Surround", "surround_aerial.jpg"))
web_horizon = grid_mesh("web_horizon_terrain", HHALF, 121, hor_elev, hole_half=3980.0, z_off=-3.0,
                        mat=textured_material("Web_Horizon", "horizon_aerial.jpg"))
web_sea = mesh_object("web_sea", [(-HHALF, -HHALF, 0.0), (HHALF, -HHALF, 0.0), (HHALF, HHALF, 0.0), (-HHALF, HHALF, 0.0)], [(0, 1, 2, 3)])
web_sea.data.materials.append(principled("Web_Sea", (0.012, 0.030, 0.045), roughness=0.1))
web_sea.hide_render = True

# river at 4 m cells
wv, wf, widx = [], [], {}
S4 = 4
def wv_(i, j):
    if (i, j) not in widx:
        widx[(i, j)] = len(wv)
        wv.append((-HALF + i * STEP, HALF - j * STEP, 0.45))
    return widx[(i, j)]
for j in range(0, RES - S4, S4):
    for i in range(0, RES - S4, S4):
        if all(DTM[(j + dj) * RES + i + di] < -0.1 for dj in (0, S4) for di in (0, S4)):
            wf.append((wv_(i, j), wv_(i + S4, j), wv_(i + S4, j + S4), wv_(i, j + S4)))
web_water = mesh_object("web_water_river", wv, wf)
web_water.data.materials.append(principled("Web_River", (0.05, 0.032, 0.028), roughness=0.25))
web_water.hide_render = True

# unit tree templates: height 1, crown radius 1 at origin
templates = []
for species in SPECIES:
    s = {"v": [], "f": [], "c": []}
    n = tree_geometry(0.0, 0.0, 0.3, 1.0, 1.0, species, 0.0, s)
    ob = mesh_object("tree_template_%s" % species, s["v"], s["f"])
    ob.data.materials.append(foliage_material(species))
    ob.hide_render = True
    templates.append(ob)

# ---------------------------------------------------------------- exports
def export(objs, filename):
    for ob in bpy.data.objects:
        ob.select_set(False)
    for ob in objs:
        ob.hide_viewport = False
        ob.hide_set(False)
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = str(WEB / filename)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
              export_image_format="AUTO", export_yup=True)
    try:
        bpy.ops.export_scene.gltf(**kw, export_draco_mesh_compression_enable=True,
                                  export_draco_mesh_compression_level=6)
    except Exception as exc:
        print("draco export failed, retrying plain:", exc)
        bpy.ops.export_scene.gltf(**kw)
    for ob in objs:
        ob.select_set(False)
    return round(Path(path).stat().st_size / 1e6, 2)


existing = [o for o in bpy.data.objects if o.name.startswith(("Building_", "Roof_"))]
power = [o for o in bpy.data.objects if o.name.startswith("Power")]
sizes = {
    "site_terrain.glb": export([web_site], "site_terrain.glb"),
    "context_terrain.glb": export([web_context], "context_terrain.glb"),
    "surround_terrain.glb": export([web_surround], "surround_terrain.glb"),
    "horizon_terrain.glb": export([web_horizon], "horizon_terrain.glb"),
    "sea.glb": export([web_sea], "sea.glb"),
    "river.glb": export([web_water], "river.glb"),
    "existing_buildings.glb": export(existing, "existing_buildings.glb"),
    "powerlines.glb": export(power, "powerlines.glb") if power else 0,
    "houses_proposed.glb": export(house_objs, "houses_proposed.glb"),
    "roads_proposed.glb": export(road_objs, "roads_proposed.glb"),
}
for ob in templates:
    sizes["tree_%s.glb" % ob.name.split("_")[-1]] = export([ob], "tree_%s.glb" % ob.name.split("_")[-1])
for ob in (web_site, web_context, web_surround, web_horizon, web_sea, web_water, *templates):
    ob.hide_viewport = True
    ob.hide_render = True

(WEB / "manifest.json").write_text(json.dumps({
    "units": "metres; glTF is Y-up: three.js x = east, y = up (m above sea level), z = -north",
    "origin": {"lat": 58.068057, "lon": 7.278401, "note": "local (0,0) = this point; sea level = y 0"},
    "layers": {
        "site_terrain.glb": "±350 m, 2 m grid, Kartverket 1 m LiDAR, site_aerial.jpg",
        "context_terrain.glb": "±500 m, 5 m grid with hole under site, context_aerial.jpg",
        "surround_terrain.glb": "±4 km, 50 m grid with hole under context",
        "horizon_terrain.glb": "±15 km, 250 m grid with hole under surround",
        "sea.glb": "flat sheet at 0 m across 30 km",
        "river.glb": "Audna surface at 0.45 m, from LiDAR no-return cells",
        "existing_buildings.glb": "71 OSM footprints with LiDAR roof profiles, names = OSM type",
        "powerlines.glb": "poles + wires from OSM power=line",
        "houses_proposed.glb": "provisional plan: objects plot-NN and plot-NN-roof (roof slot 1 = PV side)",
        "roads_proposed.glb": "road-row-N (contour, level) and road-ramp-N (placeholder)",
        "tree_spruce.glb / tree_pine.glb / tree_birch.glb": "unit templates for instancing with data/trees.json",
    },
    "file_sizes_mb": sizes,
}, indent=1), encoding="utf-8")
print("EXPORTED", json.dumps(sizes))

# ------------------------------------------------------------------ cameras
dg = bpy.context.evaluated_depsgraph_get()
cam_knoll = bpy.data.objects["Cam_Knoll"]
kz = elev(10.0, 80.0) + 5.0
cam_knoll.location = Vector((10.0, 80.0, kz))
tgt = Vector((10.0 + 3000 * math.sin(math.radians(174.0)), 80.0 + 3000 * math.cos(math.radians(174.0)), 0.0))
cam_knoll.rotation_euler = (tgt - cam_knoll.location).to_track_quat("-Z", "Y").to_euler()
cam_knoll.data.lens = 30.0
cam_g = bpy.data.objects["Cam_Grillbu"]
cam_g.location = Vector((GRILLBU[0], GRILLBU[1], elev(*GRILLBU) + 1.7))
tgt = Vector((GRILLBU[0] + 900 * math.sin(math.radians(150.0)), GRILLBU[1] + 900 * math.cos(math.radians(150.0)), 0.0))
cam_g.rotation_euler = (tgt - cam_g.location).to_track_quat("-Z", "Y").to_euler()
cam_g.data.lens = 24.0
cam_site = make_camera("Cam_Site", (-60.0, -330.0, elev(-60.0, -330.0) + 260.0),
                       (-10.0, 10.0, elev(-10.0, 10.0)), 40.0)
plan_cam_data = bpy.data.cameras.new("Cam_Plan")
plan_cam_data.type = "ORTHO"
plan_cam_data.ortho_scale = 520.0
plan_cam_data.clip_end = 5000.0
cam_plan = link(bpy.data.objects.new("Cam_Plan", plan_cam_data))
cam_plan.location = Vector((-10.0, 0.0, 600.0))
cam_plan.rotation_euler = (0.0, 0.0, 0.0)

# ------------------------------------------------------------------ save
bpy.ops.wm.save_as_mainfile(filepath=str(KN / "blender" / "knotten_master.blend"))
print("SAVED master blend")

# ---------------------------------------------------------------- renders
def set_state(after):
    for ob in trees_clear:
        ob.hide_render = after
    for ob in house_objs + road_objs:
        ob.hide_render = not after


def render(cam_name, filename, after, w=1920, h=1080, samples=64):
    set_state(after)
    scn.camera = bpy.data.objects[cam_name]
    scn.cycles.samples = samples
    scn.render.resolution_x, scn.render.resolution_y = w, h
    scn.render.filepath = str(REN / filename)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("RENDERED", filename, round(time.time() - t0), "s")


if DO_RENDER:
    try:
        cp = bpy.context.preferences.addons["cycles"].preferences
        cp.compute_device_type = "OPTIX"
        cp.get_devices_for_type("OPTIX")
        for d in cp.devices:
            d.use = (d.type == "OPTIX")
        scn.cycles.device = "GPU"
        scn.cycles.denoiser = "OPTIX"
    except Exception as exc:
        print("GPU setup failed:", exc)
    render("Cam_Site", "site_before.png", False)
    render("Cam_Site", "site_after.png", True)
    render("Cam_Drone", "drone_before.png", False)
    render("Cam_Drone", "drone_after.png", True)
    render("Cam_Knoll", "knoll_view_after.png", True)
    render("Cam_Grillbu", "grillbu_photo_match.png", False, 1600, 1200)
    render("Cam_Farms", "farms_after.png", True)
    render("Cam_Plan", "plan_topdown_after.png", True, 2048, 2048)
    render("Cam_Plan", "plan_topdown_before.png", False, 2048, 2048)
set_state(True)
print("ALL DONE", round(time.time() - t_start), "s")
