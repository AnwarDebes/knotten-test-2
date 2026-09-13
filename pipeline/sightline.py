"""Sea-view analysis from Knotten: which bearings reach water, and how far.

Terrain is sampled from the finest grid available at each range:
  0-500 m     Kartverket LiDAR 1 m
  0.5-4 km    terrarium 20 m
  4-15 km     terrarium 80 m
"""
from __future__ import annotations

import array
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
tinfo = json.loads((OUT / "kv_terrain.json").read_text(encoding="utf-8"))
sur = json.loads((OUT / "surround_elevation.json").read_text(encoding="utf-8"))
hor = json.loads((OUT / "horizon_elevation.json").read_text(encoding="utf-8"))

RES, HALF, STEP = tinfo["res"], tinfo["half_m"], tinfo["step_m"]
DTM = array.array("f")
DTM.fromfile(open(OUT / "kv_terrain.f32", "rb"), RES * RES)


def grid_sampler(rows, half):
    h = len(rows)
    w = len(rows[0])
    dx = 2 * half / (w - 1)
    dy = 2 * half / (h - 1)

    def f(x, y):
        fx = (x + half) / dx
        fy = (half - y) / dy
        if fx < 0 or fy < 0 or fx >= w - 1 or fy >= h - 1:
            return None
        i, j = int(fx), int(fy)
        tx, ty = fx - i, fy - j
        a = rows[j][i] + (rows[j][i + 1] - rows[j][i]) * tx
        b = rows[j + 1][i] + (rows[j + 1][i + 1] - rows[j + 1][i]) * tx
        return a + (b - a) * ty
    return f


sample_sur = grid_sampler(sur["rows_north_to_south"], sur["half_m"])
sample_hor = grid_sampler(hor["rows_north_to_south"], hor["half_m"])


def sample_lidar(x, y):
    fx = (x + HALF) / STEP
    fy = (HALF - y) / STEP
    if fx < 0 or fy < 0 or fx >= RES - 1 or fy >= RES - 1:
        return None
    i, j = int(fx), int(fy)
    tx, ty = fx - i, fy - j
    r0 = j * RES + i
    v = [DTM[r0], DTM[r0 + 1], DTM[r0 + RES], DTM[r0 + RES + 1]]
    v = [0.0 if q < 0 else q for q in v]           # river cells -> water level
    a = v[0] + (v[1] - v[0]) * tx
    b = v[2] + (v[3] - v[2]) * tx
    return a + (b - a) * ty


def elev(x, y):
    for f in (sample_lidar, sample_sur, sample_hor):
        v = f(x, y)
        if v is not None:
            return max(v, 0.0)
    return 0.0


EARTH_R = 6371000.0 * 1.17     # effective radius incl. standard refraction


def trace(ox, oy, oz, bearing_deg, max_range=15000.0, step=8.0):
    """Walk one bearing; return (max_dist_water_visible, list of (dist, visible, is_water))."""
    b = math.radians(bearing_deg)
    sx, sy = math.sin(b), math.cos(b)
    best = -math.inf
    farthest_water = 0.0
    nearest_water = None
    water_run = 0.0
    prev_visible_water = False
    d = step
    while d <= max_range:
        x, y = ox + sx * d, oy + sy * d
        z = elev(x, y)
        drop = d * d / (2 * EARTH_R)
        ang = math.atan2(z - drop - oz, d)
        visible = ang >= best - 1e-9
        if visible:
            best = ang
        is_water = z <= 0.3 and d > 60
        if visible and is_water:
            farthest_water = d
            if nearest_water is None:
                nearest_water = d
            water_run += step
        d += step
    return nearest_water, farthest_water, water_run, math.degrees(best)


# observer: highest LiDAR point within 80 m of the given coordinate
top, tx_, ty_ = -1, 0, 0
for y in range(-80, 81, 2):
    for x in range(-80, 81, 2):
        z = sample_lidar(x, y)
        if z is not None and z > top:
            top, tx_, ty_ = z, x, y
print(f"knoll top: {top:.1f} m at ({tx_}, {ty_}) from the coordinate")

results = {}
for label, eye in (("standing_2m", 2.0), ("first_floor_5m", 5.0)):
    rows = []
    for bearing in range(90, 271):
        near, far, run, hz = trace(tx_, ty_, top + eye, bearing)
        rows.append({"bearing": bearing, "nearest_water_m": near,
                     "farthest_water_m": round(far), "water_run_m": round(run),
                     "horizon_deg": round(hz, 2)})
    results[label] = rows
    sea = [r for r in rows if r["farthest_water_m"] >= 7000]
    fjord = [r for r in rows if r["farthest_water_m"] >= 1500]
    print(f"{label}: bearings with water >= 1.5 km visible: "
          f"{[r['bearing'] for r in fjord][:1]}..{[r['bearing'] for r in fjord][-1:]} "
          f"({len(fjord)} deg); open sea (>= 7 km): {len(sea)} deg "
          f"{[r['bearing'] for r in sea][:1]}..{[r['bearing'] for r in sea][-1:]}; "
          f"max distance {max(r['farthest_water_m'] for r in rows)} m")

(OUT / "sightline.json").write_text(json.dumps({
    "observer": {"x": tx_, "y": ty_, "ground_m": round(top, 2)},
    "results": results,
}), encoding="utf-8")

# panorama strip: bearing on x, colour = how far the visible water reaches
W, H = 181 * 5, 120
img = Image.new("RGB", (W, H * 2 + 30), (250, 250, 250))
dr = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("arial.ttf", 12)
except Exception:
    font = ImageFont.load_default()
for k, (label, rows) in enumerate(results.items()):
    y0 = k * (H + 15)
    for r in rows:
        x = (r["bearing"] - 90) * 5
        far = r["farthest_water_m"]
        if far >= 7000:
            col = (20, 70, 200)
        elif far >= 1500:
            col = (90, 150, 230)
        elif far > 0:
            col = (170, 205, 240)
        else:
            col = (200, 200, 190)
        dr.rectangle((x, y0 + 14, x + 5, y0 + H), fill=col)
    dr.text((4, y0), f"{label}: dark = open sea >=7 km, mid = fjord >=1.5 km, light = near water",
            fill=(0, 0, 0), font=font)
    for b in range(90, 271, 30):
        dr.text(((b - 90) * 5, y0 + H + 1), f"{b}°", fill=(0, 0, 0), font=font)
img.save(OUT / "sightline_panorama.png")
print("saved sightline.json + sightline_panorama.png")
