"""Hillshade + contour map of the 1 m LiDAR tile with OSM overlays, to match norgeskart."""
from __future__ import annotations

import array
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
meta = json.loads((OUT / "area_meta.json").read_text(encoding="utf-8"))
tinfo = json.loads((OUT / "kv_terrain.json").read_text(encoding="utf-8"))
scene = json.loads((OUT / "scene_data.json").read_text(encoding="utf-8"))
RES = tinfo["res"]
HALF = tinfo["half_m"]
STEP = tinfo["step_m"]
Z = array.array("f")
Z.fromfile(open(OUT / "kv_terrain.f32", "rb"), RES * RES)

SCALE = 1.0                      # px per metre
W = H = int(RES * SCALE)
img = Image.new("RGB", (W, H), (245, 243, 236))
px = img.load()

# hillshade, sun from NW like norgeskart
az, alt = math.radians(315), math.radians(45)
for j in range(1, RES - 1):
    for i in range(1, RES - 1):
        idx = j * RES + i
        dzdx = (Z[idx + 1] - Z[idx - 1]) / (2 * STEP)
        dzdy = (Z[idx - RES] - Z[idx + RES]) / (2 * STEP)
        slope = math.atan(math.hypot(dzdx, dzdy))
        aspect = math.atan2(-dzdy, dzdx)
        shade = (math.sin(alt) * math.cos(slope)
                 + math.cos(alt) * math.sin(slope) * math.cos(az - math.pi / 2 - aspect))
        v = int(150 + 105 * max(0.0, shade))
        z = Z[idx]
        if z < 0:
            px[i, j] = (170, 205, 235)
        else:
            t = min(1.0, z / 200.0)
            base = (int(235 - 60 * t), int(232 - 40 * t), int(205 - 60 * t))
            px[i, j] = tuple(int(b * v / 255) for b in base)

draw = ImageDraw.Draw(img)


def to_px(x, y):
    return ((x + HALF) / (2 * HALF) * (W - 1), (HALF - y) / (2 * HALF) * (H - 1))


# contours by marching the grid cells (segment per cell edge crossing)
def contour(level, colour, width):
    for j in range(RES - 1):
        for i in range(RES - 1):
            a = Z[j * RES + i]
            b = Z[j * RES + i + 1]
            c = Z[(j + 1) * RES + i + 1]
            d = Z[(j + 1) * RES + i]
            corners = [(a, (i, j)), (b, (i + 1, j)), (c, (i + 1, j + 1)), (d, (i, j + 1))]
            pts = []
            for k in range(4):
                z0, p0 = corners[k]
                z1, p1 = corners[(k + 1) % 4]
                if (z0 < level) != (z1 < level):
                    t = (level - z0) / (z1 - z0)
                    pts.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t))
            if len(pts) >= 2:
                draw.line([(pts[0][0] * SCALE, pts[0][1] * SCALE),
                           (pts[1][0] * SCALE, pts[1][1] * SCALE)], fill=colour, width=width)


for lvl in range(5, 200, 5):
    contour(lvl, (190, 150, 110), 1)
for lvl in range(25, 200, 25):
    contour(lvl, (150, 95, 50), 2)

# OSM roads / buildings / names
for r in scene["roads"]:
    pts = [to_px(x, y) for x, y in r["pts"]]
    w = 4 if r["type"] in ("primary", "secondary") else 2
    draw.line(pts, fill=(255, 255, 255), width=w + 2)
    draw.line(pts, fill=(120, 120, 120), width=w)
for b in scene["buildings"]:
    draw.polygon([to_px(x, y) for x, y in b["ring"]], fill=(230, 150, 60), outline=(120, 70, 20))

try:
    font = ImageFont.truetype("arial.ttf", 16)
    small = ImageFont.truetype("arial.ttf", 12)
except Exception:
    font = small = ImageFont.load_default()

for r in scene["roads"]:
    if r["name"]:
        mid = r["pts"][len(r["pts"]) // 2]
        draw.text(to_px(*mid), r["name"], fill=(60, 60, 60), font=small)
for p in scene["places"]:
    if p["name"]:
        x, y = to_px(*p["xy"])
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(200, 0, 0))
        draw.text((x + 6, y - 8), p["name"], fill=(150, 0, 0), font=font)

# peaks: local maxima with >= 8 m prominence in a 60 m window
peaks = []
win = 30
for j in range(win, RES - win, 3):
    for i in range(win, RES - win, 3):
        z = Z[j * RES + i]
        if z < 30:
            continue
        ok = True
        lo = z
        for dj in range(-win, win + 1, 3):
            row = (j + dj) * RES
            for di in range(-win, win + 1, 3):
                v = Z[row + i + di]
                if v > z:
                    ok = False
                    break
                lo = min(lo, v)
            if not ok:
                break
        if ok and z - lo >= 8:
            peaks.append((round(z, 1), -HALF + i * STEP, HALF - j * STEP))
peaks.sort(reverse=True)
for z, x, y in peaks[:12]:
    X, Y = to_px(x, y)
    draw.polygon([(X, Y - 7), (X - 6, Y + 5), (X + 6, Y + 5)], fill=(0, 90, 0))
    draw.text((X + 8, Y - 8), f"{z}", fill=(0, 70, 0), font=font)

# centre marker = the coordinate we were given
cx, cy = to_px(0, 0)
draw.line((cx - 12, cy, cx + 12, cy), fill=(255, 0, 0), width=3)
draw.line((cx, cy - 12, cx, cy + 12), fill=(255, 0, 0), width=3)
draw.text((cx + 14, cy + 4), "58.068057, 7.278401", fill=(200, 0, 0), font=font)
draw.text((10, 10), "N up  |  1 px = 1 m  |  Kartverket DTM 1 m", fill=(0, 0, 0), font=font)

img.save(OUT / "site_map.png")
print("peaks (m, x_east, y_north):", peaks[:12])
print("centre elevation:", round(Z[(RES // 2) * RES + RES // 2], 1))
