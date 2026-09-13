"""Turn Kartverket's 1 m DTM/DOM into scene-ready terrain, real trees and real roofs.

Outputs (scene-local metres, x=east, y=north, origin at the tile centre):
  kv_terrain.f32 / kv_terrain.json - bare-earth grid resampled to the scene axes
  kv_trees.json                    - one entry per detected treetop: position, height, crown
  kv_roofs.json                    - per building: 1 m surface-model heights inside the footprint
"""
from __future__ import annotations

import array
import json
import math
import struct
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent
meta = json.loads((OUT / "area_meta.json").read_text(encoding="utf-8"))
kv = json.loads((OUT / "kv_meta.json").read_text(encoding="utf-8"))
scene = json.loads((OUT / "scene_data.json").read_text(encoding="utf-8"))

LAT, LON = meta["center"]["lat"], meta["center"]["lon"]
M_LAT, M_LON = meta["m_per_deg"]["lat"], meta["m_per_deg"]["lon"]
HALF = meta["size_m"][0] / 2.0
KW, KH = kv["width"], kv["height"]
E_MIN, N_MAX = kv["east_min"], kv["north_max"]
PIX = kv["pixel_m"]

dtm = array.array("f")
dtm.fromfile(open(OUT / "kv_dtm.f32", "rb"), KW * KH)
dom = array.array("f")
dom.fromfile(open(OUT / "kv_dom.f32", "rb"), KW * KH)

# ------------------------------------------------------ WGS84 -> UTM 32N
A, F = 6378137.0, 1 / 298.257223563
E2 = F * (2 - F)
EP2 = E2 / (1 - E2)
K0, LON0, FE = 0.9996, math.radians(9.0), 500000.0


def to_utm32(lat_deg, lon_deg):
    phi, lam = math.radians(lat_deg), math.radians(lon_deg)
    sp, cp, tp = math.sin(phi), math.cos(phi), math.tan(phi)
    N = A / math.sqrt(1 - E2 * sp * sp)
    T, C = tp * tp, EP2 * cp * cp
    Aa = (lam - LON0) * cp
    M = A * ((1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256) * phi
             - (3 * E2 / 8 + 3 * E2**2 / 32 + 45 * E2**3 / 1024) * math.sin(2 * phi)
             + (15 * E2**2 / 256 + 45 * E2**3 / 1024) * math.sin(4 * phi)
             - (35 * E2**3 / 3072) * math.sin(6 * phi))
    east = FE + K0 * N * (Aa + (1 - T + C) * Aa**3 / 6
                          + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa**5 / 120)
    north = K0 * (M + N * tp * (Aa**2 / 2 + (5 - T + 9 * C + 4 * C * C) * Aa**4 / 24
                                + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa**6 / 720))
    return east, north


def scene_to_utm(x, y):
    return to_utm32(LAT + y / M_LAT, LON + x / M_LON)


# The scene->UTM map is conformal and nearly affine over 1 km; fit it and check.
e0, n0 = scene_to_utm(0.0, 0.0)
ex, nx = scene_to_utm(1000.0, 0.0)
ey, ny = scene_to_utm(0.0, 1000.0)
AE = ((ex - e0) / 1000.0, (ey - e0) / 1000.0, e0)
AN = ((nx - n0) / 1000.0, (ny - n0) / 1000.0, n0)


def affine(x, y):
    return AE[0] * x + AE[1] * y + AE[2], AN[0] * x + AN[1] * y + AN[2]


worst = 0.0
for tx in (-HALF, 0, HALF):
    for ty in (-HALF, 0, HALF):
        ee, nn = scene_to_utm(tx, ty)
        ae, an = affine(tx, ty)
        worst = max(worst, math.hypot(ee - ae, nn - an))
print(f"affine fit residual: {worst * 100:.2f} cm  (grid convergence "
      f"{math.degrees(math.atan2(AE[1], AN[1])):.3f} deg)")


def sample(grid, x, y):
    """Bilinear sample of a UTM raster at scene coordinates; None outside/nodata."""
    e, n = affine(x, y)
    fc = (e - E_MIN) / PIX
    fr = (N_MAX - n) / PIX
    if fc < 0 or fr < 0 or fc >= KW - 1 or fr >= KH - 1:
        return None
    c, r = int(fc), int(fr)
    tx, ty = fc - c, fr - r
    i = r * KW + c
    v00, v10 = grid[i], grid[i + 1]
    v01, v11 = grid[i + KW], grid[i + KW + 1]
    if 0.0 in (v00, v10, v01, v11):        # nodata (water) - do not blend it
        vals = [v for v in (v00, v10, v01, v11) if v != 0.0]
        return sum(vals) / len(vals) if vals else 0.0
    a = v00 + (v10 - v00) * tx
    b = v01 + (v11 - v01) * tx
    return a + (b - a) * ty


