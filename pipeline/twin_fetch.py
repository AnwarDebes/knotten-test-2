"""Download everything the digital twin is built from, into source/twin (git-ignored).

  Kartverket NHM (hoydedata.no)  DTM and DOM 1 m for +-1.3 km, DTM and DOM 5 m for +-5.2 km, DTM 20 m for +-21 km
  Esri World Imagery             aerial tiles for four rings (0.3, 0.6, 2.5 and 10 m per pixel)
  OpenStreetMap (Overpass)       buildings, roads, water, land use, power lines and place names, +-8 km
  NIBIO                          AR5 land type and forest type, SR16 dominant tree species
  EU JRC PVGIS 5.3               typical meteorological year (hourly) for Knotten, and the PV yield check
  hvakosterstrommen.no           hourly spot prices for NO2, 2025
  Elhub                          hourly consumption of all households in NO2, 2025

Run: python pipeline/twin_fetch.py   (about 10 minutes the first time; cached after that)
"""
from __future__ import annotations

import concurrent.futures as cf
import datetime as dt
import io
import json
import math
import urllib.parse

import numpy as np
from PIL import Image

import twin_common as tc

Image.MAX_IMAGE_PIXELS = None

# ------------------------------------------------------------- Kartverket NHM
NHM = "https://hoydedata.no/arcgis/rest/services/{svc}/ImageServer/exportImage"


def nhm(svc, stem, half, pix):
    if (tc.CACHE / f"{stem}.npy").exists():
        print(f"  {stem}: cached")
        return
    e0, n0, e1, n1 = tc.utm_bbox_of_local_square(half)
    # snap to the pixel grid so neighbouring requests line up
    e0, n0 = math.floor(e0 / pix) * pix, math.floor(n0 / pix) * pix
    e1, n1 = math.ceil(e1 / pix) * pix, math.ceil(n1 / pix) * pix
    w, h = int(round((e1 - e0) / pix)), int(round((n1 - n0) / pix))
    assert w <= 4096 and h <= 4096, (w, h)
    params = {
        "bbox": f"{e0},{n0},{e1},{n1}", "bboxSR": "25832", "imageSR": "25832",
        "size": f"{w},{h}", "format": "tiff", "pixelType": "F32",
        "noDataInterpretation": "esriNoDataMatchAny", "noData": "-9999",
        "interpolation": "RSP_BilinearInterpolation", "f": "image",
    }
    url = NHM.format(svc=svc) + "?" + urllib.parse.urlencode(params)
    raw = tc.fetch(url, name=f"{stem}.tif", timeout=600)
    if raw[:1] == b"{":
        raise RuntimeError(raw[:400])
    img = Image.open(io.BytesIO(raw))
    arr = np.asarray(img, dtype=np.float32)
    if arr.shape != (h, w):
        raise RuntimeError(f"{stem}: got {arr.shape}, wanted {(h, w)}")
    tc.save_raster(stem, arr, e0, n1, pix, {"source": f"Kartverket {svc} via hoydedata.no", "svc": svc})
    good = arr[arr > -1000]
    print(f"  {stem}: {w}x{h} at {pix} m, {good.min():.1f}..{good.max():.1f} m, nodata {np.mean(arr < -1000) * 100:.1f} %")


# ------------------------------------------------------------- aerial imagery
ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"


def tile(z, x, y):
    data = tc.fetch(ESRI.format(z=z, x=x, y=y), name=f"esri/{z}_{x}_{y}.jpg", timeout=60)
    return Image.open(io.BytesIO(data)).convert("RGB")


