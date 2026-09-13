"""Gjedeland, Vigeland (Lindesnes, Agder) - 58.068057, 7.278401 - from measured data only.

  terrain  Kartverket NHM DTM 1 m (national LiDAR), resampled onto the scene axes
  roofs    Kartverket NHM DOM 1 m surface model, clipped to OSM footprints
  trees    33.8k treetops found in the canopy height model (DOM - DTM), real heights
  colour   Esri World Imagery z18 aerial mosaic, 0.32 m/px, mapped 1:1
  vector   OpenStreetMap footprints, roads, power lines
  horizon  8 x 8 km terrarium DEM + z14 imagery ring
  sun      NOAA solar position for the site, 2026-09-04 16:30 CEST
"""
import array
import bpy
import bmesh
import json
import math
import mathutils
from pathlib import Path
from mathutils import Vector

DATA = Path(r"C:/Users/anwar/AppData/Local/Temp/claude/c--Users-anwar-Downloads-blender-mcp/b13af21a-c1cc-463b-8ceb-aa1e6a01edea/scratchpad")
meta = json.loads((DATA / "area_meta.json").read_text(encoding="utf-8"))
scene_data = json.loads((DATA / "scene_data.json").read_text(encoding="utf-8"))
tinfo = json.loads((DATA / "kv_terrain.json").read_text(encoding="utf-8"))
trees_kv = json.loads((DATA / "kv_trees.json").read_text(encoding="utf-8"))["trees"]
roofs_kv = json.loads((DATA / "kv_roofs.json").read_text(encoding="utf-8"))["roofs"]
sur = json.loads((DATA / "surround_elevation.json").read_text(encoding="utf-8"))
hor = json.loads((DATA / "horizon_elevation.json").read_text(encoding="utf-8"))

HALF = meta["size_m"][0] / 2.0
RES = tinfo["res"]
STEP = tinfo["step_m"]
WATER_MARK = -0.6          # cells where LiDAR found no ground return = river
WATER_LEVEL = 0.45

DTM = array.array("f")
DTM.fromfile(open(DATA / "kv_terrain.f32", "rb"), RES * RES)


def elev(x, y):
    """Bilinear bare-earth elevation (absolute metres) at scene x=east, y=north."""
    fx = min(max((x + HALF) / STEP, 0.0), RES - 1.001)
    fy = min(max((HALF - y) / STEP, 0.0), RES - 1.001)
    i, j = int(fx), int(fy)
    tx, ty = fx - i, fy - j
    r0 = j * RES + i
    r1 = r0 + RES
    v00, v10, v01, v11 = DTM[r0], DTM[r0 + 1], DTM[r1], DTM[r1 + 1]
    a = v00 + (v10 - v00) * tx
    b = v01 + (v11 - v01) * tx
    return a + (b - a) * ty