def sample_nn(grid, x, y):
    """Nearest-neighbour sample - keeps roof planes and ridges crisp."""
    e, n = affine(x, y)
    c = int(round((e - E_MIN) / PIX))
    r = int(round((N_MAX - n) / PIX))
    if c < 0 or r < 0 or c >= KW or r >= KH:
        return None
    v = grid[r * KW + c]
    return None if v == 0.0 else v


# ------------------------------------------------- terrain on scene axes
RES = 1000                       # 1 m posts across the 1 km tile
step = (2 * HALF) / (RES - 1)
terrain = array.array("f", [0.0]) * (RES * RES)
water_cells = 0
for j in range(RES):
    y = HALF - j * step
    row = j * RES
    for i in range(RES):
        v = sample(dtm, -HALF + i * step, y)
        if v is None:
            v = 0.0
        if v <= 0.05:            # LiDAR gives no ground return on water
            v = -0.6
            water_cells += 1
        terrain[row + i] = v
with open(OUT / "kv_terrain.f32", "wb") as fh:
    terrain.tofile(fh)
finite = [v for v in terrain if v > -0.5]
(OUT / "kv_terrain.json").write_text(json.dumps({
    "res": RES, "step_m": step, "half_m": HALF,
    "min": min(finite), "max": max(finite),
    "water_cells": water_cells,
    "source": kv["source"],
}), encoding="utf-8")
print(f"terrain {RES}x{RES} @ {step:.2f} m, {min(finite):.1f}..{max(finite):.1f} m, "
      f"{water_cells} water cells")

# ------------------------------------------------------- building masks
def bbox(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y):
            if x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
                inside = not inside
        j = i
    return inside


buildings = [b for b in scene["buildings"]
             if all(abs(p[0]) <= HALF and abs(p[1]) <= HALF for p in b["ring"])]
bmasks = [(bbox(b["ring"]), b["ring"]) for b in buildings]


def on_building(x, y, grow=2.5):
    for (x0, y0, x1, y1), ring in bmasks:
        if x0 - grow <= x <= x1 + grow and y0 - grow <= y <= y1 + grow:
            if in_ring(x, y, ring):
                return True
    return False


# ------------------------------------------------- treetop detection (CHM)
aerial = Image.open(OUT / "satellite.png").convert("RGB")
AW, AH = aerial.size
APX = aerial.load()


def aerial_rgb(x, y):
    i = min(AW - 1, max(0, int((x + HALF) / (2 * HALF) * (AW - 1))))
    j = min(AH - 1, max(0, int((HALF - y) / (2 * HALF) * (AH - 1))))
    r, g, b = APX[i, j]
    return r / 255.0, g / 255.0, b / 255.0


MIN_H = 3.0
chm_res = int(2 * HALF)          # 1 m working grid
chm = array.array("f", [0.0]) * (chm_res * chm_res)
for j in range(chm_res):
    y = HALF - j - 0.5
    row = j * chm_res
    for i in range(chm_res):
        x = -HALF + i + 0.5
        d = sample(dtm, x, y)
        s = sample_nn(dom, x, y)
        if d is None or s is None or d <= 0.05:
            continue
        h = s - d
        chm[row + i] = h if h > 0 else 0.0

# 3x3 smoothing kills single-pixel spikes that would become phantom trees
sm = array.array("f", chm)
for j in range(1, chm_res - 1):
    row = j * chm_res
    for i in range(1, chm_res - 1):
        acc = 0.0
        for dj in (-chm_res, 0, chm_res):
            base = row + dj + i
            acc += chm[base - 1] + chm[base] + chm[base + 1]
        sm[row + i] = acc / 9.0

trees = []
for j in range(2, chm_res - 2):
    row = j * chm_res
    y = HALF - j - 0.5
    for i in range(2, chm_res - 2):
        h = sm[row + i]
        if h < MIN_H:
            continue
        rad = max(1, min(3, int(round(0.5 + 0.09 * h))))   # crown radius in metres
        if i - rad < 0 or i + rad >= chm_res or j - rad < 0 or j + rad >= chm_res:
            continue
        peak = True
        for dj in range(-rad, rad + 1):
            base = (j + dj) * chm_res + i
            for di in range(-rad, rad + 1):
                if di == 0 and dj == 0:
                    continue
                v = sm[base + di]
                if v > h or (v == h and (dj, di) < (0, 0)):
                    peak = False
                    break
            if not peak:
                break
        if not peak:
            continue
        x = -HALF + i + 0.5
        if on_building(x, y):
            continue
        top = chm[row + i] or h
        r, g, bb = aerial_rgb(x, y)
        val = (r + g + bb) / 3.0
        green = g - (r + bb) / 2.0
        if val < 0.17 or (green > 0.02 and val < 0.22):
            species = "spruce"
        elif green > 0.05 and val > 0.26:
            species = "birch"
        else:
            species = "pine"
        trees.append({
            "xy": [round(x, 2), round(y, 2)],
            "h": round(top, 2),
            "crown": round(min(5.0, max(1.2, 0.26 * top)), 2),
            "species": species,
        })

