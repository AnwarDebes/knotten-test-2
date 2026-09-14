"""Knotten layout v5 (2026-09-14): terraces. A row of houses on every level, each row directly under
the one above, the way the project owner wants to shape the ground.

The project owner will reshape the knoll so the houses can stand in rows one beneath the other:
the top row, the row under it, and so on down the south face. This layout builds exactly that on the
measured terrain: a column grid across the face (columns 14 m apart), and a row on every 6 m level
from the top ridge down to the saddle. A house stands where its column meets the row's terrace
level, on a terrace pad cut into the slope; the pad's plinth on the downhill side is measured from
the LiDAR under the footprint. The road of each row runs along the contour 3 m above its houses.

Every house is still checked against the water over the 1 m LiDAR with all other houses standing,
and the sun is the real sun over the real ridge. A cell where the house cannot see the water stays
empty, so the rows have gaps where the lower knoll blocks the fjord. Thirty houses in all.

Inputs   ../source/*.f32, *.json, ../data/parcels.json, buildings.json, trees.json
Outputs  ../data/plots.json, road.json, clearing.json, trees.json (+ copies and trees.bin in site/public/data)
Run      python pipeline/plan_layout_v5.py [--dry]
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
EDGE_MARGIN = 10.5        # house centre to the parcel boundary (5.5 m half-width plus 5 m of garden)
COL_PITCH = 14.0          # columns: 11 m house + 3 m between, as tight as the sketch draws them
ROW_GAP_MIN = 10.0        # a house must stand at least this far, in plan, from the house above it (8.5 m deep house plus a strip); the terraces make the rest
LEVEL_STEP = 7.0          # one terrace level every 7 m of height (a row of houses fits under the one above)
ROAD_ABOVE = 3.0          # the row road runs on the contour 3 m above the terrace
EYE = 0.6 + 1.6           # floor over ground + living-room eye height
TOTAL = 30

# terrace levels of the south face, top to bottom, and the lower knoll as the last resort
ROAD_LEVELS = [78.0, 71.0, 64.0, 57.0, 50.0]
FACE = {"x": (-52.0, 130.0), "y": (-14.0, 92.0)}
KNOLL = {"level": 52.0, "x": (-6.0, 78.0), "y": (-95.0, -58.0)}
COLUMNS = [-46.0 + COL_PITCH * k for k in range(14)]

OB = kt.OBSTACLES


def contour_points(level, win):
    """All points of the `level` contour inside the window and the parcel, every metre."""
    xr, yr = win["x"], win["y"]
    pts = []
    for poly in kt.contour_polylines(level, xr[0] - 20, xr[1] + 20, yr[0] - 20, yr[1] + 20):
        for (x, y) in kt.resample(poly, 1.0):
            if xr[0] <= x <= xr[1] and yr[0] <= y <= yr[1] and kt.inside(kt.HILL, x, y) and kt.dist_to_edge(kt.HILL, x, y) >= EDGE_MARGIN:
                pts.append((x, y))
    return pts


def footprint_corners(x, y, facing_deg):
    f = math.radians(facing_deg)
    ca, sa = math.cos(f), math.sin(f)
    hw, hd = HOUSE["w"] / 2, HOUSE["d"] / 2
    return [(x + u * ca + v * sa, y - u * sa + v * ca) for u in (-hw, hw) for v in (-hd, hd)]


print("terraces: a row on every level, a column grid across the face...", flush=True)
cache = {}


def quick(x, y, z):
    key = (round(x / 2), round(y / 2))
    if key not in cache:
        cache[key] = kt.quick_view(x, y, z + EYE)
    return cache[key]


rows = []   # one entry per terrace level: its candidates per column
for ri, L in enumerate(ROAD_LEVELS + [KNOLL["level"]]):
    knoll = ri == len(ROAD_LEVELS)
    T = L - ROAD_ABOVE
    win = KNOLL if knoll else FACE
    pts = contour_points(T, win)
    cells = {}
    for k, cx in enumerate(COLUMNS):
        near = [(x, y) for (x, y) in pts if abs(x - cx) <= 2.5]
        best = None
        for (x, y) in near:
            if kt.near_building(x, y, 18.0):
                continue
            z = kt.ground(x, y)
            water, open_sea = quick(x, y, T)
            if water == 0:
                continue
            slope, aspect = kt.slope_aspect(x, y)
            if slope > 45.0:      # a rock face, not a terrace
                continue
            c = {"x": x, "y": y, "z": T, "ground": z, "slope": slope, "aspect": aspect, "water": water, "open_sea": open_sea,
                 "row": ri + 1, "level": L, "terrace": T, "col": k, "zone": "hill", "road_xy": (x, y)}
            score = open_sea * 3 + water
            if best is None or score > best[0]:
                best = (score, c)
        if best:
            cells[k] = best[1]
    rows.append({"road_level": L, "terrace": T, "cells": cells, "knoll": knoll})
    line = "".join(("O" if cells[k]["open_sea"] > 0 else "w") if k in cells else "." for k in range(len(COLUMNS)))
    print(f"  level {L:.0f} (terrace {T:.0f} m): {line}  {len(cells)} cells with water", flush=True)

# stack the rows: every row sits under the one above, never on it. Where the slope is so steep that
# the contour of the next level is less than ROW_GAP_MIN below the house above (in plan), the cell
# is moved straight down the column to ROW_GAP_MIN and its terrace is cut or filled to the row's
# level, within 4 m; that is the earthwork the project owner intends. A cell that cannot be placed
# stays empty.
chosen = []
for r in rows:
    T = r["terrace"]
    for k, c in sorted(r["cells"].items()):
        above = [q for q in chosen if q["col"] == k and q["row"] == c["row"] - 1]
        if above and math.hypot(above[0]["x"] - c["x"], above[0]["y"] - c["y"]) < ROW_GAP_MIN:
            a = above[0]
            x2, y2 = a["x"], a["y"] - (ROW_GAP_MIN + 0.5)
            g2 = kt.ground(x2, y2)
            ok = kt.inside(kt.HILL, x2, y2) and kt.dist_to_edge(kt.HILL, x2, y2) >= EDGE_MARGIN and not kt.near_building(x2, y2, 18.0) and T - 4.0 <= g2 <= T + 4.0
            if ok:
                water, open_sea = quick(x2, y2, T)
                ok = water > 0
            if not ok:
                continue
            slope, aspect = kt.slope_aspect(x2, y2)
            c = dict(c, x=x2, y=y2, ground=g2, slope=slope, aspect=aspect, water=water, open_sea=open_sea, road_xy=(x2, y2 + 6.0), shifted=True)
        if any(math.hypot(q["x"] - c["x"], q["y"] - c["y"]) < (ROW_GAP_MIN if q["col"] == k else COL_PITCH - 1.0) for q in chosen):
            continue
        chosen.append(c)
print(f"  {len(chosen)} cells stand clear of each other", flush=True)

# thirty houses: whole rows from the top down; when a row has more cells than are still needed, it
# gives a block of neighbouring columns (no gaps) nearest the middle of the rows above, and the
# remainder goes to the next level down. The lower knoll comes last.
plots = []
by_row = {}
for c in chosen:
    by_row.setdefault(c["row"], []).append(c)
for ri in sorted(by_row):
    cells = sorted(by_row[ri], key=lambda c: c["col"])
    need = TOTAL - len(plots)
    if need <= 0:
        break
    centre = sum(p["col"] for p in plots) / len(plots) if plots else sum(c["col"] for c in cells) / len(cells)
    runs, cur = [], [cells[0]]
    for a, b in zip(cells, cells[1:]):
        if b["col"] == a["col"] + 1:
            cur.append(b)
        else:
            runs.append(cur)
            cur = [b]
    runs.append(cur)
    if len(cells) <= need:
        # the whole row, except a lone house standing three or more columns away from the rest
        keep = []
        for run in runs:
            lone = len(run) == 1 and len(runs) > 1 and min(abs(run[0]["col"] - q["col"]) for o in runs if o is not run for q in o) >= 3
            if not lone:
                keep += run
        plots += keep
        continue
    best = None
    for run in runs:
        size = min(need, len(run))
        for i in range(0, len(run) - size + 1):
            block = run[i:i + size]
            dist = abs(sum(b["col"] for b in block) / size - centre)
            key = (-size, dist)
            if best is None or key < best[0]:
                best = (key, block)
    plots += best[1]
plots = plots[:TOTAL]
for p in plots:
    OB.append((p["x"], p["y"], 7.0, p["z"] + 0.6 + HOUSE["ridge"]))
plots.sort(key=lambda p: (p["row"], p["x"]))
for i, p in enumerate(plots):
    p["id"] = f"plot-{i + 1:02d}"
for r in rows:
    n = sum(1 for p in plots if p["level"] == r["road_level"])
    if n:
        print(f"  row at {r['road_level']:.0f} m: {n} houses, columns {[p['col'] for p in plots if p['level'] == r['road_level']]}", flush=True)
if "--dry" in sys.argv:
    for p in plots:
        print(" ", p["id"], "row", p["row"], "col", p["col"], "at", round(p["x"], 1), round(p["y"], 1), "terrace", round(p["z"], 1), "ground", round(p["ground"], 1), "water", p["water"], "open", p["open_sea"], "shifted", p.get("shifted", False))
    raise SystemExit("dry run: placement only")

# ------------------------------------------------------- full evidence per plot
print("full horizon, view and sun per plot (neighbours standing)...", flush=True)
DATES = {"dec21": (12, 21), "mar21": (3, 21), "jun21": (6, 21)}


def record_for(p):
    g = p.get("ground", p["z"])
    floor = p["z"] + 0.6          # the terrace level of the row, plus the floor over it
    eye = floor + 1.6
    OB[:] = [o for o in OB if not (abs(o[0] - p["x"]) < 0.01 and abs(o[1] - p["y"]) < 0.01)]
    hz, water = kt.full_view(p["x"], p["y"], eye)
    OB.append((p["x"], p["y"], 7.0, g + 0.6 + HOUSE["ridge"]))
    geo = kt.georef(p["x"], p["y"])
    sea_b = [b for b, w in enumerate(water) if w >= 1500]
    open_b = [b for b, w in enumerate(water) if w >= 7000]
    facing = ((sea_b[0] + sea_b[-1]) / 2) if sea_b else p["aspect"]
    sun = {}
    for key, (mo, dd) in DATES.items():
        h, poss, f, l = kt.sun_hours(hz, geo["lat"], geo["lon"], mo, dd)
        sun[key] = {"hours": h, "possible_hours": poss, "first_sun_cet": None if f is None else round(f, 2), "last_sun_cet": None if l is None else round(l, 2)}
    # the terrace: the pad is cut into the bank behind and built up in front; the plinth is what
    # shows below the floor on the downhill side, measured from the LiDAR under the footprint
    corners = [kt.ground(cx, cy) for cx, cy in footprint_corners(p["x"], p["y"], facing)]
    plinth = round(max(1.0, floor - min(corners) + 0.3), 2)      # what shows below the floor on the downhill side
    cut = round(max(0.0, max(corners) - floor), 2)              # the bank behind
    s = math.tan(math.radians(p["slope"]))
    cutfill = round(0.5 * HOUSE["w"] * HOUSE["d"] * (HOUSE["d"] * s) / 2, 1)
    rec = {
        "id": p["id"], "row": p["row"], "zone": p["zone"],
        "local": {"x": round(p["x"], 2), "y": round(p["y"], 2), "z_ground": round(g, 2), "z_floor": round(floor, 2)},
        **geo,
        "house": {"width_m": HOUSE["w"], "depth_m": HOUSE["d"], "facing_deg": round(facing, 1), "eaves_m": HOUSE["eaves"], "ridge_m": HOUSE["ridge"], "storeys": 1.5, "plinth_m": plinth},
        "terrain": {"slope_deg": round(p["slope"], 1), "aspect_deg": round(p["aspect"], 1), "level_pad_cutfill_m3": cutfill, "dist_to_boundary_m": round(kt.dist_to_edge(kt.HILL, p["x"], p["y"]), 1), "terrace_level_m": round(p["terrace"], 1), "cut_behind_m": cut},
        "view": {"water_visible_deg": len(sea_b), "water_bearings": [sea_b[0], sea_b[-1]] if sea_b else None, "open_sea_visible": bool(open_b), "open_sea_deg": len(open_b), "farthest_water_m": max(water), "checked_with_neighbours": True},
        "sun": sun,
        "horizon_deg_by_bearing": hz,
        "status": "provisional",
    }
    print(" ", p["id"], "row", p["row"], "col", p["col"], "z", round(g, 1), "water", len(sea_b), "open sea", bool(open_b), "sun dec", sun["dec21"]["hours"], "plinth", plinth, flush=True)
    return rec


records = [record_for(p) for p in plots]

# a cell that loses the water once every house stands, or whose terrace would need a fill wall
# higher than PLINTH_MAX, is replaced: first by a cell that extends its row or stands under a house
# in the row above, then by the next best cell anywhere
PLINTH_MAX = 7.0


def fits_pattern(c):
    return any((q["row"] == c["row"] and abs(q["col"] - c["col"]) == 1) or (q["row"] == c["row"] - 1 and q["col"] == c["col"]) for q in plots)


def records_plinth(p):
    return p.get("_plinth_bad", False)


def bad(r):
    return r["view"]["water_visible_deg"] < 4 or r["house"]["plinth_m"] > PLINTH_MAX


for _round in range(6):
    blind = [i for i, r in enumerate(records) if bad(r)]
    if not blind:
        break
    for i in sorted(blind, reverse=True):
        p = plots.pop(i)
        rec = records.pop(i)
        p["_plinth_bad"] = rec["house"]["plinth_m"] > PLINTH_MAX
        p["tried"] = True
        OB[:] = [o for o in OB if not (abs(o[0] - p["x"]) < 0.01 and abs(o[1] - p["y"]) < 0.01)]
        print(f"  dropped {p['id']} at ({p['x']:.0f}, {p['y']:.0f}): {'a fill wall over 7 m' if records_plinth(p) else 'too little water with the neighbours standing'}", flush=True)
    spare = sorted([c for c in chosen if c not in plots and not c.get("tried")], key=lambda c: (0 if fits_pattern(c) else 1, -(c["open_sea"] * 3 + c["water"])))
    while len(plots) < TOTAL and spare:
        c = spare.pop(0)
        c["tried"] = True
        if any(math.hypot(c["x"] - q["x"], c["y"] - q["y"]) < (ROW_GAP_MIN if q["col"] == c["col"] else COL_PITCH - 1.0) for q in plots):
            continue
        c["id"] = "plot-new"
        OB.append((c["x"], c["y"], 7.0, c["z"] + 0.6 + HOUSE["ridge"]))
        rec = record_for(c)
        if bad(rec):
            OB[:] = [o for o in OB if not (abs(o[0] - c["x"]) < 0.01 and abs(o[1] - c["y"]) < 0.01)]
            continue
        plots.append(c)
        records.append(rec)
        print(f"  added a house in row {c['row']} column {c['col']} with {rec['view']['water_visible_deg']} degrees of water", flush=True)
if len(plots) < TOTAL:
    raise SystemExit(f"only {len(plots)} houses with a sea view can stand in the terraces")
order = sorted(range(len(plots)), key=lambda i: (plots[i]["row"], plots[i]["x"]))
plots = [plots[i] for i in order]
records = [records[i] for i in order]
for i, (p, r) in enumerate(zip(plots, records)):
    p["id"] = r["id"] = f"plot-{i + 1:02d}"

# ------------------------------------------------------------------ roads
print("roads...", flush=True)
ENTRANCE = (204.0, -66.0)


def row_road(L, win, members):
    """The road of a row: its contour, from the first house's column to the last, plus 8 m."""
    pts = contour_points_road(L, win)
    if not pts:
        return []
    xs = [p["x"] for p in members]
    lo, hi = min(xs) - 8.0, max(xs) + 8.0
    run = [q for q in pts if lo <= q[0] <= hi]
    run.sort(key=lambda q: q[0])
    # thin to every 3 m along x, keep it one polyline west to east
    out = []
    for q in run:
        if not out or math.hypot(q[0] - out[-1][0], q[1] - out[-1][1]) >= 3.0:
            out.append(q)
    return out