# ------------------------------------------------------------- clean slate
if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras,
             bpy.data.curves, bpy.data.images, bpy.data.node_groups):
    for block in list(coll):
        if block.users == 0:
            coll.remove(block)


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mesh_object(name, verts, faces, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    if smooth and me.polygons:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    return link(bpy.data.objects.new(name, me))


def principled(name, color, roughness=0.8, **kw):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    b.inputs["Roughness"].default_value = roughness
    for k, v in kw.items():
        key = {"ior": "IOR"}.get(k, k.replace("_", " ").title())
        if key in b.inputs:
            b.inputs[key].default_value = v
    return mat


# ------------------------------------------------- terrain (Kartverket 1 m)
verts, faces = [], []
for j in range(RES):
    y = HALF - j * STEP
    row = j * RES
    for i in range(RES):
        verts.append((-HALF + i * STEP, y, DTM[row + i]))
for j in range(RES - 1):
    base = j * RES
    for i in range(RES - 1):
        a = base + i
        faces.append((a, a + 1, a + RES + 1, a + RES))
terrain = mesh_object("Terrain_LiDAR", verts, faces, smooth=True)
me = terrain.data

uv = me.uv_layers.new(name="UVMap")
uvflat = []
for poly in me.polygons:
    for vi in poly.vertices:
        j, i = divmod(vi, RES)
        uvflat.extend((i / (RES - 1), 1.0 - j / (RES - 1)))
uv.data.foreach_set("uv", uvflat)

# solid skirt so the sample reads as a block of ground
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()
border = ([j * RES for j in range(RES)]
          + [(RES - 1) * RES + i for i in range(1, RES)]
          + [j * RES + (RES - 1) for j in range(RES - 2, -1, -1)]
          + [i for i in range(RES - 2, 0, -1)])
rim = [bm.verts[vi] for vi in border]
skirt = [bm.verts.new((v.co.x, v.co.y, -60.0)) for v in rim]
bm.verts.ensure_lookup_table()
for k in range(len(rim)):
    nk = (k + 1) % len(rim)
    bm.faces.new((rim[k], rim[nk], skirt[nk], skirt[k]))
bm.faces.new(list(reversed(skirt)))
bm.to_mesh(me)
bm.free()

aerial = bpy.data.images.load(str(DATA / "satellite.png"), check_existing=True)
mat_ground = bpy.data.materials.new("Ground_Aerial")
mat_ground.use_nodes = True
nt = mat_ground.node_tree
bsdf = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = aerial
tex.interpolation = "Cubic"
tex.extension = "EXTEND"
hsv = nt.nodes.new("ShaderNodeHueSaturation")
hsv.inputs["Saturation"].default_value = 1.4
hsv.inputs["Value"].default_value = 0.70
nt.links.new(tex.outputs["Color"], hsv.inputs["Color"])
nt.links.new(hsv.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.96
if "Specular IOR Level" in bsdf.inputs:
    bsdf.inputs["Specular IOR Level"].default_value = 0.18
me.materials.append(mat_ground)
me.materials.append(principled("Bedrock", (0.09, 0.075, 0.065), roughness=0.95))
surface_faces = (RES - 1) * (RES - 1)
for p in me.polygons[surface_faces:]:
    p.material_index = 1

# ------------------------------------------------------- surrounding land
SW, SH = sur["width"], sur["height"]
SHALF = sur["half_m"]
SGRID = sur["rows_north_to_south"]
SDX = (2 * SHALF) / (SW - 1)
SDY = (2 * SHALF) / (SH - 1)
sv, sf = [], []
for j in range(SH):
    y = SHALF - j * SDY
    row = SGRID[j]
    for i in range(SW):
        sv.append((-SHALF + i * SDX, y, row[i] - 1.5))
for j in range(SH - 1):
    for i in range(SW - 1):
        a = j * SW + i
        quad = (a, a + 1, a + SW + 1, a + SW)
        if all(abs(sv[k][0]) <= HALF and abs(sv[k][1]) <= HALF for k in quad):
            continue
        sf.append(quad)
surround_ob = mesh_object("Surroundings", sv, sf, smooth=True)
sme = surround_ob.data
suvl = sme.uv_layers.new(name="UVMap")
uvflat = []
for poly in sme.polygons:
    for vi in poly.vertices:
        j, i = divmod(vi, SW)
        uvflat.extend((i / (SW - 1), 1.0 - j / (SH - 1)))
suvl.data.foreach_set("uv", uvflat)

sur_img = bpy.data.images.load(str(DATA / "surround_satellite.png"), check_existing=True)
mat_sur = bpy.data.materials.new("Ground_Surroundings")
mat_sur.use_nodes = True
snt = mat_sur.node_tree
sb = snt.nodes["Principled BSDF"]
stex = snt.nodes.new("ShaderNodeTexImage")
stex.image = sur_img
stex.interpolation = "Cubic"
stex.extension = "EXTEND"
shsv = snt.nodes.new("ShaderNodeHueSaturation")
shsv.inputs["Saturation"].default_value = 1.4
shsv.inputs["Value"].default_value = 0.70
snt.links.new(stex.outputs["Color"], shsv.inputs["Color"])
snt.links.new(shsv.outputs["Color"], sb.inputs["Base Color"])
sb.inputs["Roughness"].default_value = 0.97
if "Specular IOR Level" in sb.inputs:
    sb.inputs["Specular IOR Level"].default_value = 0.15
sme.materials.append(mat_sur)

# --------------------------------------------------- 30 km horizon ring
HW, HH = hor["width"], hor["height"]
HHALF = hor["half_m"]
HGRID = hor["rows_north_to_south"]
HDX = (2 * HHALF) / (HW - 1)
HDY = (2 * HHALF) / (HH - 1)
hv, hf = [], []
for j in range(HH):
    y = HHALF - j * HDY
    row = HGRID[j]
    for i in range(HW):
        hv.append((-HHALF + i * HDX, y, max(row[i], 0.0) - 3.0))
for j in range(HH - 1):
    for i in range(HW - 1):
        a = j * HW + i
        quad = (a, a + 1, a + HW + 1, a + HW)
        if all(abs(hv[k][0]) <= SHALF and abs(hv[k][1]) <= SHALF for k in quad):
            continue
        hf.append(quad)
horizon_ob = mesh_object("Horizon_30km", hv, hf, smooth=True)
hme = horizon_ob.data
huvl = hme.uv_layers.new(name="UVMap")
uvflat = []
for poly in hme.polygons:
    for vi in poly.vertices:
        j, i = divmod(vi, HW)
        uvflat.extend((i / (HW - 1), 1.0 - j / (HH - 1)))
huvl.data.foreach_set("uv", uvflat)
hor_img = bpy.data.images.load(str(DATA / "horizon_satellite.png"), check_existing=True)
mat_hor = bpy.data.materials.new("Ground_Horizon")
mat_hor.use_nodes = True
hnt = mat_hor.node_tree
hb = hnt.nodes["Principled BSDF"]
htex = hnt.nodes.new("ShaderNodeTexImage")
htex.image = hor_img
htex.interpolation = "Cubic"
htex.extension = "EXTEND"
hhsv = hnt.nodes.new("ShaderNodeHueSaturation")
hhsv.inputs["Saturation"].default_value = 1.3
hhsv.inputs["Value"].default_value = 0.72
hnt.links.new(htex.outputs["Color"], hhsv.inputs["Color"])
hnt.links.new(hhsv.outputs["Color"], hb.inputs["Base Color"])
hb.inputs["Roughness"].default_value = 0.97
if "Specular IOR Level" in hb.inputs:
    hb.inputs["Specular IOR Level"].default_value = 0.12
hme.materials.append(mat_hor)

# the sea: one flat sheet at 0 m across the whole horizon, under the land
mat_sea = principled("Sea", (0.012, 0.030, 0.045), roughness=0.08, ior=1.333)
sea = mesh_object("Sea", [(-HHALF, -HHALF, 0.0), (HHALF, -HHALF, 0.0),
                          (HHALF, HHALF, 0.0), (-HHALF, HHALF, 0.0)], [(0, 1, 2, 3)])
sea.data.materials.append(mat_sea)

# ------------------------------------ water: exactly where LiDAR saw no ground
mat_water = principled("Water_Audna", (0.050, 0.032, 0.028), roughness=0.28,
                       ior=1.333, transmission_weight=0.0)
wv, wf = [], []
windex = {}


def wvert(i, j):
    key = (i, j)
    if key not in windex:
        windex[key] = len(wv)
        wv.append((-HALF + i * STEP, HALF - j * STEP, WATER_LEVEL))
    return windex[key]


for j in range(RES - 1):
    row = j * RES
    for i in range(RES - 1):
        if (DTM[row + i] < -0.1 and DTM[row + i + 1] < -0.1
                and DTM[row + RES + i] < -0.1 and DTM[row + RES + i + 1] < -0.1):
            wf.append((wvert(i, j), wvert(i + 1, j), wvert(i + 1, j + 1), wvert(i, j + 1)))
water_ob = mesh_object("Water_Audna", wv, wf)
water_ob.data.materials.append(mat_water)
wuv = water_ob.data.uv_layers.new(name="UVMap")
uvw = []
for poly in water_ob.data.polygons:
    for vi in poly.vertices:
        vx, vy, _vz = wv[vi]
        uvw.extend(((vx + HALF) / (2 * HALF), (vy + HALF) / (2 * HALF)))
wuv.data.foreach_set("uv", uvw)

wnt = mat_water.node_tree
wb = wnt.nodes["Principled BSDF"]
wtex = wnt.nodes.new("ShaderNodeTexImage")
wtex.image = aerial
wtex.interpolation = "Cubic"
wtex.extension = "EXTEND"
whsv = wnt.nodes.new("ShaderNodeHueSaturation")
whsv.inputs["Saturation"].default_value = 1.3
whsv.inputs["Value"].default_value = 0.62
wnt.links.new(wtex.outputs["Color"], whsv.inputs["Color"])
wnt.links.new(whsv.outputs["Color"], wb.inputs["Base Color"])
if "Specular IOR Level" in wb.inputs:
    wb.inputs["Specular IOR Level"].default_value = 0.32
wb.inputs["Roughness"].default_value = 0.22
rcoord = wnt.nodes.new("ShaderNodeTexCoord")
swell = wnt.nodes.new("ShaderNodeTexNoise")
swell.inputs["Scale"].default_value = 0.09
swell.inputs["Detail"].default_value = 2.0
sbump = wnt.nodes.new("ShaderNodeBump")
sbump.inputs["Strength"].default_value = 0.3
sbump.inputs["Distance"].default_value = 0.4
wnt.links.new(rcoord.outputs["Object"], swell.inputs["Vector"])
wnt.links.new(swell.outputs["Fac"], sbump.inputs["Height"])
wnt.links.new(sbump.outputs["Normal"], wb.inputs["Normal"])

# ----------------------------------------- buildings: roof profile from LiDAR
# A roof is a swept plane pair, not a noisy height raster. So: take the surface model
# inside each footprint, express it in the footprint's own axes, reduce it to a median
# cross-section, and sweep that profile along the ridge. Pitch, ridge height and eaves
# height are all measured; only the noise is discarded.
wall_white = principled("Wall_White", (0.62, 0.60, 0.56), roughness=0.55)
wall_red = principled("Wall_FaluRed", (0.155, 0.030, 0.022), roughness=0.62)
wall_ochre = principled("Wall_Ochre", (0.30, 0.19, 0.085), roughness=0.62)
wall_grey = principled("Wall_Grey", (0.24, 0.235, 0.22), roughness=0.6)
roof_cache = {}
built = 0
roof_faces_total = 0


def convex_hull(points):
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lo = []
    for q in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0:
            lo.pop()
        lo.append(q)
    up = []
    for q in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0:
            up.pop()
        up.append(q)
    return lo[:-1] + up[:-1]


def oriented_box(ring):
    hull = convex_hull([tuple(p) for p in ring])
    if len(hull) < 3:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2,
                max(max(xs) - min(xs), 1.0), max(max(ys) - min(ys), 1.0), 0.0)
    best = None
    for k in range(len(hull)):
        x1, y1 = hull[k]
        x2, y2 = hull[(k + 1) % len(hull)]
        ang = math.atan2(y2 - y1, x2 - x1)
        ca, sa = math.cos(-ang), math.sin(-ang)
        us = [q[0] * ca - q[1] * sa for q in hull]
        vs = [q[0] * sa + q[1] * ca for q in hull]
        w, d = max(us) - min(us), max(vs) - min(vs)
        if best is None or w * d < best[0]:
            uc, vc = (min(us) + max(us)) / 2, (min(vs) + max(vs)) / 2
            cb, sb = math.cos(ang), math.sin(ang)
            best = (w * d, uc * cb - vc * sb, uc * sb + vc * cb, w, d, ang)
    _, cx, cy, w, d, ang = best
    if w < d:
        w, d = d, w
        ang += math.pi / 2
    return cx, cy, w, d, ang


for rf in roofs_kv:
    ring = rf["ring"]
    gx, gy = rf["gx"], rf["gy"]
    H = rf["heights"]
    ground = rf["ground"] - 0.4
    eaves, ridge = rf["eaves"], rf["ridge"]
    if ridge - ground < 1.6 or gx < 2 or gy < 2:
        continue

    cx, cy, w, d, ang = oriented_box(ring)
    ca, sa = math.cos(-ang), math.sin(-ang)
    dxg = (rf["x1"] - rf["x0"]) / (gx - 1)
    dyg = (rf["y1"] - rf["y0"]) / (gy - 1)

    # median height per band across the short axis
    bands = max(3, min(15, int(round(d))))
    buckets = [[] for _ in range(bands)]
    for j in range(gy):
        for i in range(gx):
            v = H[j][i]
            if v is None or v < eaves - 1.5 or v > ridge + 1.0:
                continue
            px = rf["x0"] + i * dxg - cx
            py = rf["y0"] + j * dyg - cy
            lv = px * sa + py * ca
            b = int((lv + d / 2) / d * bands)
            if 0 <= b < bands:
                buckets[b].append(v)
    profile = []
    for b in range(bands):
        vals = sorted(buckets[b])
        profile.append(vals[len(vals) // 2] if vals else None)
    known = [v for v in profile if v is not None]
    if len(known) < 2:
        continue
    for b in range(bands):                       # fill empty bands from neighbours
        if profile[b] is None:
            left = next((profile[k] for k in range(b, -1, -1) if profile[k] is not None), None)
            right = next((profile[k] for k in range(b, bands) if profile[k] is not None), None)
            profile[b] = left if left is not None else right
    if bands >= 3:                               # 3-tap median smooth
        sm = list(profile)
        for b in range(1, bands - 1):
            sm[b] = sorted(profile[b - 1:b + 2])[1]
        profile = sm

    OVER = 0.45                                  # eaves overhang
    cb, sb = math.cos(ang), math.sin(ang)

    def world(u, v, z):
        return (cx + u * cb - v * sb, cy + u * sb + v * cb, z)

    rv, rfaces = [], []
    half_u = w / 2 + OVER
    for b in range(bands):
        v = -d / 2 + (b + 0.5) / bands * d
        v = max(-d / 2 - OVER, min(d / 2 + OVER, v * (1 + 2 * OVER / d)))
        z = profile[b]
        rv.append(world(-half_u, v, z))
        rv.append(world(half_u, v, z))
    for b in range(bands - 1):
        a = b * 2
        rfaces.append((a, a + 1, a + 3, a + 2))
    # close the two gable ends down to eaves level so there is no gap over the wall
    lowest = min(profile)
    for side, idx0 in ((0, 0), (1, 1)):
        pass
    cap_start = len(rv)
    for b in range(bands):
        v = -d / 2 + (b + 0.5) / bands * d
        v = max(-d / 2 - OVER, min(d / 2 + OVER, v * (1 + 2 * OVER / d)))
        rv.append(world(-half_u, v, lowest - 0.25))
        rv.append(world(half_u, v, lowest - 0.25))
    for b in range(bands - 1):
        a = b * 2
        c = cap_start + b * 2
        rfaces.append((a, c, c + 2, a + 2))          # left gable face
        rfaces.append((a + 1, a + 3, c + 3, c + 1))  # right gable face
    rfaces.append((0, 1, cap_start + 1, cap_start))
    last = (bands - 1) * 2
    rfaces.append((last + 1, last, cap_start + last, cap_start + last + 1))

    src = rf["roof_rgb"] or (0.05, 0.05, 0.05)
    key = tuple(round(c * 0.62, 4) for c in src)
    if key not in roof_cache:
        roof_cache[key] = principled("Roof_%03d" % len(roof_cache), key, roughness=0.62)
    ob = mesh_object("Roof_%s" % rf["type"], rv, rfaces)
    ob.data.materials.append(roof_cache[key])
    roof_faces_total += len(rfaces)

    wall = (wall_red if rf.get("roof_reddish") and rf["type"] in ("barn", "farm", "farm_auxiliary")
            else wall_white if rf.get("roof_bright") or rf["type"] in ("house", "civic", "kindergarten")
            else wall_ochre if rf["type"] in ("garage", "garages", "shed") else wall_grey)
    n = len(ring)
    wall_top = max(lowest - 0.2, ground + 1.0)
    wv2 = [(x, y, ground) for x, y in ring] + [(x, y, wall_top) for x, y in ring]
    wf2 = [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    wob = mesh_object("Building_%s" % rf["type"], wv2, wf2)
    wob.data.materials.append(wall)
    built += 1

# ------------------------------------------- trees with LiDAR-measured heights
SPECIES = {
    "spruce": {"color": (0.0115, 0.0225, 0.0105), "layers": 3, "seg": 7, "trunk_frac": 0.26},
    "pine":   {"color": (0.019, 0.032, 0.0125), "layers": 2, "seg": 7, "trunk_frac": 0.42},
    "birch":  {"color": (0.048, 0.072, 0.021), "layers": 2, "seg": 6, "trunk_frac": 0.40},
}
store = {k: {"v": [], "f": [], "c": []} for k in SPECIES}
rng = 0
for t in trees_kv:
    spec = SPECIES[t["species"]]
    x, y = t["xy"]
    z = elev(x, y)
    if z < WATER_LEVEL:
        continue
    h = t["h"]
    crown = t["crown"]
    rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF
    rot = (rng / 0x7FFFFFFF) * math.tau
    tint = 0.34 + (rng % 1000) / 1000.0 * 0.20
    s = store[t["species"]]
    base = len(s["v"])
    seg = spec["seg"]
    trunk_h = h * spec["trunk_frac"]
    r_trunk = max(0.06, h * 0.016)
    for k in range(4):
        a = rot + k * math.pi / 2
        s["v"].append((x + math.cos(a) * r_trunk, y + math.sin(a) * r_trunk, z - 0.3))
    for k in range(4):
        a = rot + k * math.pi / 2
        s["v"].append((x + math.cos(a) * r_trunk * 0.7, y + math.sin(a) * r_trunk * 0.7,
                       z + trunk_h))
    for k in range(4):
        s["f"].append((base + k, base + (k + 1) % 4, base + 4 + (k + 1) % 4, base + 4 + k))
    canopy_h = h - trunk_h
    layers = spec["layers"]
    for li in range(layers):
        frac0 = li / layers
        frac1 = (li + 1.35) / layers
        zc0 = z + trunk_h + canopy_h * frac0 * 0.82
        zc1 = min(z + h, z + trunk_h + canopy_h * frac1)
        radius = crown * (1.0 - frac0 * 0.5)
        if t["species"] == "birch":
            radius = crown * (1.0 - frac0 * 0.25)
        ring_start = len(s["v"])
        for k in range(seg):
            a = rot + k * math.tau / seg
            s["v"].append((x + math.cos(a) * radius, y + math.sin(a) * radius, zc0))
        apex = len(s["v"])
        s["v"].append((x, y, zc1))
        for k in range(seg):
            s["f"].append((ring_start + k, ring_start + (k + 1) % seg, apex))
        s["f"].append(tuple(range(ring_start + seg - 1, ring_start - 1, -1)))
    added = len(s["v"]) - base
    s["c"].extend([(tint, tint, tint, 1.0)] * added)

tree_objects = []
for species, s in store.items():
    if not s["v"]:
        continue
    ob = mesh_object("Trees_%s" % species, s["v"], s["f"])
    mat = bpy.data.materials.new("Foliage_%s" % species)
    mat.use_nodes = True
    mnt = mat.node_tree
    bs = mnt.nodes["Principled BSDF"]
    attr = mnt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "Col"
    mix = mnt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    col = SPECIES[species]["color"]
    mix.inputs[6].default_value = (col[0] * 1.05, col[1] * 1.15, col[2] * 0.85, 1.0)
    mnt.links.new(attr.outputs["Color"], mix.inputs[7])
    mnt.links.new(mix.outputs[2], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.88
    if "Specular IOR Level" in bs.inputs:
        bs.inputs["Specular IOR Level"].default_value = 0.18
    ob.data.materials.append(mat)
    ca = ob.data.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    ca.data.foreach_set("color", [c for rgba in s["c"] for c in rgba])
    tree_objects.append(ob)

# --------------------------------------------------------------- power lines
mat_pole = principled("Pole_Wood", (0.055, 0.040, 0.030), roughness=0.9)
mat_wire = principled("Wire", (0.02, 0.02, 0.02), roughness=0.4, metallic=0.9)
pv, pf, wv2, wf2 = [], [], [], []
for line in scene_data["powerlines"]:
    pts = [(x, y) for x, y in line if abs(x) <= HALF and abs(y) <= HALF]
    if len(pts) < 2:
        continue
    tops = []
    for x, y in pts:
        z = elev(x, y)
        top = z + 9.5
        tops.append((x, y, top))
        b = len(pv)
        for k in range(4):
            a = k * math.pi / 2 + 0.4
            pv.append((x + math.cos(a) * 0.22, y + math.sin(a) * 0.22, z - 0.5))
        for k in range(4):
            a = k * math.pi / 2 + 0.4
            pv.append((x + math.cos(a) * 0.16, y + math.sin(a) * 0.16, top))
        for k in range(4):
            pf.append((b + k, b + (k + 1) % 4, b + 4 + (k + 1) % 4, b + 4 + k))
    for (x0, y0, z0), (x1, y1, z1) in zip(tops, tops[1:]):
        dxp, dyp = x1 - x0, y1 - y0
        ln = math.hypot(dxp, dyp) or 1.0
        ox, oy = -dyp / ln * 0.9, dxp / ln * 0.9
        for side in (-1, 0, 1):
            b = len(wv2)
            sag = min(1.6, ln * 0.012)
            steps = 6
            for st in range(steps + 1):
                tt = st / steps
                px = x0 + dxp * tt + ox * side
                py = y0 + dyp * tt + oy * side
                pz = z0 + (z1 - z0) * tt - sag * math.sin(math.pi * tt)
                wv2.append((px + 0.06, py, pz))
                wv2.append((px - 0.06, py, pz - 0.09))
            for st in range(steps):
                wf2.append((b + st * 2, b + st * 2 + 1, b + st * 2 + 3, b + st * 2 + 2))
if pv:
    mesh_object("PowerPoles", pv, pf).data.materials.append(mat_pole)
if wv2:
    mesh_object("PowerWires", wv2, wf2).data.materials.append(mat_wire)


# --------------------------------------------------------- real sun and sky
def solar_position(year, month, day, hour_utc, lat, lon):
    if month <= 2:
        year -= 1
        month += 12
    a = year // 100
    b = 2 - a + a // 4
    jd = (math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1))
          + day + b - 1524.5 + hour_utc / 24.0)
    t = (jd - 2451545.0) / 36525.0
    L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
    M = 357.52911 + t * (35999.05029 - 0.0001537 * t)
    e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    Mr = math.radians(M)
    C = (math.sin(Mr) * (1.914602 - t * (0.004817 + 0.000014 * t))
         + math.sin(2 * Mr) * (0.019993 - 0.000101 * t) + math.sin(3 * Mr) * 0.000289)
    omega = 125.04 - 1934.136 * t
    lam = math.radians(L0 + C - 0.00569 - 0.00478 * math.sin(math.radians(omega)))
    eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    eps = math.radians(eps0 + 0.00256 * math.cos(math.radians(omega)))
    decl = math.asin(math.sin(eps) * math.sin(lam))
    y = math.tan(eps / 2) ** 2
    L0r = math.radians(L0)
    eot = 4 * math.degrees(y * math.sin(2 * L0r) - 2 * e * math.sin(Mr)
                           + 4 * e * y * math.sin(Mr) * math.cos(2 * L0r)
                           - 0.5 * y * y * math.sin(4 * L0r)
                           - 1.25 * e * e * math.sin(2 * Mr))
    tst = (hour_utc * 60 + eot + 4 * lon) % 1440
    ha = math.radians(tst / 4 - 180)
    latr = math.radians(lat)
    zen = math.acos(math.sin(latr) * math.sin(decl)
                    + math.cos(latr) * math.cos(decl) * math.cos(ha))
    az = math.degrees(math.atan2(math.sin(ha),
                                 math.cos(ha) * math.sin(latr) - math.tan(decl) * math.cos(latr)))
    return 90 - math.degrees(zen), (az + 180.0) % 360.0


SUN_EL, SUN_AZ = solar_position(2026, 9, 4, 14.5, meta["center"]["lat"], meta["center"]["lon"])
el_r = math.radians(max(SUN_EL, 4.0))
az_r = math.radians(SUN_AZ)
to_sun = Vector((math.cos(el_r) * math.sin(az_r), math.cos(el_r) * math.cos(az_r), math.sin(el_r)))

world = bpy.data.worlds[0] if bpy.data.worlds else bpy.data.worlds.new("Sky")
bpy.context.scene.world = world
world.use_nodes = True
wnt2 = world.node_tree
wnt2.nodes.clear()
wout = wnt2.nodes.new("ShaderNodeOutputWorld")
wbg = wnt2.nodes.new("ShaderNodeBackground")
sky = wnt2.nodes.new("ShaderNodeTexSky")
try:
    sky.sky_type = "NISHITA"
    sky.sun_elevation = el_r
    sky.sun_rotation = math.atan2(to_sun.y, to_sun.x)
    sky.altitude = 0.0
    sky.air_density = 1.0
    sky.dust_density = 0.45
    sky.sun_disc = True
except Exception:
    pass
wnt2.links.new(sky.outputs["Color"], wbg.inputs["Color"])
wbg.inputs["Strength"].default_value = 1.0
wnt2.links.new(wbg.outputs["Background"], wout.inputs["Surface"])

sun_data = bpy.data.lights.new("Sun", type="SUN")
sun_data.energy = 2.7
sun_data.angle = math.radians(0.55)
sun_data.color = (1.0, 0.94, 0.86)
sun_obj = link(bpy.data.objects.new("Sun", sun_data))
sun_obj.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()


# ------------------------------------------------------------------ cameras
def make_camera(name, loc, target, lens):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 1.0
    cd.clip_end = 60000.0
    ob = link(bpy.data.objects.new(name, cd))
    ob.location = Vector(loc)
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


cam_aerial = make_camera("Cam_Aerial", (-780.0, -980.0, 830.0),
                         (10.0, 20.0, elev(10.0, 20.0)), 30.0)
cam_drone = make_camera("Cam_Drone", (-430.0, 210.0, elev(-430.0, 210.0) + 240.0),
                        (260.0, -260.0, elev(260.0, -260.0) + 4.0), 34.0)
cam_farm = make_camera("Cam_Farms", (-90.0, 40.0, elev(-90.0, 40.0) + 95.0),
                       (250.0, -140.0, elev(250.0, -140.0) + 5.0), 55.0)
grillbu = (190.0, 0.0)
cam_grillbu = make_camera("Cam_Grillbu",
                          (grillbu[0], grillbu[1], elev(*grillbu) + 1.7),
                          (grillbu[0] + 900.0 * math.sin(math.radians(150.0)),
                           grillbu[1] + 900.0 * math.cos(math.radians(150.0)), 0.0), 26.0)
knoll = (0.0, 0.0)
cam_knoll = make_camera("Cam_Knoll",
                        (knoll[0], knoll[1], elev(*knoll) + 5.0),
                        (knoll[0] + 3000.0 * math.sin(math.radians(170.0)),
                         knoll[1] + 3000.0 * math.cos(math.radians(170.0)), 0.0), 32.0)
bpy.context.scene.camera = cam_drone

# ------------------------------------------------------------------- render
scn = bpy.context.scene
scn.render.engine = "CYCLES"
scn.cycles.samples = 96
scn.cycles.use_denoising = True
if any(i.identifier == "OPTIX" for i in scn.cycles.bl_rna.properties["denoiser"].enum_items):
    scn.cycles.denoiser = "OPTIX"
scn.cycles.use_adaptive_sampling = True
scn.cycles.adaptive_min_samples = 32
scn.cycles.max_bounces = 6
scn.render.resolution_x = 1920
scn.render.resolution_y = 1080
scn.view_settings.view_transform = "AgX"
scn.view_settings.exposure = -0.25
if any(i.identifier == "AgX - Medium High Contrast"
       for i in scn.view_settings.bl_rna.properties["look"].enum_items):
    scn.view_settings.look = "AgX - Medium High Contrast"

result = {
    "terrain": {"grid": [RES, RES], "step_m": round(STEP, 2),
                "range_m": [tinfo["min"], tinfo["max"]], "verts": len(me.vertices)},
    "water_faces": len(wf),
    "buildings": built,
    "roof_faces": roof_faces_total,
    "trees": sum(1 for _ in trees_kv),
    "tree_polys": {o.name: len(o.data.polygons) for o in tree_objects},
    "sun": {"elevation_deg": round(SUN_EL, 2), "azimuth_deg": round(SUN_AZ, 2)},
    "objects": len(bpy.context.scene.objects),
}
