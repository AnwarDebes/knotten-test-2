"""Knotten layout v6 (2026-09-30): the four rows of the plan, A to D, on the measured terrain.

The project group settled on 27 September 2026 that the field has four rows: A with 9 plots, B with 10,
C with 7 and D with 4, numbered 1 to 30 row by row from west to east (the Klassisk site plan, redrawn
from the project owner's sketch). v5 had six terraces with other numbers. v6 lays out exactly those
four rows inside parcel 355/10, on the 1 m LiDAR, where the ground lets a row of houses stand and see
the sea:

  A  1-9    the top row along the rim under Løkkeheia, from the west boundary to the plateau in the east
  B  10-19  the second row: six houses across the west and middle of the slope, then four on the east
            shoulder; the plateau between them is flat, so a house there would stand in front of row A
  C  20-26  the third row, across the slope above the steep band
  D  27-30  the south face of Knotten itself, the knoll south of the saddle; the saddle between C and D
            has no view of the water (the knoll hides it), so no row stands there

Each row is a smooth line drawn along the terrain; its houses are evenly spaced along it, at least 14 m
apart (11 m house, 3 m between), 10.5 m inside the parcel boundary and 18 m from the buildings by the
yard. Every house stands on a pad at the ground level under its centre; house.plinth_m (what shows
below the floor on the downhill side) and terrain.cut_behind_m (the bank behind) come from the LiDAR
under the footprint. Each house is checked against the water over the LiDAR with all 29 other houses
standing, and the sun is the real sun over the real ridge.

The road follows the sketch: one road from the yard by Rødbergsveien, snaking up with hairpins at
alternating ends (west, east, west) and ending in a turning place in the east, with a footpath ("gang
sti") straight down through the rows. It runs behind every row, so each house is reached from the road
above it: up the east flank to Knotten (row D), round the west end of the saddle to row C, a short
turn on the plateau to row B, the west hairpin to row A, and down the east shoulder to the last four
houses of row B. The road is drawn on today's ground; the true grades are stated per segment, and the
steep links (the access from the yard, the west hairpin) need the longer loops and earthworks the
regulation plan will set to keep the 6 % the sketch asks for.

Inputs   ../source/*.f32, *.json, ../data/parcels.json, buildings.json, trees.json
Outputs  ../data/plots.json, road.json, clearing.json, trees.json (+ copies and trees.bin in site/public/data)
Run      python pipeline/plan_layout_v6.py [--dry]
"""
from __future__ import annotations

import json
import math
import shutil
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import knotten_terrain as kt  # noqa: E402

KN = Path(__file__).resolve().parent.parent
OUT = KN / "data"
PUB = KN / "site" / "public" / "data"

HOUSE = {"w": 11.0, "d": 8.5, "eaves": 3.2, "ridge": 5.6}
TERRACE_SLAB = 3.2        # the terrace in front of the house, as drawn by Proposal.tsx and relayout_v2.py
EDGE_MARGIN = 10.5        # house centre to the parcel boundary (5.5 m half-width plus 5 m of garden)
MIN_PITCH = 14.0          # 11 m house + 3 m between
EYE = 0.6 + 1.6           # floor over the pad + living-room eye height
ROAD_W = 5.0
TOTAL = 30