def imagery(stem, half, z, size):
    """Esri tiles at zoom z, reprojected onto the north-up local square [-half, half]^2 at `size` px."""
    if (tc.CACHE / f"{stem}.png").exists():
        print(f"  {stem}: cached")
        return
    lat0, lon0 = tc.local_to_latlon(-half - 50, -half - 50)
    lat1, lon1 = tc.local_to_latlon(half + 50, half + 50)
    px0, py1 = tc.merc_pixel(lat0, lon0, z)
    px1, py0 = tc.merc_pixel(lat1, lon1, z)
    tx0, tx1 = int(px0 // 256), int(px1 // 256)
    ty0, ty1 = int(py0 // 256), int(py1 // 256)
    jobs = [(x, y) for y in range(ty0, ty1 + 1) for x in range(tx0, tx1 + 1)]
    print(f"  {stem}: z{z}, {len(jobs)} tiles")
    mosaic = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    with cf.ThreadPoolExecutor(8) as ex:
        for (x, y), im in zip(jobs, ex.map(lambda j: tile(z, *j), jobs)):
            mosaic.paste(im, ((x - tx0) * 256, (y - ty0) * 256))
    m = np.asarray(mosaic, dtype=np.float32)
    # sample the mosaic at every output texel (texel centres; row 0 = north)
    s = (np.arange(size) + 0.5) / size * 2 * half - half
    gx, gy = np.meshgrid(s, -s)
    lat, lon = tc.local_to_latlon(gx, gy)
    mx, my = tc.merc_pixel(lat, lon, z)
    fx, fy = mx - tx0 * 256 - 0.5, my - ty0 * 256 - 0.5
    # supersample when the output is coarser than the tiles (area average, no aliasing)
    step_out = 2 * half / size
    step_in = 156543.03392 * math.cos(math.radians(tc.LAT0)) / 2**z
    k = max(1, int(round(step_out / step_in)))
    acc = np.zeros((size, size, 3), np.float32)
    offs = [(i + 0.5) / k - 0.5 for i in range(k)]
    for ox in offs:
        for oy in offs:
            x = np.clip(fx + ox * k, 0, m.shape[1] - 1.001)
            y = np.clip(fy + oy * k, 0, m.shape[0] - 1.001)
            x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
            ax, ay = (x - x0)[..., None], (y - y0)[..., None]
            acc += (m[y0, x0] * (1 - ax) + m[y0, x0 + 1] * ax) * (1 - ay) + (m[y0 + 1, x0] * (1 - ax) + m[y0 + 1, x0 + 1] * ax) * ay
    out = np.clip(acc / (k * k), 0, 255).astype(np.uint8)
    Image.fromarray(out).save(tc.CACHE / f"{stem}.png")
    print(f"  {stem}: {size}x{size}, {2 * half / size:.2f} m/px (k={k})")


# ------------------------------------------------------------- OpenStreetMap
def osm(half=8000):
    path = tc.CACHE / "osm.json"
    if path.exists():
        print("  osm: cached")
        return
    lat0, lon0 = tc.local_to_latlon(-half, -half)
    lat1, lon1 = tc.local_to_latlon(half, half)
    bb = f"{lat0:.6f},{lon0:.6f},{lat1:.6f},{lon1:.6f}"
    q = f"""[out:json][timeout:240];
(
  way["building"]({bb}); relation["building"]({bb});
  way["highway"]({bb});
  way["railway"]({bb});
  way["waterway"]({bb});
  way["natural"]({bb}); relation["natural"]({bb});
  way["water"]({bb}); relation["water"]({bb});
  way["landuse"]({bb}); relation["landuse"]({bb});
  way["leisure"]({bb});
  way["amenity"]({bb}); node["amenity"]({bb});
  way["power"]({bb}); node["power"]({bb});
  way["man_made"]({bb}); node["man_made"]({bb});
  way["bridge"]({bb});
  node["place"]({bb}); way["place"]({bb});
  node["natural"]({bb});
  node["tourism"]({bb});
);
out geom;"""
    for url in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"):
        try:
            raw = tc.post(url, "data=" + urllib.parse.quote(q), name="osm_overpass.json")
            js = json.loads(raw)
            path.write_text(json.dumps(js), encoding="utf-8")
            print(f"  osm: {len(js['elements'])} elements")
            return
        except Exception as exc:
            print("  overpass failed:", url, exc)
            (tc.CACHE / "http" / "osm_overpass.json").unlink(missing_ok=True)
    raise RuntimeError("no overpass server answered")


# ------------------------------------------------------------- NIBIO
NIBIO = {
    "ar5_arealtype": ("https://wms.nibio.no/cgi-bin/ar5", "Arealtype"),
    "ar5_treslag": ("https://wms.nibio.no/cgi-bin/ar5", "Treslag"),
    "sr16_treslag": ("https://wms.nibio.no/cgi-bin/sr16", "SRRTRESLAG"),
}


def nibio(stem, half=1300, pix=2.0, layer_key=None):
    if (tc.CACHE / f"{stem}.png").exists():
        print(f"  {stem}: cached")
        return
    base, layer = NIBIO[layer_key or stem]
    e0, n0, e1, n1 = tc.utm_bbox_of_local_square(half)
    e0, n0 = math.floor(e0 / pix) * pix, math.floor(n0 / pix) * pix
    e1, n1 = math.ceil(e1 / pix) * pix, math.ceil(n1 / pix) * pix
    w, h = int(round((e1 - e0) / pix)), int(round((n1 - n0) / pix))
    params = {"service": "WMS", "request": "GetMap", "version": "1.3.0", "layers": layer, "styles": "",
              "crs": "EPSG:25832", "bbox": f"{e0},{n0},{e1},{n1}", "width": w, "height": h,
              "format": "image/png", "transparent": "true"}
    raw = tc.fetch(base + "?" + urllib.parse.urlencode(params), name=f"{stem}.png", timeout=300)
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    img.save(tc.CACHE / f"{stem}.png")
    (tc.CACHE / f"{stem}.json").write_text(json.dumps({"e_min": e0, "n_max": n1, "pix": pix, "shape": [h, w], "layer": layer, "source": base}), encoding="utf-8")
    leg = tc.fetch(base + "?" + urllib.parse.urlencode({"service": "WMS", "request": "GetLegendGraphic", "version": "1.3.0", "layer": layer, "format": "image/png", "sld_version": "1.1.0"}), name=f"{stem}_legend.png")
    Image.open(io.BytesIO(leg)).save(tc.CACHE / f"{stem}_legend.png")
    cols = np.asarray(img).reshape(-1, 4)
    u, c = np.unique(cols[cols[:, 3] > 200][:, :3], axis=0, return_counts=True)
    top = sorted(zip(c, map(tuple, u)), reverse=True)[:12]
    print(f"  {stem}: {w}x{h}, top colours {top}")


# ------------------------------------------------------------- weather, prices, consumption
def place_names(radius=5000):          # the service allows at most 5 km
    """Official place names (Kartverket, Sentralt stedsnavnregister) around the site, in UTM 32."""
    out = tc.CACHE / "ssr_names.json"
    if out.exists():
        print("  names: cached")
        return
    e, n = tc.local_to_utm(0.0, 0.0)
    rows, page = [], 1
    while True:
        url = (f"https://ws.geonorge.no/stedsnavn/v1/punkt?nord={n:.0f}&ost={e:.0f}&koordsys=25832&radius={radius}"
               f"&utkoordsys=25832&treffPerSide=500&side={page}")
        js = json.loads(tc.fetch(url, name=f"ssr/{radius}_{page}.json", binary=False))
        rows.extend(js.get("navn", []))
        if page * 500 >= js["metadata"]["totaltAntallTreff"]:
            break
        page += 1
    out.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    print(f"  names: {len(rows)} within {radius} m")


def pvgis():
    lat, lon = tc.LAT0, tc.LON0
    tmy = tc.fetch(f"https://re.jrc.ec.europa.eu/api/v5_3/tmy?lat={lat}&lon={lon}&usehorizon=0&outputformat=json", name="pvgis_tmy.json", binary=False)
    js = json.loads(tmy)
    print(f"  pvgis tmy: {len(js['outputs']['tmy_hourly'])} hours, months {[(m['month'], m['year']) for m in js['outputs']['months_selected']]}")
    for tilt, az in ((35, 0), (27, 0), (35, -45), (35, 45), (90, 0)):
        r = tc.fetch(f"https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat={lat}&lon={lon}&peakpower=1&loss=14&angle={tilt}&aspect={az}&usehorizon=0&outputformat=json", name=f"pvgis_pvcalc_{tilt}_{az}.json", binary=False)
        t = json.loads(r)["outputs"]["totals"]["fixed"]
        print(f"  pvgis PVcalc tilt {tilt} azimuth {az}: {t['E_y']} kWh/kWp, {t['H(i)_y']} kWh/m2")


def prices(year=2025):
    out = tc.CACHE / f"prices_no2_{year}.json"
    if out.exists():
        print("  prices: cached")
        return
    days = [dt.date(year, 1, 1) + dt.timedelta(d) for d in range((dt.date(year + 1, 1, 1) - dt.date(year, 1, 1)).days)]

    def one(d):
        raw = tc.fetch(f"https://www.hvakosterstrommen.no/api/v1/prices/{d.year}/{d.month:02d}-{d.day:02d}_NO2.json", name=f"prices/{d.isoformat()}.json", binary=False)
        return json.loads(raw)

    rows = []
    with cf.ThreadPoolExecutor(6) as ex:
        for day in ex.map(one, days):
            rows.extend({"start": r["time_start"], "nok": r["NOK_per_kWh"]} for r in day)
    out.write_text(json.dumps(rows), encoding="utf-8")
    v = np.array([r["nok"] for r in rows])
    print(f"  prices {year}: {len(rows)} rows, mean {v.mean():.3f} NOK/kWh (excl. VAT), min {v.min():.3f}, max {v.max():.3f}")


def elhub(year=2025):
    out = tc.CACHE / f"elhub_no2_household_{year}.json"
    if out.exists():
        print("  elhub: cached")
        return
    rows = []
    for m in range(1, 13):
        start = dt.datetime(year, m, 1)
        end = dt.datetime(year + (m == 12), m % 12 + 1, 1)
        url = ("https://api.elhub.no/energy-data/v0/price-areas/NO2?dataset=CONSUMPTION_PER_GROUP_MBA_HOUR"
               f"&startDate={start:%Y-%m-%d}T00:00:00%2B01:00&endDate={end:%Y-%m-%d}T00:00:00%2B01:00&consumptionGroup=household")
        js = json.loads(tc.fetch(url, name=f"elhub/{year}-{m:02d}.json", binary=False, timeout=300))
        for r in js["data"][0]["attributes"]["consumptionPerGroupMbaHour"]:
            if r["consumptionGroup"] == "household":
                rows.append({"start": r["startTime"], "kwh": r["quantityKwh"], "n": r["meteringPointCount"]})
    out.write_text(json.dumps(rows), encoding="utf-8")
    per = np.array([r["kwh"] / r["n"] for r in rows])
    print(f"  elhub {year}: {len(rows)} hours, {per.sum():.0f} kWh per household metering point")


if __name__ == "__main__":
    print("Kartverket NHM")
    nhm("NHM_DTM_25832", "dtm1", 1300, 1.0)
    nhm("NHM_DOM_25832", "dom1", 1300, 1.0)
    nhm("NHM_DTM_25832", "dtm5", 5250, 5.0)
    nhm("NHM_DOM_25832", "dom5", 5250, 5.0)
    nhm("NHM_DTM_25832", "dtm20", 20600, 20.0)
    print("Esri World Imagery")
    imagery("img_r0", 330, 18, 2048)
    imagery("img_r1", 1290, 17, 2048)
    imagery("img_r2", 5150, 15, 2048)
    imagery("img_r3", 20500, 13, 2048)
    # OpenStreetMap: optional. The build uses source/osm_raw.json (the site tile, fetched 5 Sep 2026)
    # and finds buildings beyond it in the laser data; run with --osm to refresh a wider extract.
    if "--osm" in __import__("sys").argv:
        print("OpenStreetMap")
        osm()
    print("NIBIO")
    for s in NIBIO:
        nibio(s)
    nibio("ar5_arealtype_5", 5250, 5.0, "ar5_arealtype")      # sea and fresh water for the outer rings
    nibio("ar5_arealtype_20", 20600, 12.0, "ar5_arealtype")   # the WMS draws nothing at 20 m/px
    print("Place names")
    place_names()
    print("PVGIS")
    pvgis()
    print("Prices")
    prices()
    print("Elhub")
    elhub()
    print("done")
