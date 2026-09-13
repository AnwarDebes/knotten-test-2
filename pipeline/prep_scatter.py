"""Derive 3D vegetation and building colours from the real aerial photo.

Forest is classified per 5.5 m cell straight from the Esri imagery (green-dominant and
dark = canopy, bright green = pasture), then filtered against OSM water, buildings and
roads so nothing gets planted on a roof or in the river.
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent
meta = json.loads((OUT / "area_meta.json").read_text(encoding="utf-8"))
scene = json.loads((OUT / "scene_data.json").read_text(encoding="utf-8"))
img = Image.open(OUT / "satellite.png").convert("RGB")
W, H = img.size
PX = img.load()
HALF = meta["size_m"][0] / 2.0
STEP = 5.5
rng = random.Random(20260904)


def xy_to_px(x, y):
    u = (x + HALF) / (2 * HALF)
    v = (HALF - y) / (2 * HALF)
    return (min(W - 1, max(0, int(u * (W - 1)))),
            min(H - 1, max(0, int(v * (H - 1)))))


def patch_rgb(x, y, half_px=3):
    px, py = xy_to_px(x, y)
    r = g = b = n = 0
    for j in range(max(0, py - half_px), min(H, py + half_px + 1)):
        for i in range(max(0, px - half_px), min(W, px + half_px + 1)):
            pr, pg, pb = PX[i, j]
            r += pr; g += pg; b += pb; n += 1
    return (r / n / 255.0, g / n / 255.0, b / n / 255.0)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def bbox(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside


class Mask:
    """Rings with bbox pre-filter."""

    def __init__(self, rings, grow=0.0):
        self.items = []
        for r in rings:
            if len(r) < 3:
                continue
            x0, y0, x1, y1 = bbox(r)
            self.items.append((x0 - grow, y0 - grow, x1 + grow, y1 + grow, r))

    def hit(self, x, y):
        for x0, y0, x1, y1, r in self.items:
            if x0 <= x <= x1 and y0 <= y <= y1 and point_in_ring(x, y, r):
                return True
        return False


water_mask = Mask(scene["water"])
build_mask = Mask([b["ring"] for b in scene["buildings"]], grow=6.0)
wet_mask = Mask(scene["wetland"])
farm_mask = Mask(scene["farmland"])
forest_mask = Mask(scene["forests"])

ROAD_CLEAR = {"primary": 9.0, "secondary": 8.0, "unclassified": 6.0, "residential": 6.0,
              "service": 5.0, "track": 4.5, "path": 2.5, "footway": 2.5, "cycleway": 3.5}
road_segments = []
for r in scene["roads"] + scene["streams"]:
    clear = ROAD_CLEAR.get(r["type"], 4.0)
    pts = r["pts"]
    for a, b in zip(pts, pts[1:]):
        road_segments.append((a, b, clear))


def near_road(x, y):
    for (ax, ay), (bx, by), clear in road_segments:
        if min(ax, bx) - clear > x or max(ax, bx) + clear < x:
            continue
        if min(ay, by) - clear > y or max(ay, by) + clear < y:
            continue
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
        if math.hypot(x - (ax + dx * t), y - (ay + dy * t)) < clear:
            return True
    return False


# ------------------------------------------------------------ tree scatter
trees = []
canopy_hits = grass_hits = 0
steps = int(2 * HALF / STEP)
for iy in range(steps):
    for ix in range(steps):
        x = -HALF + (ix + 0.5) * STEP + rng.uniform(-STEP * 0.42, STEP * 0.42)
        y = -HALF + (iy + 0.5) * STEP + rng.uniform(-STEP * 0.42, STEP * 0.42)
        r, g, b = patch_rgb(x, y, 2)
        mx = max(r, g, b)
        mn = min(r, g, b)
        green = g - (r + b) / 2.0
        val = (r + g + b) / 3.0
        sat = 0.0 if mx == 0 else (mx - mn) / mx
        in_forest_poly = forest_mask.hit(x, y)
        # canopy: green-dominant and dark; pasture/field is green but much brighter
        canopy = (green > 0.02 and val < 0.30 and sat > 0.15) or (in_forest_poly and val < 0.42)
        if not canopy:
            grass_hits += 1
            continue
        if water_mask.hit(x, y) or build_mask.hit(x, y) or near_road(x, y):
            continue
        canopy_hits += 1
        wet = wet_mask.hit(x, y)
        # darker, bluer canopy -> spruce; lighter/warmer -> pine or birch
        if val < 0.16:
            species, h = "spruce", rng.uniform(14.0, 23.0)
        elif green > 0.05 and val > 0.24:
            species, h = "birch", rng.uniform(8.0, 14.0)
        else:
            species, h = "pine", rng.uniform(11.0, 18.0)
        if wet:
            h *= 0.65
        trees.append({
            "xy": [round(x, 2), round(y, 2)],
            "h": round(h, 2),
            "species": species,
            "rot": round(rng.uniform(0, math.tau), 3),
            "tilt": round(rng.uniform(0, 0.05), 3),
            "tint": round(rng.uniform(-0.25, 0.25), 3),
            "rgb": [round(srgb_to_linear(c), 4) for c in (r, g, b)],
        })

# --------------------------------------------------- building roof colours
for b in scene["buildings"]:
    cx, cy, w, d, ang = b["obb"]
    ca, sa = math.cos(ang), math.sin(ang)
    samples = []
    for u in (-0.28, 0.0, 0.28):
        for v in (-0.22, 0.0, 0.22):
            lx, ly = u * w, v * d
            samples.append(patch_rgb(cx + lx * ca - ly * sa, cy + lx * sa + ly * ca, 1))
    n = len(samples)
    avg = [sum(s[i] for s in samples) / n for i in range(3)]
    # aerial pixels sit in shade/haze; lift a little so the roof reads at ground level
    lifted = [min(1.0, c * 1.25 + 0.02) for c in avg]
    b["roof_rgb"] = [round(srgb_to_linear(c), 4) for c in lifted]
    mx, mn = max(avg), min(avg)
    b["roof_reddish"] = bool(avg[0] - (avg[1] + avg[2]) / 2 > 0.05)
    b["roof_bright"] = bool((mx + mn) / 2 > 0.45)

scatter = {"trees": trees, "step_m": STEP,
           "stats": {"canopy_cells": canopy_hits, "open_cells": grass_hits,
                     "tree_count": len(trees)}}
(OUT / "scatter.json").write_text(json.dumps(scatter), encoding="utf-8")
(OUT / "scene_data.json").write_text(json.dumps(scene), encoding="utf-8")

by_species = {}
for t in trees:
    by_species[t["species"]] = by_species.get(t["species"], 0) + 1
print("trees:", len(trees), by_species)
print("canopy cells:", canopy_hits, "open cells:", grass_hits)
print("sample roof colours:", [(b["type"], b["roof_rgb"]) for b in scene["buildings"][:6]])