# the rows: label, number, and one or more stretches, each a line through control points (local
# metres, x east, y north) with the number of houses it carries, west to east
ROWS = [
    {"label": "A", "row": 1, "parts": [
        {"n": 9, "pts": [(-45, 60), (-25, 60), (0, 59), (22, 55), (40, 51), (55, 47), (65, 42)]},
    ]},
    {"label": "B", "row": 2, "parts": [
        {"n": 6, "pts": [(-48.5, 39), (-25, 40), (0, 40), (22, 37.2)]},
        {"n": 4, "pts": [(74, 30), (88, 28), (102, 26), (116, 24)]},
    ]},
    {"label": "C", "row": 3, "parts": [
        {"n": 7, "pts": [(-41, 19), (-20, 21), (0, 20), (25, 20), (48, 23)]},
    ]},
    {"label": "D", "row": 4, "parts": [
        {"n": 4, "pts": [(8, -60), (23, -62), (38, -62), (53, -61)]},
    ]},
]
TERRAIN_NOTE = {
    "A": {"no": "Øverst, langs kanten under Løkkeheia", "en": "The top row, along the rim below Løkkeheia"},
    "B": {"no": "Midt i skråningen og på østskulderen", "en": "Mid-slope and on the east shoulder"},
    "C": {"no": "Nedre del av skråningen, over det bratte beltet", "en": "Lower slope, above the steep band"},
    "D": {"no": "Sørsiden av knausen Knotten", "en": "The south face of the Knotten knoll"},
}

# the road, one line from the yard to the turning place, through named waypoints; each piece is
# either a row road (behind a row) or a link
ENTRANCE = (204.0, -66.0)
ROAD = [
    ("access", "link", [ENTRANCE, (194, -74), (186, -78), (176, -75), (166, -68), (160, -62), (156, -76), (152, -90), (146, -92), (144, -80), (140, -66),
                        (134, -52), (124, -40), (114, -34), (102, -33), (90, -38), (78, -46), (68, -50)]),
    ("row-D", "row", [(68, -50), (53, -52), (38, -53.5), (23, -53.5), (8, -51.5), (-2, -47)]),
    ("loop-west-D-C", "link", [(-2, -47), (-12, -40), (-22, -29), (-30, -17), (-38, -5), (-45, 6), (-51, 16), (-53, 24), (-49, 28.5)]),
    ("row-C", "row", [(-49, 28.5), (-41, 27.5), (-20, 29), (0, 28), (18, 27), (33, 28.5), (48, 31)]),
    ("turn-C-B", "link", [(48, 31), (50, 34.5), (44, 37), (36, 39.5), (30, 43.5), (22, 44.0)]),
    ("row-B-west", "row", [(22, 44.0), (8, 46.6), (-6, 48), (-20, 48), (-34, 47.5), (-48, 47)]),
    ("loop-west-B-A", "link", [(-48, 47), (-54, 50), (-55.5, 57), (-54, 65.5), (-46, 69)]),
    ("row-A", "row", [(-46, 69), (-30, 68.5), (-15, 68), (0, 67), (15, 65), (27, 62), (40, 59.5), (53, 56.5), (63.5, 53), (70, 49)]),
    ("down-A-B-east", "link", [(70, 49), (76, 45), (77, 40), (85, 37.5)]),
    ("row-B-east", "row", [(85, 37.5), (100, 35), (116, 33)]),
]
ROW_OF_ROAD = {"row-A": 1, "row-B-west": 2, "row-B-east": 2, "row-C": 3, "row-D": 4}
# the footpath straight down through the rows near the east end, as the sketch's "Gang sti"
PATH = [(32, 61), (31.8, 50), (31, 44), (30, 36), (29, 29), (26, 22), (26, 12), (27, 0), (28, -15), (30, -30), (30, -45), (30, -53)]

OB = kt.OBSTACLES


# ------------------------------------------------------------------ geometry
def catmull(pts, step=0.5):
    """A smooth line through the control points (centripetal enough for these gentle curves), every `step` m."""
    P = [tuple(map(float, p)) for p in pts]
    if len(P) == 2:
        L = math.dist(P[0], P[1])
        n = max(2, int(L / step))
        return [(P[0][0] + (P[1][0] - P[0][0]) * t / (n - 1), P[0][1] + (P[1][1] - P[0][1]) * t / (n - 1)) for t in range(n)]
    ext = [(2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1])] + P + [(2 * P[-1][0] - P[-2][0], 2 * P[-1][1] - P[-2][1])]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        n = max(2, int(math.dist(p1, p2) / step))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(P[-1])
    return out


def arclen(line):
    s = [0.0]
    for a, b in zip(line, line[1:]):
        s.append(s[-1] + math.dist(a, b))
    return s


