"""Fetch a coarse 8 x 8 km DEM + imagery ring so the 1 km study tile has a real horizon."""
from __future__ import annotations

import json
import math
from pathlib import Path

import fetch_area as fa

OUT = Path(__file__).resolve().parent
HALF_M = 4000.0
DEM_ZOOM = 12
IMG_ZOOM = 14

HALF_LAT = HALF_M / fa.M_PER_DEG_LAT
HALF_LON = HALF_M / fa.M_PER_DEG_LON
fa.LAT_MIN, fa.LAT_MAX = fa.LAT - HALF_LAT, fa.LAT + HALF_LAT
fa.LON_MIN, fa.LON_MAX = fa.LON - HALF_LON, fa.LON + HALF_LON

print("surround DEM...")
dem_img = fa.fetch_tile_mosaic(fa.TERRARIUM, DEM_ZOOM, "dem-wide")
w, h = dem_img.size
px = dem_img.load()
grid = [[round((px[i, j][0] * 256.0 + px[i, j][1] + px[i, j][2] / 256.0) - 32768.0, 2)
         for i in range(w)] for j in range(h)]
flat = [v for row in grid for v in row]
(OUT / "surround_elevation.json").write_text(json.dumps({
    "width": w, "height": h, "zoom": DEM_ZOOM, "half_m": HALF_M,
    "lat_min": fa.LAT_MIN, "lat_max": fa.LAT_MAX,
    "lon_min": fa.LON_MIN, "lon_max": fa.LON_MAX,
    "min": min(flat), "max": max(flat),
    "rows_north_to_south": grid,
}), encoding="utf-8")
print(f"  {w}x{h}px  {min(flat)}..{max(flat)} m")

print("surround imagery...")
sat = fa.fetch_tile_mosaic(fa.ESRI, IMG_ZOOM, "aerial-wide")
sat.save(OUT / "surround_satellite.png")
print("  texture", sat.size)

(OUT / "surround_meta.json").write_text(json.dumps({
    "half_m": HALF_M, "dem_zoom": DEM_ZOOM, "img_zoom": IMG_ZOOM,
    "texture": [sat.size[0], sat.size[1]],
}), encoding="utf-8")
print("done")
