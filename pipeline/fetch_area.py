"""Fetch every openly available layer for a 1 km x 1 km area, for a photoreal Blender build.

Layers:
  * Nominatim reverse geocode      -> place / municipality / county names
  * Overpass (OpenStreetMap)       -> all ways + tagged nodes in the area
  * AWS Terrain Tiles (terrarium)  -> real elevation grid (Kartverket-derived over Norway)
  * Esri World Imagery             -> aerial photo mosaic, used as the terrain colour texture
"""
from __future__ import annotations

import io
import json
import math
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

LAT = 58.068057
LON = 7.278401
HALF_M = 500.0          # half the square side, metres
ELEV_ZOOM = 15          # terrarium tiles, ~2.5 m/px at this latitude
IMG_ZOOM = 18           # aerial tiles, ~0.3 m/px
OSM_RADIUS = 900

OUT = Path(__file__).resolve().parent
UA = {"User-Agent": "blender-terrain-study/1.0 (contact: local user)"}

M_PER_DEG_LAT = 111132.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(LAT))
HALF_LAT = HALF_M / M_PER_DEG_LAT
HALF_LON = HALF_M / M_PER_DEG_LON
LAT_MIN, LAT_MAX = LAT - HALF_LAT, LAT + HALF_LAT
LON_MIN, LON_MAX = LON - HALF_LON, LON + HALF_LON

_CTX = ssl.create_default_context()
try:
    import certifi  # type: ignore

    _CTX.load_verify_locations(certifi.where())
except Exception:
    _CTX.check_hostname = False
    _CTX.verify_mode = ssl.CERT_NONE


def get(url, data=None, tries=4, timeout=120):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA,
                                         method="POST" if data else "GET")
            if data:
                req.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001 - retry any transport failure
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"failed: {url} ({last})")


# --------------------------------------------------------------- geocoding
def reverse_geocode():
    out = {}
    url = ("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&"
           f"lat={LAT}&lon={LON}&addressdetails=1&extratags=1")
    out["center"] = json.loads(get(url).decode())
    time.sleep(1.1)
    return out


# ---------------------------------------------------------------- overpass
OVERPASS_QUERY = f"""
[out:json][timeout:180];
(
  way(around:{OSM_RADIUS},{LAT},{LON});
  node(around:{OSM_RADIUS},{LAT},{LON})[place];
  node(around:{OSM_RADIUS},{LAT},{LON})[natural];
  node(around:{OSM_RADIUS},{LAT},{LON})[amenity];
  node(around:{OSM_RADIUS},{LAT},{LON})[tourism];
  node(around:{OSM_RADIUS},{LAT},{LON})[man_made];
  node(around:{OSM_RADIUS},{LAT},{LON})[power];
  relation(around:{OSM_RADIUS},{LAT},{LON})[type=multipolygon];
);
out geom;
"""


def fetch_osm():
    endpoints = ["https://overpass-api.de/api/interpreter",
                 "https://overpass.kumi.systems/api/interpreter"]
    payload = urllib.parse.urlencode({"data": OVERPASS_QUERY}).encode()
    for ep in endpoints:
        try:
            return json.loads(get(ep, data=payload, tries=2, timeout=180).decode())
        except Exception as exc:  # noqa: BLE001
            print("  overpass failed on", ep, exc)
    raise RuntimeError("all overpass endpoints failed")