def point_at(line, s_list, s):
    for i in range(1, len(s_list)):
        if s_list[i] >= s:
            t = (s - s_list[i - 1]) / max(1e-9, s_list[i] - s_list[i - 1])
            a, b = line[i - 1], line[i]
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    return line[-1]


def resample(line, step):
    s = arclen(line)
    n = max(1, round(s[-1] / step))
    return [point_at(line, s, s[-1] * k / n) for k in range(n + 1)]


def footprint(x, y, facing_deg, front=0.0):
    """Corners of the house (and, with front > 0, the terrace slab in front) facing `facing_deg`."""
    f = math.radians(facing_deg)
    ca, sa = math.cos(f), math.sin(f)
    hw, hd = HOUSE["w"] / 2, HOUSE["d"] / 2
    return [(x + u * ca + v * sa, y - u * sa + v * ca) for u, v in ((-hw, -hd), (hw, -hd), (hw, hd + front), (-hw, hd + front))]


def dist_point_poly(px, py, poly):
    """Distance from a point to a convex polygon (0 inside)."""
    inside = kt.inside(poly, px, py)
    if inside:
        return 0.0
    return kt.dist_to_edge(poly, px, py)


# ------------------------------------------------------------------ houses
print("layout v6: the four rows A to D on the measured terrain...", flush=True)
plots = []
for row in ROWS:
    for part in row["parts"]:
        line = catmull(part["pts"])
        s = arclen(line)
        n = part["n"]
        pitch = s[-1] / (n - 1)
        for k in range(n):
            x, y = point_at(line, s, pitch * k)
            plots.append({"row": row["row"], "label": row["label"], "x": x, "y": y, "pitch": pitch})
assert len(plots) == TOTAL, len(plots)
counts = {r["label"]: sum(p["n"] for p in r["parts"]) for r in ROWS}
assert counts == {"A": 9, "B": 10, "C": 7, "D": 4}, counts
for i, p in enumerate(plots):
    p["id"] = f"plot-{i + 1:02d}"
    g = kt.ground(p["x"], p["y"])
    p["ground"] = g
    p["pad"] = round(g * 2) / 2                     # the pad at the ground under the centre, to half a metre
    p["z"] = p["pad"]
    p["slope"], p["aspect"] = kt.slope_aspect(p["x"], p["y"])
    p["zone"] = "hill"

problems = []
for p in plots:
    if not kt.inside(kt.HILL, p["x"], p["y"]) or kt.dist_to_edge(kt.HILL, p["x"], p["y"]) < EDGE_MARGIN:
        problems.append(f"{p['id']} closer than {EDGE_MARGIN} m to the parcel boundary")
    if kt.near_building(p["x"], p["y"], 18.0):
        problems.append(f"{p['id']} too close to a building")
    for q in plots:
        if q is not p and math.hypot(p["x"] - q["x"], p["y"] - q["y"]) < MIN_PITCH - 0.1:
            problems.append(f"{p['id']} only {math.hypot(p['x'] - q['x'], p['y'] - q['y']):.1f} m from {q['id']}")
if problems:
    raise SystemExit("layout problems:\n  " + "\n  ".join(problems))
for p in plots:
    OB.append((p["x"], p["y"], 7.0, p["z"] + 0.6 + HOUSE["ridge"]))

if "--dry" in sys.argv:
    for p in plots:
        own = [o for o in OB if abs(o[0] - p["x"]) < 0.01 and abs(o[1] - p["y"]) < 0.01]
        OB[:] = [o for o in OB if o not in own]
        w, o = kt.quick_view(p["x"], p["y"], p["z"] + EYE)
        OB.extend(own)
        print(f"  {p['id']} {p['label']} ({p['x']:6.1f},{p['y']:6.1f}) ground {p['ground']:5.1f} pad {p['pad']:5.1f} slope {p['slope']:4.1f} pitch {p['pitch']:4.1f} quick water {w} open {o}", flush=True)
    raise SystemExit("dry run: placement only")