def contour_points_road(level, win):
    xr, yr = win["x"], win["y"]
    best = []
    for poly in kt.contour_polylines(level, xr[0] - 20, xr[1] + 20, yr[0] - 20, yr[1] + 20):
        cur = []
        for (x, y) in kt.resample(poly, 1.0):
            if xr[0] <= x <= xr[1] and yr[0] <= y <= yr[1] and kt.inside(kt.HILL, x, y) and kt.dist_to_edge(kt.HILL, x, y) >= 5:
                cur.append((x, y))
            else:
                if len(cur) > len(best):
                    best = cur
                cur = []
        if len(cur) > len(best):
            best = cur
    if best and best[0][0] > best[-1][0]:
        best.reverse()
    return best


row_roads = []
for r in rows:
    members = [p for p in plots if p["level"] == r["road_level"]]
    if not members:
        continue
    pts = row_road(r["road_level"], KNOLL if r["knoll"] else FACE, members)
    if len(pts) < 2:
        continue
    row_roads.append({"row": members[0]["row"], "level": r["road_level"], "pts": [(round(x, 2), round(y, 2)) for x, y in pts]})


def bridge(a, b, *via):
    pts = [a, *via, b]
    out = []
    for p, q in zip(pts, pts[1:]):
        out += kt.resample([p, q], 4.0)
    out.append(b)
    return out


