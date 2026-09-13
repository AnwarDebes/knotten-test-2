"""Pull Kartverket's national 1 m LiDAR models for the tile.

  NHM_DTM_25832 - bare-earth terrain model
  NHM_DOM_25832 - surface model (tree crowns, roofs)

Their difference is the canopy/roof height model, which gives real tree heights and
real roof shapes instead of guessed ones. Saved as raw float32 + a JSON header so
Blender can read them straight into numpy.
"""
from __future__ import annotations

import array
import io
import json
import math
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None

OUT = Path(__file__).resolve().parent
meta = json.loads((OUT / "area_meta.json").read_text(encoding="utf-8"))
LAT = meta["center"]["lat"]
LON = meta["center"]["lon"]
M_LAT = meta["m_per_deg"]["lat"]
M_LON = meta["m_per_deg"]["lon"]
HALF = meta["size_m"][0] / 2.0
PAD = 120.0                     # margin so UTM rotation never runs off the raster
PIX = 1.0                       # metres per pixel

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = {"User-Agent": "blender-terrain-study/1.0"}

# ------------------------------------------------------ WGS84 -> UTM 32N
A = 6378137.0
F = 1 / 298.257223563
E2 = F * (2 - F)
EP2 = E2 / (1 - E2)
K0 = 0.9996
LON0 = math.radians(9.0)        # zone 32 central meridian
FE = 500000.0


def to_utm32(lat_deg, lon_deg):
    phi = math.radians(lat_deg)
    lam = math.radians(lon_deg)
    sp, cp, tp = math.sin(phi), math.cos(phi), math.tan(phi)
    N = A / math.sqrt(1 - E2 * sp * sp)
    T = tp * tp
    C = EP2 * cp * cp
    Aa = (lam - LON0) * cp
    M = A * ((1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256) * phi
             - (3 * E2 / 8 + 3 * E2**2 / 32 + 45 * E2**3 / 1024) * math.sin(2 * phi)
             + (15 * E2**2 / 256 + 45 * E2**3 / 1024) * math.sin(4 * phi)
             - (35 * E2**3 / 3072) * math.sin(6 * phi))
    east = FE + K0 * N * (Aa + (1 - T + C) * Aa**3 / 6
                          + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa**5 / 120)
    north = K0 * (M + N * tp * (Aa**2 / 2
                                + (5 - T + 9 * C + 4 * C * C) * Aa**4 / 24
                                + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa**6 / 720))
    return east, north


def local_to_latlon(x, y):
    return LAT + y / M_LAT, LON + x / M_LON


# tile corners in UTM, padded
corners = [to_utm32(*local_to_latlon(sx * (HALF + PAD), sy * (HALF + PAD)))
           for sx in (-1, 1) for sy in (-1, 1)]
E_MIN = min(c[0] for c in corners)
E_MAX = max(c[0] for c in corners)
N_MIN = min(c[1] for c in corners)
N_MAX = max(c[1] for c in corners)
W = int(round((E_MAX - E_MIN) / PIX))
H = int(round((N_MAX - N_MIN) / PIX))
print(f"UTM32 bbox {E_MIN:.1f},{N_MIN:.1f} -> {E_MAX:.1f},{N_MAX:.1f}  raster {W}x{H}")

BASE = "https://hoydedata.no/arcgis/rest/services/{svc}/ImageServer/exportImage"


def fetch(svc, name):
    params = {
        "bbox": f"{E_MIN},{N_MIN},{E_MAX},{N_MAX}",
        "bboxSR": "25832", "imageSR": "25832",
        "size": f"{W},{H}",
        "format": "tiff", "pixelType": "F32",
        "noDataInterpretation": "esriNoDataMatchAny",
        "interpolation": "RSP_BilinearInterpolation",
        "f": "image",
    }
    url = BASE.format(svc=svc) + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=300, context=CTX) as resp:
        raw = resp.read()
    if raw[:6] in (b"{\"erro", b'{"erro'):
        raise RuntimeError(raw[:400].decode("utf-8", "replace"))
    img = Image.open(io.BytesIO(raw))
    print(f"  {name}: {img.size} mode={img.mode}")
    if img.mode != "F":
        img = img.convert("F")
    vals = array.array("f", img.tobytes() if img.mode == "F" else b"")
    if not vals:
        vals = array.array("f", list(img.getdata()))
    path = OUT / f"kv_{name}.f32"
    with open(path, "wb") as fh:
        vals.tofile(fh)
    finite = [v for v in vals[::997] if -500 < v < 3000]
    print(f"    {len(vals)} px, sample range {min(finite):.1f}..{max(finite):.1f} m")
    return img.size


size_dtm = fetch("NHM_DTM_25832", "dtm")
size_dom = fetch("NHM_DOM_25832", "dom")

(OUT / "kv_meta.json").write_text(json.dumps({
    "crs": "EPSG:25832",
    "east_min": E_MIN, "east_max": E_MAX,
    "north_min": N_MIN, "north_max": N_MAX,
    "width": size_dtm[0], "height": size_dtm[1],
    "pixel_m": PIX,
    "center_utm": to_utm32(LAT, LON),
    "source": "Kartverket NHM DTM/DOM 1 m (hoydedata.no)",
}, indent=2), encoding="utf-8")
print("done")