# ------------------------------------------------------- full evidence per plot
print("full horizon, view and sun per plot (all other houses standing)...", flush=True)
DATES = {"dec21": (12, 21), "mar21": (3, 21), "jun21": (6, 21)}


def record_for(p):
    g = p["ground"]
    floor = p["z"] + 0.6
    eye = floor + 1.6
    OB[:] = [o for o in OB if not (abs(o[0] - p["x"]) < 0.01 and abs(o[1] - p["y"]) < 0.01)]
    hz, water = kt.full_view(p["x"], p["y"], eye)
    OB.append((p["x"], p["y"], 7.0, p["z"] + 0.6 + HOUSE["ridge"]))
    geo = kt.georef(p["x"], p["y"])
    sea_b = [b for b, w in enumerate(water) if w >= 1500]
    open_b = [b for b, w in enumerate(water) if w >= 7000]
    facing = ((sea_b[0] + sea_b[-1]) / 2) if sea_b else p["aspect"]
    p["facing"] = facing
    sun = {}
    for key, (mo, dd) in DATES.items():
        h, poss, f, l = kt.sun_hours(hz, geo["lat"], geo["lon"], mo, dd)
        sun[key] = {"hours": h, "possible_hours": poss, "first_sun_cet": None if f is None else round(f, 2), "last_sun_cet": None if l is None else round(l, 2)}
    corners = [kt.ground(cx, cy) for cx, cy in footprint(p["x"], p["y"], facing)]
    plinth = round(max(1.0, floor - min(corners) + 0.3), 2)      # what shows below the floor on the downhill side
    cut = round(max(0.0, max(corners) - floor), 2)              # the bank behind
    s = math.tan(math.radians(p["slope"]))
    cutfill = round(0.5 * HOUSE["w"] * HOUSE["d"] * (HOUSE["d"] * s) / 2, 1)
    rec = {
        "id": p["id"], "row": p["row"], "row_label": p["label"], "zone": p["zone"],
        "local": {"x": round(p["x"], 2), "y": round(p["y"], 2), "z_ground": round(g, 2), "z_floor": round(floor, 2)},
        **geo,
        "house": {"width_m": HOUSE["w"], "depth_m": HOUSE["d"], "facing_deg": round(facing, 1), "eaves_m": HOUSE["eaves"], "ridge_m": HOUSE["ridge"], "storeys": 1.5, "plinth_m": plinth},
        "terrain": {"slope_deg": round(p["slope"], 1), "aspect_deg": round(p["aspect"], 1), "level_pad_cutfill_m3": cutfill, "dist_to_boundary_m": round(kt.dist_to_edge(kt.HILL, p["x"], p["y"]), 1), "terrace_level_m": round(p["pad"], 1), "cut_behind_m": cut, "note": TERRAIN_NOTE[p["label"]]},
        "view": {"water_visible_deg": len(sea_b), "water_bearings": [sea_b[0], sea_b[-1]] if sea_b else None, "open_sea_visible": bool(open_b), "open_sea_deg": len(open_b), "farthest_water_m": max(water), "checked_with_neighbours": True},
        "sun": sun,
        "horizon_deg_by_bearing": hz,
        "status": "provisional",
    }
    print(" ", p["id"], p["label"], "z", round(g, 1), "water", len(sea_b), "open sea", len(open_b), "sun dec", sun["dec21"]["hours"], "plinth", plinth, "cut", cut, flush=True)
    return rec


# the full view pass takes minutes; while the houses stay where they are, reuse it (road tweaks)
CACHE = Path(__file__).resolve().parent / "__pycache__" / "plan_layout_v6_records.json"
key = json.dumps([[round(p["x"], 2), round(p["y"], 2), p["pad"]] for p in plots])
cached = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else None
if cached and cached.get("key") == key:
    records = cached["records"]
    for p, r in zip(plots, records):
        p["facing"] = r["house"]["facing_deg"]
    print("  (views and sun reused from the cache; the houses have not moved)", flush=True)
