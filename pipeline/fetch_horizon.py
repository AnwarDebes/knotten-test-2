"""Wide horizon ring - 30 x 30 km - so the sight line down Snigsfjorden reaches open sea."""
from __future__ import annotations

import json
from pathlib import Path

import fetch_area as fa

OUT = Path(__file__).resolve().parent
HALF_M = 15000.0
DEM_ZOOM = 11        # ~80 m/px at this latitude; fine for a horizon 5-15 km away
IMG_ZOOM = 13        # ~20 m/px

HALF_LAT = HALF_M / fa.M_PER_DEG_LAT
HALF_LON = HALF_M / fa.M_PER_DEG_LON
fa.LAT_MIN, fa.LAT_MAX = fa.LAT - HALF_LAT, fa.LAT + HALF_LAT
fa.LON_MIN, fa.LON_MAX = fa.LON - HALF_LON, fa.LON + HALF_LON

print("horizon DEM...")
dem = fa.fetch_tile_mosaic(fa.TERRARIUM, DEM_ZOOM, "dem-horizon")
w, h = dem.size
px = dem.load()
grid = [[round((px[i, j][0] * 256.0 + px[i, j][1] + px[i, j][2] / 256.0) - 32768.0, 1)
         for i in range(w)] for j in range(h)]
flat = [v for row in grid for v in row]
(OUT / "horizon_elevation.json").write_text(json.dumps({
    "width": w, "height": h, "zoom": DEM_ZOOM, "half_m": HALF_M,
    "lat_min": fa.LAT_MIN, "lat_max": fa.LAT_MAX,
    "lon_min": fa.LON_MIN, "lon_max": fa.LON_MAX,
    "min": min(flat), "max": max(flat),
    "rows_north_to_south": grid,
}), encoding="utf-8")
print(f"  {w}x{h}px  {min(flat)}..{max(flat)} m")

print("horizon imagery...")
sat = fa.fetch_tile_mosaic(fa.ESRI, IMG_ZOOM, "aerial-horizon")
sat.save(OUT / "horizon_satellite.png")
print("  texture", sat.size)
print("done")