def off(p, dx, dy):
    return (p[0] + dx, p[1] + dy)


# the links: a hairpin between each pair of rows at the ends that lie closest, the sweep round the
# saddle to the lower knoll if it is used, and the access from the yard by Rødbergsveien
links = []
face_roads = [r for r in row_roads if r["level"] in ROAD_LEVELS]
for up, down in zip(face_roads, face_roads[1:]):
    a, b = up["pts"], down["pts"]
    ww = math.hypot(a[0][0] - b[0][0], a[0][1] - b[0][1])
    ee = math.hypot(a[-1][0] - b[-1][0], a[-1][1] - b[-1][1])
    if ww <= ee:
        links.append((f"loop-west-{up['level']:.0f}-{down['level']:.0f}", bridge(a[0], b[0], off(a[0], -9, -1), off(b[0], -9, 2))))
    else:
        links.append((f"loop-east-{up['level']:.0f}-{down['level']:.0f}", bridge(a[-1], b[-1], off(a[-1], 9, -1), off(b[-1], 9, 2))))
lowest = face_roads[-1]["pts"]
join = lowest[-1] if lowest[-1][0] > lowest[0][0] else lowest[0]
knoll_road = next((r for r in row_roads if r["level"] == KNOLL["level"]), None)
if knoll_road:
    links.append(("sweep-knoll", bridge(join, knoll_road["pts"][0], (-30.0, -22.0), (-18.0, -34.0), (-16.0, -46.0), (-12.0, -56.0), off(knoll_road["pts"][0], -4, 2))))
    access_from = knoll_road["pts"][-1]
    links.append(("access", bridge(access_from, ENTRANCE, off(access_from, 6, 4), (78.0, -46.0), (90.0, -38.0), (102.0, -33.0), (114.0, -34.0), (124.0, -40.0), (134.0, -52.0), (140.0, -66.0), (144.0, -80.0), (146.0, -92.0), (152.0, -90.0), (156.0, -76.0), (160.0, -62.0), (168.0, -64.0), (186.0, -72.0))))