else:
    records = [record_for(p) for p in plots]
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps({"key": key, "records": records}), encoding="utf-8")
PLINTH_MAX = 7.0
bad = [r["id"] for r in records if r["view"]["water_visible_deg"] < 4 or r["house"]["plinth_m"] > PLINTH_MAX]
if bad:
    raise SystemExit(f"houses without a view or on too high a plinth: {bad}")

# ------------------------------------------------------------------ roads
print("road...", flush=True)
pieces = []
line_all = []
for name, kind, pts in ROAD:
    smooth = resample(catmull(pts, 0.5), 3.0)
    if line_all:
        smooth = smooth[1:]          # the first point is the last point of the piece before
    start = len(line_all)
    line_all += smooth
    pieces.append({"id": name, "kind": kind, "from": max(0, start - 1), "to": len(line_all) - 1})


SMOOTH_SIGMA = 4.0        # metres along the line


def ground_along(pts, sigma=SMOOTH_SIGMA):
    """The ground under the line, smoothed along it: the 1 m LiDAR carries every rock and step, a graded
    road surface does not. A Gaussian of `sigma` metres over the ground sampled every metre."""
    s = arclen(pts)
    fine = resample(pts, 1.0)
    fs = arclen(fine)
    fz = [kt.ground(x, y) for x, y in fine]
    out = []
    j0 = 0
    for si in s:
        while j0 < len(fs) and fs[j0] < si - 3 * sigma:
            j0 += 1
        num = den = 0.0
        j = j0
        while j < len(fs) and fs[j] <= si + 3 * sigma:
            w = math.exp(-0.5 * ((fs[j] - si) / sigma) ** 2)
            num += w * fz[j]
            den += w
            j += 1
        out.append(num / den)
    return out


def rise_fall(zs, tol=1.0):
    """Metres up and metres down along a profile, counting a turn only once it passes `tol` metres, so
    the small wiggles left after smoothing do not add up."""
    rise = fall = 0.0
    ref = ext = zs[0]
    up = None
    for z in zs[1:]:
        if up is None:
            if abs(z - ref) > tol:
                up, ext = z > ref, z
        elif up:
            if z > ext:
                ext = z
            elif z < ext - tol:
                rise += ext - ref
                ref, ext, up = ext, z, False
        else:
            if z < ext:
                ext = z
            elif z > ext + tol:
                fall += ref - ext
                ref, ext, up = ext, z, True
    if up is True:
        rise += ext - ref
    elif up is False:
        fall += ref - ext
    return rise, fall


