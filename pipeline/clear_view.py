"""Clear the trees that stand in each house's sight line to the water.

Reads data/plots.json (with its horizon per degree) and data/road.json, and rewrites the cleared
flag in data/trees.json and site/public/data/trees.bin:

  - within 14 m of a house centre and 6.5 m of a road centreline (the terrace and the road), and
  - in the sector of the house's water bearings (plus 8 degrees each side) out to 120 m, every
    tree whose top rises above the terrain horizon seen from the living room (eye = floor + 1.6 m),
    that is, every tree that would stand in the view of the fjord.

Run   python pipeline/clear_view.py          (a few seconds; then re-render with relayout_v2.py)
"""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path

KN = Path(__file__).resolve().parent.parent
OUT = KN / "data"
PUB = KN / "site" / "public" / "data"

HOUSE_R = 14.0
ROAD_R = 6.5
VIEW_R = 120.0
VIEW_PAD = 8.0
MARGIN_DEG = 1.5

plots = json.loads((OUT / "plots.json").read_text(encoding="utf-8"))["plots"]
road = json.loads((OUT / "road.json").read_text(encoding="utf-8"))
tf = json.loads((OUT / "trees.json").read_text(encoding="utf-8"))
trees = tf["trees"]

# roads on a coarse grid
cell = 8.0
grid: dict[tuple[int, int], list[tuple[float, float]]] = {}
for s in road["segments"]:
    for pt in (s["from"], s["to"]):
        grid.setdefault((int(pt[0] // cell), int(pt[1] // cell)), []).append((pt[0], pt[1]))


def near_road(x, y):
    cx, cy = int(x // cell), int(y // cell)
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for (px, py) in grid.get((cx + i, cy + j), ()):
                if (px - x) ** 2 + (py - y) ** 2 <= ROAD_R * ROAD_R:
                    return True
    return False


def in_view(p, t):
    """Does tree t stand in the water view of plot p?"""
    wb = p["view"].get("water_bearings")
    if not wb:
        return False
    dx, dy = t["x"] - p["local"]["x"], t["y"] - p["local"]["y"]
    d = math.hypot(dx, dy)
    if d > VIEW_R or d < 1.0:
        return False
    bearing = (math.degrees(math.atan2(dx, dy)) + 360.0) % 360.0
    b0, b1 = wb[0] - VIEW_PAD, wb[1] + VIEW_PAD
    if not (b0 <= bearing <= b1):
        return False
    eye = p["local"]["z_floor"] + 1.6
    top = t["z"] + t["h"]
    ang = math.degrees(math.atan2(top - eye, d))
    hz = p["horizon_deg_by_bearing"][int(bearing) % 360]
    return ang > hz - MARGIN_DEG


n_pad = n_view = 0
for t in trees:
    x, y = t["x"], t["y"]
    c = False
    if -90 < x < 230 and -200 < y < 110:
        for p in plots:
            if (p["local"]["x"] - x) ** 2 + (p["local"]["y"] - y) ** 2 <= HOUSE_R * HOUSE_R:
                c = True
                break
        if not c and near_road(x, y):
            c = True
        if c:
            n_pad += 1
        elif any(in_view(p, t) for p in plots):
            c = True
            n_view += 1
    t["cleared"] = c
tf["cleared_count"] = n_pad + n_view
tf["note"] = "cleared = within 14 m of a house or 6.5 m of a road, plus every tree in a house's sight line to the water (water bearings plus 8 deg, out to 120 m, top above the terrain horizon from the living room)"
print(f"cleared {n_pad} trees for terraces and roads, {n_view} more in the sight lines, of {len(trees)}")

(OUT / "trees.json").write_text(json.dumps(tf), encoding="utf-8")
PUB.mkdir(parents=True, exist_ok=True)
(PUB / "trees.json").write_text(json.dumps(tf), encoding="utf-8")
SP = {"spruce": 0, "pine": 1, "birch": 2}
kept = sorted((t for t in trees if not t["cleared"]), key=lambda t: t["x"] ** 2 + t["y"] ** 2)
cleared = [t for t in trees if t["cleared"]]
with open(PUB / "trees.bin", "wb") as fh:
    for t in kept + cleared:
        fh.write(struct.pack("<8f", t["x"], t["y"], t["z"], t["h"], t["crown"], t["rot"], t["tint"], SP[t["species"]] + (10 if t["cleared"] else 0)))
(PUB / "trees.bin.json").write_text(json.dumps({"count": len(trees), "floats_per_tree": 8, "layout": "x y z h crown rot tint code; code = species(0 spruce,1 pine,2 birch) + 10 if cleared", "order": "kept trees first sorted by distance from origin, then cleared trees", "kept_count": len(kept)}), encoding="utf-8")
print("written trees.json and trees.bin")