else:
    links.append(("access", bridge(join, ENTRANCE, off(join, 6, -4), (30.0, -22.0), (60.0, -24.0), (90.0, -30.0), (102.0, -33.0), (114.0, -34.0), (124.0, -40.0), (134.0, -52.0), (140.0, -66.0), (144.0, -80.0), (146.0, -92.0), (152.0, -90.0), (156.0, -76.0), (160.0, -62.0), (168.0, -64.0), (186.0, -72.0))))


def road_profile(pts):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        Ln = math.hypot(x1 - x0, y1 - y0)
        if Ln < 0.5:
            continue
        z0, z1 = kt.ground(x0, y0), kt.ground(x1, y1)
        grade = (z1 - z0) / Ln * 100
        out.append({"from": [round(x0, 1), round(y0, 1), round(z0, 1)], "to": [round(x1, 1), round(y1, 1), round(z1, 1)], "length_m": round(Ln, 1), "grade_pct": round(grade, 1), "ok_6pct": abs(grade) <= 6.0})
    return out


road = {"entrance": ENTRANCE, "entrance_z": round(kt.ground(*ENTRANCE), 1), "rows": row_roads, "ramps": [], "segments": []}
for rr in row_roads:
    road["segments"] += road_profile(rr["pts"])
for name, pts in links:
    prof = road_profile(pts)
    dz = abs(kt.ground(*pts[-1]) - kt.ground(*pts[0]))
    Ln = sum(s["length_m"] for s in prof)
    road["ramps"].append({"id": name, "pts": [(round(x, 2), round(y, 2)) for x, y in pts], "climb_m": round(dz, 1), "length_m": round(Ln, 1), "length_needed_at_6pct_m": round(dz / 0.06, 1), "feasible_straight": Ln >= dz / 0.06, "placeholder": True})
    road["segments"] += prof