def profile(pts, zs):
    out = []
    for (x0, y0), (x1, y1), z0, z1 in zip(pts, pts[1:], zs, zs[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 0.5:
            continue
        grade = (z1 - z0) / L * 100
        out.append({"from": [round(x0, 2), round(y0, 2), round(z0, 2)], "to": [round(x1, 2), round(y1, 2), round(z1, 2)], "length_m": round(L, 1), "grade_pct": round(grade, 1), "ok_6pct": abs(grade) <= 6.0})
    return out


# the houses (with their terrace slabs) the road must pass clear of
bodies = [(r["id"], footprint(r["local"]["x"], r["local"]["y"], r["house"]["facing_deg"], TERRACE_SLAB)) for r in records]
clash = []
for (x, y) in line_all:
    for pid, poly in bodies:
        d = dist_point_poly(x, y, poly)
        if d < ROAD_W / 2 - 0.3:
            clash.append((pid, round(x, 1), round(y, 1), round(d, 2)))
    if not kt.inside(kt.HILL, x, y) and not kt.inside(kt.YARD, x, y) and math.dist((x, y), ENTRANCE) > 25:
        clash.append(("outside the parcel", round(x, 1), round(y, 1), 0))
if clash:
    worst = {}
    for c in clash:
        if c[0] not in worst or c[3] < worst[c[0]][3]:
            worst[c[0]] = c
    print("  road passes close to:", list(worst.values()), flush=True)
    if any(c[0] == "outside the parcel" for c in clash) or any(c[3] < 0.5 for c in worst.values()):
        raise SystemExit("the road runs over a house or outside the parcel")

z_all = ground_along(line_all)
dev = max(abs(z - kt.ground(x, y)) for (x, y), z in zip(line_all, z_all))
print(f"  road surface smoothed along the line (sigma {SMOOTH_SIGMA} m): at most {dev:.1f} m from the LiDAR ground", flush=True)
segments = profile(line_all, z_all)
road = {"entrance": list(ENTRANCE), "entrance_z": round(kt.ground(*ENTRANCE), 1), "rows": [], "ramps": [], "segments": segments, "paths": []}
for pc in pieces:
    pts = line_all[pc["from"]:pc["to"] + 1]
    zs = z_all[pc["from"]:pc["to"] + 1]
    prof = profile(pts, zs)
    L = sum(s["length_m"] for s in prof)
    steep = [s for s in prof if not s["ok_6pct"]]
    worst = max((abs(s["grade_pct"]) for s in prof), default=0.0)
    dz = zs[-1] - zs[0]
    common = {"length_m": round(L, 1), "z_from": round(zs[0], 1), "z_to": round(zs[-1], 1), "mean_grade_pct": round(abs(dz) / L * 100, 1) if L else 0.0,
              "worst_grade_pct": round(worst, 1), "share_over_6pct": round(sum(s["length_m"] for s in steep) / L, 2) if L else 0.0}
    if pc["kind"] == "row":
        road["rows"].append({"row": ROW_OF_ROAD[pc["id"]], "id": pc["id"], "level": round(sum(zs) / len(zs)), "z_range": [round(min(zs), 1), round(max(zs), 1)], **common, "pts": [(round(x, 2), round(y, 2)) for x, y in pts]})
    else:
        # a link can dip before it climbs (the west loop crosses the saddle between Knotten and row C):
        # count every metre it goes up and down, and the length a 6 % road needs for all of it
        rise, fall = rise_fall(zs)
        need = (rise + fall) / 0.06
        road["ramps"].append({"id": pc["id"], "pts": [(round(x, 2), round(y, 2)) for x, y in pts], "climb_m": round(rise + fall, 1), "rise_m": round(rise, 1), "fall_m": round(fall, 1), **common,
                              "length_needed_at_6pct_m": round(need, 1), "feasible_straight": L >= need, "placeholder": bool(steep)})
    print(f"  {pc['id']}: {L:.0f} m, z {zs[0]:.1f} -> {zs[-1]:.1f} (mean {common['mean_grade_pct']} %), worst {worst:.1f} %, {common['share_over_6pct'] * 100:.0f} % of its length over 6 %", flush=True)
path_pts = resample(catmull(PATH, 0.5), 3.0)
path_z = ground_along(path_pts, 2.0)
path_prof = profile(path_pts, path_z)
road["paths"].append({"id": "gang-sti", "pts": [(round(x, 2), round(y, 2)) for x, y in path_pts], "length_m": round(sum(s["length_m"] for s in path_prof), 1),
                      "z_from": round(path_z[0], 1), "z_to": round(path_z[-1], 1), "note": "footpath with steps, 1.5 m wide, from the top row down through the rows and across the saddle to Knotten"})
over = [s for s in segments if not s["ok_6pct"]]
road["summary"] = {
    "total_length_m": round(sum(s["length_m"] for s in segments), 1),
    "segments_over_6pct": len(over),
    "length_over_6pct_m": round(sum(s["length_m"] for s in over), 1),
    "worst_grade_pct": round(max((abs(s["grade_pct"]) for s in segments), default=0), 1),
    "note": f"Layout v6: one road from the yard by Rødbergsveien, behind each row, with hairpins at alternating ends as in the project owner's sketch. Drawn on today's ground; z and grades are those of the ground under the line, smoothed along it over about {2 * SMOOTH_SIGMA:.0f} m the way a graded road surface is. The row roads rise and fall with the rows; the links (the access from the yard and the hairpins) are placeholders until the regulation plan sets the loops and earthworks that keep the 6 % the sketch asks for.",
}

# --------------------------------------------------------------- clearing
print("clearing the forest around the houses, the road and the path...", flush=True)
HOUSE_R = 14.0
ROAD_R = 6.5
PATH_R = 2.5
cell = 8.0
grid = {}
for (x, y) in line_all:
    grid.setdefault((int(x // cell), int(y // cell)), []).append((x, y, ROAD_R))
for (x, y) in path_pts:
    grid.setdefault((int(x // cell), int(y // cell)), []).append((x, y, PATH_R))


def near_line(x, y):
    cx, cy = int(x // cell), int(y // cell)
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for (px, py, r) in grid.get((cx + i, cy + j), ()):
                if (px - x) ** 2 + (py - y) ** 2 <= r * r:
                    return True
    return False


tf = json.loads((OUT / "trees.json").read_text(encoding="utf-8"))
trees = tf["trees"]
n_cleared = 0
for t in trees:
    x, y = t["x"], t["y"]
    c = False
    if -80 < x < 220 and -170 < y < 100:
        c = any((r["local"]["x"] - x) ** 2 + (r["local"]["y"] - y) ** 2 <= HOUSE_R * HOUSE_R for r in records) or near_line(x, y)
    t["cleared"] = c
    n_cleared += c

# the view from every living room: the analysis counts the water over bare ground, so the trees that stand
# in a house's line of sight to that water are cleared too (view corridors), or the passports would
# promise a view the 3D model hides behind the forest below the row
VIEW_R = 2.5              # a tree this close to a sight line can block it
tcell = 5.0
tgrid = {}
for k, t in enumerate(trees):
    if not t["cleared"]:
        tgrid.setdefault((int(t["x"] // tcell), int(t["y"] // tcell)), []).append(k)


def trees_near(x, y, r):
    cx, cy = int(x // tcell), int(y // tcell)
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for k in tgrid.get((cx + i, cy + j), ()):
                t = trees[k]
                if (t["x"] - x) ** 2 + (t["y"] - y) ** 2 <= r * r:
                    yield k


view_cleared = 0
for r in records:
    wb = r["view"]["water_bearings"]
    if not wb:
        continue
    x0, y0 = r["local"]["x"], r["local"]["y"]
    eye = r["local"]["z_floor"] + 1.6
    own = [o for o in OB if abs(o[0] - x0) < 0.01 and abs(o[1] - y0) < 0.01]
    OB[:] = [o for o in OB if o not in own]
    for b in range(wb[0], wb[1] + 1):
        far, _ = kt.water_along(x0, y0, eye, b)
        if far < 1500:            # the analysis counts water from 1.5 km
            continue
        dep = math.atan2(eye, far)          # the line down to the farthest water seen: the most a tree may stand in
        sx, sy = math.sin(math.radians(b)), math.cos(math.radians(b))
        d = 8.0
        while d <= min(400.0, far):
            x, y = x0 + sx * d, y0 + sy * d
            line = eye - d * math.tan(dep)
            for k in trees_near(x, y, VIEW_R):
                t = trees[k]
                if not t["cleared"] and t["z"] + t["h"] > line:
                    t["cleared"] = True
                    view_cleared += 1
            d += 2.0
    OB.extend(own)
n_cleared += view_cleared
tf["cleared_count"] = n_cleared
tf["view_corridor_count"] = view_cleared
tf["note"] = "cleared = within 14 m of a house centre, 6.5 m of the road centreline or 2.5 m of the footpath, or standing in a living room's line of sight to the water it sees (layout v6, four rows); the rest of the forest stays"
print("  trees cleared:", n_cleared, "of", len(trees), f"({view_cleared} of them in the sight lines to the water)", flush=True)

# ----------------------------------------------------------------- write
(OUT / "plots.json").write_text(json.dumps({
    "crs_note": "local: metres, x=east, y=north, z=height above sea level (Kartverket DTM); origin = 58.068057N 7.278401E. UTM zone 32N (EPSG:25832) also given.",
    "assumptions": {
        "layout": "Provisional v6 (2026-09-30): the four rows of the plan, A (plots 1-9), B (10-19), C (20-26) and D (27-30), numbered row by row from west to east as in the Klassisk site plan. The rows are drawn along the measured terrain inside parcel 355/10: A along the rim under Løkkeheia, B across the middle of the slope and on the east shoulder, C above the steep band, D on the south face of the knoll Knotten (the saddle between C and D has no view of the water). Houses at least 14 m apart and 10.5 m inside the boundary, each on a pad at the ground under its centre; house.plinth_m is what shows below the floor on the downhill side, terrain.cut_behind_m the bank behind, both from the LiDAR under the footprint. Every house checked against the water with all other houses standing. Replace with the regulation plan when it exists.",
        "sun": "Terrain shading only (forest cleared around the houses, no shading between houses). Eye = floor + 1.6 m, floor = pad + 0.6 m. 0.25 deg solar-disc margin. Times in CET.",
        "view": "Water counted where the line of sight reaches a sea-level cell; 'open sea' = water beyond 7 km. Refraction k = 1.17. Neighbouring houses (ridge 5.6 m) included as obstacles. The trees standing in a living room's line of sight to that water are cleared in the model (view corridors); the forest elsewhere stays.",
        "cutfill": "Order-of-magnitude for a level pad under the footprint only; the terraces and the road are the project owner's earthworks and are not quantified here.",
    },
    "plots": records,
}, indent=1), encoding="utf-8")
(OUT / "road.json").write_text(json.dumps(road, indent=1), encoding="utf-8")
(OUT / "clearing.json").write_text(json.dumps({
    "polygon_local": [[round(x, 1), round(y, 1)] for x, y in kt.HILL],
    "note": "Layout v6 clears around the houses (14 m), the road (6.5 m) and the footpath (2.5 m), and the trees in each living room's line of sight to the water; trees.json carries the flag per tree. The polygon is the hill parcel, kept for reference.",
    "house_radius_m": HOUSE_R, "road_radius_m": ROAD_R, "path_radius_m": PATH_R, "view_corridor_trees": view_cleared,
}, indent=1), encoding="utf-8")
(OUT / "trees.json").write_text(json.dumps(tf), encoding="utf-8")

PUB.mkdir(parents=True, exist_ok=True)
for f in ("plots.json", "road.json", "clearing.json", "trees.json"):
    shutil.copy2(OUT / f, PUB / f)

SP = {"spruce": 0, "pine": 1, "birch": 2}
kept = sorted((t for t in trees if not t["cleared"]), key=lambda t: t["x"] ** 2 + t["y"] ** 2)
cleared = [t for t in trees if t["cleared"]]
with open(PUB / "trees.bin", "wb") as fh:
    for t in kept + cleared:
        fh.write(struct.pack("<8f", t["x"], t["y"], t["z"], t["h"], t["crown"], t["rot"], t["tint"], SP[t["species"]] + (10 if t["cleared"] else 0)))
(PUB / "trees.bin.json").write_text(json.dumps({"count": len(trees), "floats_per_tree": 8, "layout": "x y z h crown rot tint code; code = species(0 spruce,1 pine,2 birch) + 10 if cleared", "order": "kept trees first sorted by distance from origin, then cleared trees", "kept_count": len(kept)}), encoding="utf-8")

print("DONE. plots:", len(records), "with water:", sum(1 for r in records if r["view"]["water_visible_deg"] > 0), "open sea:", sum(1 for r in records if r["view"]["open_sea_visible"]),
      "rows:", {k: sum(1 for r in records if r["row_label"] == k) for k in "ABCD"}, "| road", road["summary"], flush=True)