# --------------------------------------------------------------- tile math
def lonlat_to_pixel(lon, lat, zoom, tile=256):
    n = 2 ** zoom * tile
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def fetch_tile_mosaic(url_tmpl, zoom, label, tile=256):
    """Download every tile covering the bbox and return (mosaic, origin_px)."""
    px0, py0 = lonlat_to_pixel(LON_MIN, LAT_MAX, zoom, tile)
    px1, py1 = lonlat_to_pixel(LON_MAX, LAT_MIN, zoom, tile)
    tx0, ty0 = int(px0 // tile), int(py0 // tile)
    tx1, ty1 = int(px1 // tile), int(py1 // tile)
    cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1
    print(f"  {label}: z{zoom} {cols}x{rows} = {cols * rows} tiles")
    mosaic = Image.new("RGB", (cols * tile, rows * tile))
    done = 0
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            raw = get(url_tmpl.format(z=zoom, x=tx, y=ty), timeout=60)
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            if img.size != (tile, tile):
                img = img.resize((tile, tile), Image.LANCZOS)
            mosaic.paste(img, ((tx - tx0) * tile, (ty - ty0) * tile))
            done += 1
            if done % 25 == 0:
                print(f"    {done}/{cols * rows}")
    crop = (int(round(px0 - tx0 * tile)), int(round(py0 - ty0 * tile)),
            int(round(px1 - tx0 * tile)), int(round(py1 - ty0 * tile)))
    return mosaic.crop(crop)


TERRARIUM = ("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/"
             "{z}/{x}/{y}.png")
ESRI = ("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/"
        "MapServer/tile/{z}/{y}/{x}")


def main():
    print("1/4 reverse geocoding...")
    geo = reverse_geocode()
    disp = geo["center"].get("display_name", "?")
    print("  ", disp)

    print("2/4 OpenStreetMap (Overpass)...")
    osm = fetch_osm()
    (OUT / "osm_raw.json").write_text(json.dumps(osm), encoding="utf-8")
    print("   elements:", len(osm.get("elements", [])))

    print("3/4 elevation (AWS terrarium tiles)...")
    dem_img = fetch_tile_mosaic(TERRARIUM, ELEV_ZOOM, "dem")
    w, h = dem_img.size
    px = dem_img.load()
    grid = []
    for j in range(h):
        row = []
        for i in range(w):
            r, g, b = px[i, j]
            row.append(round((r * 256.0 + g + b / 256.0) - 32768.0, 2))
        grid.append(row)
    flat = [v for row in grid for v in row]
    elevation = {
        "width": w, "height": h, "zoom": ELEV_ZOOM,
        "lat_min": LAT_MIN, "lat_max": LAT_MAX,
        "lon_min": LON_MIN, "lon_max": LON_MAX,
        "center_lat": LAT, "center_lon": LON,
        "half_m": HALF_M,
        "min": min(flat), "max": max(flat),
        "rows_north_to_south": grid,
    }
    (OUT / "elevation.json").write_text(json.dumps(elevation), encoding="utf-8")
    print(f"   dem {w}x{h}px, {elevation['min']}..{elevation['max']} m")

    print("4/4 aerial imagery (Esri World Imagery)...")
    zoom = IMG_ZOOM
    try:
        sat = fetch_tile_mosaic(ESRI, zoom, "aerial")
    except Exception as exc:  # noqa: BLE001
        print("   z18 failed, dropping to z17:", exc)
        zoom = 17
        sat = fetch_tile_mosaic(ESRI, zoom, "aerial")
    sat.save(OUT / "satellite.png")
    print("   texture:", sat.size)

    meta = {
        "center": {"lat": LAT, "lon": LON},
        "bbox": {"lat_min": LAT_MIN, "lat_max": LAT_MAX,
                 "lon_min": LON_MIN, "lon_max": LON_MAX},
        "size_m": [2 * HALF_M, 2 * HALF_M],
        "m_per_deg": {"lat": M_PER_DEG_LAT, "lon": M_PER_DEG_LON},
        "geocode": geo,
        "texture": {"file": "satellite.png", "zoom": zoom,
                    "width": sat.size[0], "height": sat.size[1],
                    "source": "Esri World Imagery"},
        "elevation_source": "AWS Terrain Tiles (terrarium) z%d" % ELEV_ZOOM,
        "osm_elements": len(osm.get("elements", [])),
    }
    (OUT / "area_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("done ->", OUT)


if __name__ == "__main__":
    sys.exit(main())