# LiDAR peak-finding only catches dominant crowns; fill the gaps between them with
# sub-canopy trees, still taking each height from the CHM itself.
cell = 4.0
occupied = {}
for t in trees:
    cx, cy = t["xy"]
    occupied.setdefault((int((cx + HALF) // cell), int((cy + HALF) // cell)), []).append((cx, cy))

fills = 0
for j in range(2, chm_res - 2, 3):
    y = HALF - j - 0.5
    row = j * chm_res
    for i in range(2, chm_res - 2, 3):
        h = sm[row + i]
        if h < 4.0:
            continue
        x = -HALF + i + 0.5
        gx, gy = int((x + HALF) // cell), int((y + HALF) // cell)
        near = False
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for ox, oy in occupied.get((gx + dx, gy + dy), ()):  # noqa: B020
                    if (ox - x) ** 2 + (oy - y) ** 2 < 9.0:
                        near = True
                        break
                if near:
                    break
            if near:
                break
        if near or on_building(x, y):
            continue
        r, g, bb = aerial_rgb(x, y)
        val = (r + g + bb) / 3.0
        green = g - (r + bb) / 2.0
        species = "spruce" if val < 0.17 else ("birch" if green > 0.05 and val > 0.26 else "pine")
        top = max(3.0, chm[row + i] * 0.92)
        trees.append({"xy": [round(x, 2), round(y, 2)], "h": round(top, 2),
                      "crown": round(min(4.2, max(1.0, 0.22 * top)), 2),
                      "species": species, "fill": True})
        occupied.setdefault((gx, gy), []).append((x, y))
        fills += 1
print(f"  gap-filled understory: {fills}")

by_species = {}
for t in trees:
    by_species[t["species"]] = by_species.get(t["species"], 0) + 1
hs = sorted(t["h"] for t in trees)
(OUT / "kv_trees.json").write_text(json.dumps({"trees": trees}), encoding="utf-8")
print(f"trees detected: {len(trees)} {by_species}")
if hs:
    print(f"  height median {hs[len(hs)//2]:.1f} m, p90 {hs[int(len(hs)*0.9)]:.1f} m, max {hs[-1]:.1f} m")

# --------------------------------------------------- roof surfaces (DOM)
roofs = []
for b in buildings:
    ring = b["ring"]
    x0, y0, x1, y1 = bbox(ring)
    gx = max(2, int(math.ceil((x1 - x0))) + 1)
    gy = max(2, int(math.ceil((y1 - y0))) + 1)
    if gx * gy > 20000:
        continue
    heights = []
    ground_vals = []
    for j in range(gy):
        yy = y0 + (y1 - y0) * (j / (gy - 1))
        rowvals = []
        for i in range(gx):
            xx = x0 + (x1 - x0) * (i / (gx - 1))
            inside = in_ring(xx, yy, ring)
            s = sample_nn(dom, xx, yy)
            d = sample(dtm, xx, yy)
            if d is not None and d > 0.05:
                ground_vals.append(d)
            rowvals.append([round(s, 2) if (inside and s is not None) else None])
        heights.append([v[0] for v in rowvals])
    if not ground_vals:
        continue
    ground_vals.sort()
    ground = ground_vals[len(ground_vals) // 10]
    flat = [v for row in heights for v in row if v is not None]
    if len(flat) < 4:
        continue
    flat.sort()
    roofs.append({
        "type": b["type"],
        "ring": ring,
        "x0": x0, "y0": y0, "x1": x1, "y1": y1,
        "gx": gx, "gy": gy,
        "heights": heights,
        "ground": round(ground, 2),
        "eaves": round(flat[int(len(flat) * 0.15)], 2),
        "ridge": round(flat[int(len(flat) * 0.97)], 2),
        "roof_rgb": b.get("roof_rgb"),
        "roof_reddish": b.get("roof_reddish"),
        "roof_bright": b.get("roof_bright"),
    })

(OUT / "kv_roofs.json").write_text(json.dumps({"roofs": roofs}), encoding="utf-8")
tall = [r for r in roofs if r["ridge"] - r["ground"] > 2.0]
print(f"roof surfaces: {len(roofs)} (with real height: {len(tall)})")
if tall:
    sample_r = tall[0]
    print(f"  example {sample_r['type']}: ground {sample_r['ground']} eaves {sample_r['eaves']} "
          f"ridge {sample_r['ridge']} -> {sample_r['ridge'] - sample_r['ground']:.1f} m tall")