bad = [s for s in road["segments"] if not s["ok_6pct"]]
road["summary"] = {
    "total_length_m": round(sum(s["length_m"] for s in road["segments"]), 1),
    "segments_over_6pct": len(bad),
    "worst_grade_pct": round(max((abs(s["grade_pct"]) for s in road["segments"]), default=0), 1),
    "note": "Terraces: each row road runs on the contour 3 m above its houses. The hairpins between rows and the access from the yard are placeholders drawn on the terrain before it is reshaped; each states its climb and the length a 6 % road needs.",
}
for r in road["ramps"]:
    print(f"  {r['id']}: {r['length_m']} m, climb {r['climb_m']} m, needs {r['length_needed_at_6pct_m']} m at 6 %", flush=True)

# --------------------------------------------------------------- clearing
print("clearing the forest around the terraces and roads...", flush=True)
HOUSE_R = 14.0
ROAD_R = 6.5
road_pts = []
for rr in row_roads:
    road_pts += kt.resample(rr["pts"], 3.0)
for _, pts in links:
    road_pts += kt.resample(pts, 3.0)
cell = 8.0
grid = {}
for (x, y) in road_pts:
    grid.setdefault((int(x // cell), int(y // cell)), []).append((x, y))


def near_road(x, y):
    cx, cy = int(x // cell), int(y // cell)
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for (px, py) in grid.get((cx + i, cy + j), ()):
                if (px - x) ** 2 + (py - y) ** 2 <= ROAD_R * ROAD_R:
                    return True
    return False


tf = json.loads((OUT / "trees.json").read_text(encoding="utf-8"))
trees = tf["trees"]
n_cleared = 0
for t in trees:
    x, y = t["x"], t["y"]
    c = False
    if -80 < x < 220 and -120 < y < 100:
        c = any((p["x"] - x) ** 2 + (p["y"] - y) ** 2 <= HOUSE_R * HOUSE_R for p in plots) or near_road(x, y)
    t["cleared"] = c
    n_cleared += c
tf["cleared_count"] = n_cleared
tf["note"] = "cleared = within 14 m of a house centre or 6.5 m of a road centreline (layout v5, terraces); the rest of the forest stays"
print("  trees cleared:", n_cleared, "of", len(trees), flush=True)

# ----------------------------------------------------------------- write
(OUT / "plots.json").write_text(json.dumps({
    "crs_note": "local: metres, x=east, y=north, z=height above sea level (Kartverket DTM); origin = 58.068057N 7.278401E. UTM zone 32N (EPSG:25832) also given.",
    "assumptions": {
        "layout": "Provisional v5 (2026-09-14), terraces: a row of houses on every 6 m level of the south face, each row directly under the one above on a column grid 14 m apart, the way the project owner intends to reshape the ground. Each house stands on a terrace pad; house.plinth_m is what shows below the floor on the downhill side, terrain.cut_behind_m the bank behind, both from the LiDAR under the footprint. Every house checked against the water with all other houses standing; cells without a view stay empty. Thirty plots, all with a measured sea view. Replace with the regulation plan when it exists.",
        "sun": "Terrain shading only (forest cleared around the houses, no shading between houses). Eye = floor + 1.6 m, floor = terrace + 0.6 m. 0.25 deg solar-disc margin. Times in CET.",
        "view": "Water counted where the line of sight reaches a sea-level cell; 'open sea' = water beyond 7 km. Refraction k = 1.17. Neighbouring houses (ridge 5.6 m) included as obstacles.",
        "cutfill": "Order-of-magnitude for a level pad under the footprint only; the terraces themselves are the project owner's earthworks and are not quantified here.",
    },
    "plots": records,
}, indent=1), encoding="utf-8")
(OUT / "road.json").write_text(json.dumps(road, indent=1), encoding="utf-8")
(OUT / "clearing.json").write_text(json.dumps({
    "polygon_local": [[round(x, 1), round(y, 1)] for x, y in kt.HILL],
    "note": "Layout v5 clears only around the houses (14 m) and the roads (6.5 m); trees.json carries the flag per tree. The polygon is the hill parcel, kept for reference.",
    "house_radius_m": HOUSE_R, "road_radius_m": ROAD_R,
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

print("DONE. plots:", len(records), "with water:", sum(1 for r in records if r["view"]["water_visible_deg"] > 0), "open sea:", sum(1 for r in records if r["view"]["open_sea_visible"]), "rows:", sorted({r["row"] for r in records}), "| road", road["summary"], flush=True)
