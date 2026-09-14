"""Knotten layout v4 (2026-09-14): the rows of the project owner's sketch, on the measured terrain.

The sketch (Sigve Simonsen, "Stigning på veien max 6%") shows four rows of detached houses across
the south face of Knotten, along one road that snakes up the hill with hairpins at alternating
ends, entered from the yard by Rødbergsveien. v3 scattered the houses by a greedy view score; v4
keeps its measurements (line of sight over the 1 m LiDAR, neighbours standing, real sun) but lays
the houses out the way the sketch does:

  row 1  the top row on the 74 m contour, plus three set-back houses on 76 m at the north-west corner
  row 2  the long row on the 66 m contour (ten houses, as in the sketch)
  row 3  the 58 m contour, on the stretch that sees open sea
  row 4  the south face of the lower knoll ("Knotten" on the maps), on the 48 m contour

Every house is placed 8 m below its row road, faces the middle of the water it sees, and is
re-checked with all other houses standing. Thirty houses, thirty plots, all on the hill, all with a
measured sea view. The flat by Rødbergsveien holds no plots (the project owner: no sea view there).

Roads: the row roads follow their contour; the links between rows (the west loop, the ramp up the
east gully, the sweep round the saddle, the access from the yard) are drawn as placeholders and
their true grades are reported in road.json, as before. Trees are cleared only around houses and
roads, not the whole parcel.

Inputs   ../source/*.f32, *.json, ../data/parcels.json, buildings.json, trees.json
Outputs  ../data/plots.json, road.json, clearing.json, trees.json (+ copies and trees.bin in site/public/data)
Run      python pipeline/plan_layout_v4.py
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
MIN_PITCH = 13.0          # 11 m house + 2 m between, as tight as the sketch draws them
SETBACK = 8.0             # house centre below the row road, along the fall line
EYE = 0.6 + 1.6           # floor over ground + living-room eye height

# the rows of the sketch, top to bottom: contour level, how many houses, and the stretch of the
# contour (a window in x and y) that is the row. Levels chosen from a map of every contour: where a
# house 8 m below the road is buildable (slope under 30 degrees, 12 m inside the boundary) and sees
# the sea over the LiDAR.
ROWS = [
    {"row": 1, "level": 78.0, "count": 3, "x": (-50, -8), "y": (60, 90), "note": "the three set-back houses at the north-west corner, as in the sketch"},
    {"row": 1, "level": 78.0, "count": 2, "x": (0, 40), "y": (55, 75), "note": "two houses on the top"},
    {"row": 2, "level": 72.0, "count": 6, "x": (-30, 53), "y": (30, 70)},
    {"row": 3, "level": 64.0, "count": 7, "x": (-55, 82), "y": (10, 60)},
    {"row": 4, "level": 58.0, "count": 5, "x": (-55, 88), "y": (4, 30), "note": "broken by the steep band in the middle, like the sketch's footpath gaps"},
    {"row": 5, "level": 52.0, "count": 4, "x": (-5, 75), "y": (-95, -59), "note": "the south face of the lower knoll"},
    {"row": 6, "level": 28.0, "count": 3, "x": (100, 126), "y": (-90, -45), "note": "the houses by the access road on the east flank, as the sketch has by the entrance"},
]
TOTAL = 30
assert sum(r["count"] for r in ROWS) <= TOTAL

OB = kt.OBSTACLES


def chain_in_window(level, xr, yr):
    """The longest stretch of the `level` contour inside the parcel, resampled every metre."""
    best = []
    for poly in kt.contour_polylines(level, xr[0] - 20, xr[1] + 20, yr[0] - 20, yr[1] + 20):
        pts = kt.resample(poly, 1.0)
        cur = []
        for (x, y) in pts:
            ok = xr[0] <= x <= xr[1] and yr[0] <= y <= yr[1] and kt.inside(kt.HILL, x, y) and kt.dist_to_edge(kt.HILL, x, y) >= 6
            if ok:
                cur.append((x, y))
            else:
                if len(cur) > len(best):
                    best = cur
                cur = []
        if len(cur) > len(best):
            best = cur
    # west to east
    if best and best[0][0] > best[-1][0]:
        best.reverse()
    return best


def house_below(x, y):
    """The house centre SETBACK metres down the fall line from a road point, or None if it is not buildable."""
    slope, aspect = kt.slope_aspect(x, y)
    ar = math.radians(aspect)
    hx, hy = x + SETBACK * math.sin(ar), y + SETBACK * math.cos(ar)
    if not kt.inside(kt.HILL, hx, hy) or kt.dist_to_edge(kt.HILL, hx, hy) < EDGE_MARGIN:
        return None
    if kt.near_building(hx, hy, 18.0):
        return None
    s2, a2 = kt.slope_aspect(hx, hy)
    if s2 > 30.0:
        return None
    return {"road_xy": (x, y), "x": hx, "y": hy, "z": kt.ground(hx, hy), "slope": s2, "aspect": a2}


def choose(cands, n):
    """The n candidates with the best view, at least MIN_PITCH apart along the row, by dynamic programming."""
    L = len(cands)
    score = [None if c is None or c["water"] == 0 else c["open_sea"] * 3 + c["water"] + 0.001 for c in cands]
    NEG = float("-inf")
    best = [[NEG] * (n + 1) for _ in range(L)]
    prev = [[-1] * (n + 1) for _ in range(L)]
    for i in range(L):
        if score[i] is None:
            continue
        best[i][1] = score[i]
        for k in range(2, n + 1):
            for j in range(0, i):
                if best[j][k - 1] == NEG:
                    continue
                if math.hypot(cands[i]["x"] - cands[j]["x"], cands[i]["y"] - cands[j]["y"]) < MIN_PITCH:
                    continue
                v = best[j][k - 1] + score[i]
                if v > best[i][k]:
                    best[i][k], prev[i][k] = v, j
    end = max(range(L), key=lambda i: best[i][n])
    if best[end][n] == NEG:
        return None
    picks, i, k = [], end, n
    while i >= 0 and k > 0:
        picks.append(cands[i])
        i, k = prev[i][k], k - 1
    return list(reversed(picks))


print("placing the rows of the sketch...", flush=True)
# first the capacity of every row (houses at least MIN_PITCH apart, each with water in view),
# then thirty houses shared out: each row its sketch count where it can, the rest to the rows
# with room, top rows first
row_cands = []
for spec in ROWS:
    chain = chain_in_window(spec["level"], spec["x"], spec["y"])
    if len(chain) < 2:
        raise SystemExit(f"no contour stretch for row {spec['row']} at {spec['level']} m")
    cands = []
    cache = {}
    for (x, y) in chain:
        h = house_below(x, y)
        if h is None:
            cands.append(None)
            continue
        key = (round(h["x"] / 3), round(h["y"] / 3))
        if key not in cache:
            cache[key] = kt.quick_view(h["x"], h["y"], h["z"] + EYE)
        h["water"], h["open_sea"] = cache[key]
        h.update({"row": spec["row"], "level": spec["level"], "zone": "hill", "spec": len(row_cands)})
        cands.append(h)
    cap = 0
    while choose(cands, cap + 1) is not None and cap < 14:
        cap += 1
    line = "".join("_" if c is None else ("O" if c["open_sea"] > 0 else ("w" if c["water"] > 0 else ".")) for c in cands)
    print(f"  row {spec['row']} at {spec['level']} m: room for {cap}, wanted {spec['count']}, chain {len(chain)} m from {tuple(round(v) for v in chain[0])} to {tuple(round(v) for v in chain[-1])}", flush=True)
    print("   ", line, flush=True)
    row_cands.append({"spec": spec, "cands": cands, "cap": cap, "n": min(cap, spec["count"])})
short = TOTAL - sum(r["n"] for r in row_cands)
for r in row_cands:
    while short > 0 and r["n"] < r["cap"]:
        r["n"] += 1
        short -= 1
if short > 0:
    raise SystemExit(f"the rows can seat only {TOTAL - short} houses with a sea view; widen a window or add a row")

plots = []
for si, r in enumerate(row_cands):
    spec, n = r["spec"], r["n"]
    picks = choose(r["cands"], n)
    for p in picks:
        p.update({"row": spec["row"], "level": spec["level"], "zone": "hill", "spec": si})
        plots.append(p)
        OB.append((p["x"], p["y"], 7.0, p["z"] + 0.6 + HOUSE["ridge"]))
    print(f"  row {spec['row']} at {spec['level']} m: {n} houses, x {picks[0]['x']:.0f}..{picks[-1]['x']:.0f}, open sea {sum(1 for p in picks if p['open_sea'] > 0)}/{n}", flush=True)

plots.sort(key=lambda p: (p["row"], p["x"]))
for i, p in enumerate(plots):
    p["id"] = f"plot-{i + 1:02d}"
if "--dry" in sys.argv:
    for p in plots:
        print(" ", p["id"], "row", p["row"], "level", p["level"], "at", round(p["x"], 1), round(p["y"], 1), "z", round(p["z"], 1), "water", p["water"], "open", p["open_sea"])
    for spec in ROWS:
        ch = chain_in_window(spec["level"], spec["x"], spec["y"])
        print("  chain", spec["level"], "from", tuple(round(v) for v in ch[0]), "to", tuple(round(v) for v in ch[-1]), len(ch), "m")
    raise SystemExit("dry run: placement only")

# ------------------------------------------------------- full evidence per plot
print("full horizon, view and sun per plot (neighbours standing)...", flush=True)
DATES = {"dec21": (12, 21), "mar21": (3, 21), "jun21": (6, 21)}


def record_for(p):
    g = p["z"]
    floor = g + 0.6
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
    s = math.tan(math.radians(p["slope"]))
    cutfill = round(0.5 * HOUSE["w"] * HOUSE["d"] * (HOUSE["d"] * s) / 2, 1)
    rec = {
        "id": p["id"], "row": p["row"], "zone": p["zone"],
        "local": {"x": round(p["x"], 2), "y": round(p["y"], 2), "z_ground": round(g, 2), "z_floor": round(floor, 2)},
        **geo,
        "house": {"width_m": HOUSE["w"], "depth_m": HOUSE["d"], "facing_deg": round(facing, 1), "eaves_m": HOUSE["eaves"], "ridge_m": HOUSE["ridge"], "storeys": 1.5},
        "terrain": {"slope_deg": round(p["slope"], 1), "aspect_deg": round(p["aspect"], 1), "level_pad_cutfill_m3": cutfill, "dist_to_boundary_m": round(kt.dist_to_edge(kt.HILL, p["x"], p["y"]), 1)},
        "view": {"water_visible_deg": len(sea_b), "water_bearings": [sea_b[0], sea_b[-1]] if sea_b else None, "open_sea_visible": bool(open_b), "open_sea_deg": len(open_b), "farthest_water_m": max(water), "checked_with_neighbours": True},
        "sun": sun,
        "horizon_deg_by_bearing": hz,
        "status": "provisional",
    }
    print(" ", p["id"], "row", p["row"], "z", round(g, 1), "water", len(sea_b), "open sea", bool(open_b), "sun dec", sun["dec21"]["hours"], flush=True)
    return rec


records = [record_for(p) for p in plots]

# the quick score is coarse; with every house standing a few plots at the row ends can lose the
# water. Those are dropped and replaced by the best remaining candidate that passes the same full
# check, until all thirty stand with a view.
pool = [c for r in row_cands for c in r["cands"] if c is not None and c["water"] > 0]
# and a wider pool: every other contour of the parcel, and the low contours of the east flank
def row_for_level(lv):
    return 1 if lv >= 76 else 2 if lv >= 66 else 3 if lv >= 60 else 4 if lv >= 54 else 5 if lv >= 44 else 6
EXTRA = [(lv, (-60, 135), (-95, 90)) for lv in (46, 48, 50, 54, 56, 60, 62, 68, 70, 74, 76)] + [(lv, (100, 150), (-95, -45)) for lv in (16, 20, 24, 32)]
cache = {}
for lv, xr, yr in EXTRA:
    for poly in kt.contour_polylines(lv, xr[0] - 20, xr[1] + 20, yr[0] - 20, yr[1] + 20):
        for (x, y) in kt.resample(poly, 3.0):
            if not (xr[0] <= x <= xr[1] and yr[0] <= y <= yr[1] and kt.inside(kt.HILL, x, y) and kt.dist_to_edge(kt.HILL, x, y) >= 6):
                continue
            h = house_below(x, y)
            if h is None:
                continue
            key = (round(h["x"] / 3), round(h["y"] / 3))
            if key not in cache:
                cache[key] = kt.quick_view(h["x"], h["y"], h["z"] + EYE)
            h["water"], h["open_sea"] = cache[key]
            if h["water"] == 0:
                continue
            h.update({"row": row_for_level(lv), "level": float(lv), "zone": "hill", "spec": -1})
            pool.append(h)
print("  refill pool:", len(pool), "candidates", flush=True)
pool.sort(key=lambda c: -(c["open_sea"] * 3 + c["water"]))
tried = set()
for _round in range(8):
    blind = [i for i, r in enumerate(records) if r["view"]["water_visible_deg"] == 0]
    if not blind:
        break
    for i in sorted(blind, reverse=True):
        p = plots.pop(i)
        records.pop(i)
        tried.add((round(p["x"], 1), round(p["y"], 1)))
        OB[:] = [o for o in OB if not (abs(o[0] - p["x"]) < 0.01 and abs(o[1] - p["y"]) < 0.01)]
        print(f"  dropped {p['id']} at ({p['x']:.0f}, {p['y']:.0f}): no water with the neighbours standing", flush=True)
    need = TOTAL - len(plots)
    for c in pool:
        if need == 0:
            break
        key = (round(c["x"], 1), round(c["y"], 1))
        if key in tried:
            continue
        if any(math.hypot(c["x"] - q["x"], c["y"] - q["y"]) < MIN_PITCH for q in plots):
            continue
        tried.add(key)
        cand = dict(c)
        cand["id"] = "plot-new"
        OB.append((cand["x"], cand["y"], 7.0, cand["z"] + 0.6 + HOUSE["ridge"]))
        rec = record_for(cand)
        if rec["view"]["water_visible_deg"] < 4:
            OB[:] = [o for o in OB if not (abs(o[0] - cand["x"]) < 0.01 and abs(o[1] - cand["y"]) < 0.01)]
            continue
        plots.append(cand)
        records.append(rec)
        need -= 1
        print(f"  added a house in row {cand['row']} at ({cand['x']:.0f}, {cand['y']:.0f}) with {rec['view']['water_visible_deg']} degrees of water", flush=True)
    if need > 0:
        raise SystemExit(f"only {len(plots)} houses with a sea view can stand; widen a window or add a row")
blind = [r["id"] for r in records if r["view"]["water_visible_deg"] == 0]
if blind:
    raise SystemExit(f"still blind after refilling: {blind}")
order = sorted(range(len(plots)), key=lambda i: (plots[i]["row"], plots[i]["x"]))
plots = [plots[i] for i in order]
records = [records[i] for i in order]
for i, (p, r) in enumerate(zip(plots, records)):
    p["id"] = r["id"] = f"plot-{i + 1:02d}"

# ------------------------------------------------------------------ roads
print("roads...", flush=True)
ENTRANCE = (204.0, -66.0)


def along(chain, a, b, pad=10.0):
    """The part of a 1 m chain between the road points of houses a and b, padded at both ends."""
    ia = min(range(len(chain)), key=lambda i: math.hypot(chain[i][0] - a[0], chain[i][1] - a[1]))
    ib = min(range(len(chain)), key=lambda i: math.hypot(chain[i][0] - b[0], chain[i][1] - b[1]))
    lo, hi = sorted((ia, ib))
    lo = max(0, lo - int(pad))
    hi = min(len(chain) - 1, hi + int(pad))
    return [chain[i] for i in range(lo, hi + 1, 3)] + [chain[hi]]


row_roads = []
R = {}
for si, spec in enumerate(ROWS):
    chain = chain_in_window(spec["level"], spec["x"], spec["y"])
    # the row serves its own houses and any house the refill put within reach of its contour
    def served(p):
        return p["spec"] == si or (p["spec"] == -1 and min(math.hypot(p["road_xy"][0] - q[0], p["road_xy"][1] - q[1]) for q in chain[::4]) < 14.0)
    members = sorted((p for p in plots if served(p)), key=lambda p: p["x"])
    if not members:
        pts = chain[:: 3] + [chain[-1]]
    else:
        pts = along(chain, members[0]["road_xy"], members[-1]["road_xy"])
    R[si] = [(round(x, 2), round(y, 2)) for x, y in pts]
    row_roads.append({"row": spec["row"], "level": spec["level"], "pts": R[si]})

r1a, r1b, r2, r3, r4, r5, r6 = (R[i] for i in range(6 + 1))


def bridge(a, b, *via):
    """A placeholder link from point a through the waypoints to point b, sampled every 4 m."""
    pts = [a, *via, b]
    out = []
    for p, q in zip(pts, pts[1:]):
        out += kt.resample([p, q], 4.0)
    out.append(b)
    return out


def off(p, dx, dy):
    return (p[0] + dx, p[1] + dy)


# one road from the top row down to the yard, snaking with hairpins at alternating ends, as the sketch draws it
links = [
    ("top-1", bridge(r1a[-1], r1b[0], off(r1a[-1], 6, -2), off(r1b[0], -6, 3))),                           # across the top, the two stretches of row 1
    ("loop-east-1-2", bridge(r1b[-1], r2[-1], off(r1b[-1], 10, 2), off(r2[-1], 8, 4))),                     # hairpin at the east end
    ("loop-west-2-3", bridge(r2[0], r3[0], off(r2[0], -10, 2), off(r3[0], -4, 5))),                         # hairpin at the west end
    ("loop-east-3-4", bridge(r3[-1], r4[-1], off(r3[-1], 8, 3), off(r4[-1], 4, -6))),                       # hairpin at the east end, up the gully
    ("sweep-west-4-5", bridge(r4[0], r5[0], off(r4[0], -4, -6), (-55.0, 16.0), (-52.0, 4.0), (-44.0, -10.0), (-32.0, -24.0), (-18.0, -34.0), (-16.0, -46.0), (-12.0, -56.0), off(r5[0], -4, 2))),  # round the saddle to the lower knoll
    ("access", bridge(r5[-1], ENTRANCE, off(r5[-1], 6, 4), (78.0, -46.0), (90.0, -38.0), (102.0, -33.0), (114.0, -34.0), (124.0, -40.0), (134.0, -52.0), (140.0, -66.0), (144.0, -80.0), (146.0, -92.0), (152.0, -90.0), (156.0, -76.0), (160.0, -62.0), (168.0, -64.0), (186.0, -72.0))),  # the east flank down to the yard by Rødbergsveien, past the last house
]


def road_profile(pts):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 0.5:
            continue
        z0, z1 = kt.ground(x0, y0), kt.ground(x1, y1)
        grade = (z1 - z0) / L * 100
        out.append({"from": [round(x0, 1), round(y0, 1), round(z0, 1)], "to": [round(x1, 1), round(y1, 1), round(z1, 1)], "length_m": round(L, 1), "grade_pct": round(grade, 1), "ok_6pct": abs(grade) <= 6.0})
    return out


road = {"entrance": ENTRANCE, "entrance_z": round(kt.ground(*ENTRANCE), 1), "rows": row_roads, "ramps": [], "segments": []}
for rr in row_roads:
    road["segments"] += road_profile(rr["pts"])
for name, pts in links:
    prof = road_profile(pts)
    dz = abs(kt.ground(*pts[-1]) - kt.ground(*pts[0]))
    L = sum(s["length_m"] for s in prof)
    road["ramps"].append({"id": name, "pts": [(round(x, 2), round(y, 2)) for x, y in pts], "climb_m": round(dz, 1), "length_m": round(L, 1),
                          "length_needed_at_6pct_m": round(dz / 0.06, 1), "feasible_straight": L >= dz / 0.06, "placeholder": True})
    road["segments"] += prof
bad = [s for s in road["segments"] if not s["ok_6pct"]]
road["summary"] = {
    "total_length_m": round(sum(s["length_m"] for s in road["segments"]), 1),
    "segments_over_6pct": len(bad),
    "worst_grade_pct": round(max((abs(s["grade_pct"]) for s in road["segments"]), default=0), 1),
    "note": "Row roads follow their contour and are level, as the sketch draws them. The links between rows and the access from the yard are placeholders drawn on the terrain; each states its climb and the length a 6 % road needs. The regulation plan sizes the hairpins.",
}
for r in road["ramps"]:
    print(f"  {r['id']}: {r['length_m']} m, climb {r['climb_m']} m, needs {r['length_needed_at_6pct_m']} m at 6 %", flush=True)

# --------------------------------------------------------------- clearing
print("clearing the forest around houses and roads...", flush=True)
HOUSE_R = 14.0
ROAD_R = 6.5
road_pts = []
for rr in row_roads:
    road_pts += kt.resample(rr["pts"], 3.0)
for _, pts in links:
    road_pts += kt.resample(pts, 3.0)
# a coarse grid over the road points so 31 823 trees are tested quickly
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
tf["note"] = "cleared = within 14 m of a house centre or 6.5 m of a road centreline (layout v4); the rest of the forest stays"
print("  trees cleared:", n_cleared, "of", len(trees), flush=True)

# ----------------------------------------------------------------- write
(OUT / "plots.json").write_text(json.dumps({
    "crs_note": "local: metres, x=east, y=north, z=height above sea level (Kartverket DTM); origin = 58.068057N 7.278401E. UTM zone 32N (EPSG:25832) also given.",
    "assumptions": {
        "layout": "Provisional v4 (2026-09-14): the rows of the project owner's sketch on the measured terrain, inside parcel 355/10. Row 1 on the 74 m contour (plus three set-back houses at 76 m), row 2 on 66 m, row 3 on 58 m, row 4 on the south face of the lower knoll at 48 m. Every house 8 m below its row road, facing the water it sees, re-checked with all other houses standing. Thirty plots, all on the hill with a measured sea view; none on the flat by Rødbergsveien. Replace with the regulation plan when it exists.",
        "sun": "Terrain shading only (field cleared around the houses, no shading between houses). Eye = floor + 1.6 m, floor = ground + 0.6 m. 0.25 deg solar-disc margin. Times in CET.",
        "view": "Water counted where the line of sight reaches a sea-level cell; 'open sea' = water beyond 7 km. Refraction k = 1.17. Neighbouring houses (ridge 5.6 m) included as obstacles.",
        "cutfill": "Order-of-magnitude for a level pad under the footprint only.",
    },
    "plots": records,
}, indent=1), encoding="utf-8")
(OUT / "road.json").write_text(json.dumps(road, indent=1), encoding="utf-8")
(OUT / "clearing.json").write_text(json.dumps({
    "polygon_local": [[round(x, 1), round(y, 1)] for x, y in kt.HILL],
    "note": "Layout v4 clears only around the houses (14 m) and the roads (6.5 m); trees.json carries the flag per tree. The polygon is the hill parcel, kept for reference.",
    "house_radius_m": HOUSE_R, "road_radius_m": ROAD_R,
}, indent=1), encoding="utf-8")
(OUT / "trees.json").write_text(json.dumps(tf), encoding="utf-8")

PUB.mkdir(parents=True, exist_ok=True)
for f in ("plots.json", "road.json", "clearing.json", "trees.json"):
    shutil.copy2(OUT / f, PUB / f)

# the compact binary the website streams: 8 floats per tree, kept trees first by distance, then cleared
SP = {"spruce": 0, "pine": 1, "birch": 2}
kept = sorted((t for t in trees if not t["cleared"]), key=lambda t: t["x"] ** 2 + t["y"] ** 2)
cleared = [t for t in trees if t["cleared"]]
with open(PUB / "trees.bin", "wb") as fh:
    for t in kept + cleared:
        fh.write(struct.pack("<8f", t["x"], t["y"], t["z"], t["h"], t["crown"], t["rot"], t["tint"], SP[t["species"]] + (10 if t["cleared"] else 0)))
(PUB / "trees.bin.json").write_text(json.dumps({"count": len(trees), "floats_per_tree": 8, "layout": "x y z h crown rot tint code; code = species(0 spruce,1 pine,2 birch) + 10 if cleared", "order": "kept trees first sorted by distance from origin, then cleared trees", "kept_count": len(kept)}), encoding="utf-8")

hill = records
print("DONE. plots:", len(hill), "with water:", sum(1 for r in hill if r["view"]["water_visible_deg"] > 0), "open sea:", sum(1 for r in hill if r["view"]["open_sea_visible"]), "| road", road["summary"], flush=True)
