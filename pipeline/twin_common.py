"""Shared ground for the digital-twin build (twin_*.py): the scene frame, map projections,
cached downloads and a small glTF writer.

The scene frame is the one every other file in the project uses (plots.json, trees.bin,
road.json): local metres with x east and y north from 58.068057 N 7.278401 E, using the
constant metres per degree in source/area_meta.json, and z metres above sea level (NN2000).
three.js maps it to (x, z, -y).
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import ssl
import struct
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

KN = Path(__file__).resolve().parent.parent
SRC = KN / "source"
CACHE = SRC / "twin"                       # raw downloads, git-ignored, rebuilt by twin_fetch.py
OUT = KN / "site" / "public" / "twin"      # what the browser loads
DATA = KN / "data"
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

_meta = json.loads((SRC / "area_meta.json").read_text(encoding="utf-8"))
LAT0 = _meta["center"]["lat"]
LON0 = _meta["center"]["lon"]
M_LAT = _meta["m_per_deg"]["lat"]
M_LON = _meta["m_per_deg"]["lon"]

UA = {"User-Agent": "knotten-twin-build/2.0 (project site for Knotten, Lindesnes)"}
_CTX = ssl.create_default_context()


# ------------------------------------------------------------------ frames
def local_to_latlon(x, y):
    return LAT0 + np.asarray(y) / M_LAT, LON0 + np.asarray(x) / M_LON


def latlon_to_local(lat, lon):
    return (np.asarray(lon) - LON0) * M_LON, (np.asarray(lat) - LAT0) * M_LAT


_A, _F = 6378137.0, 1 / 298.257223563
_E2 = _F * (2 - _F)
_EP2 = _E2 / (1 - _E2)
_K0, _LONC, _FE = 0.9996, math.radians(9.0), 500000.0


def to_utm32(lat, lon):
    """WGS84 to UTM zone 32N (EPSG:25832, which is ETRS89 and equal to WGS84 at this scale)."""
    phi = np.radians(np.asarray(lat, dtype=np.float64))
    lam = np.radians(np.asarray(lon, dtype=np.float64))
    sp, cp, tp = np.sin(phi), np.cos(phi), np.tan(phi)
    N = _A / np.sqrt(1 - _E2 * sp * sp)
    T, C = tp * tp, _EP2 * cp * cp
    Aa = (lam - _LONC) * cp
    M = _A * ((1 - _E2 / 4 - 3 * _E2**2 / 64 - 5 * _E2**3 / 256) * phi
              - (3 * _E2 / 8 + 3 * _E2**2 / 32 + 45 * _E2**3 / 1024) * np.sin(2 * phi)
              + (15 * _E2**2 / 256 + 45 * _E2**3 / 1024) * np.sin(4 * phi)
              - (35 * _E2**3 / 3072) * np.sin(6 * phi))
    east = _FE + _K0 * N * (Aa + (1 - T + C) * Aa**3 / 6
                            + (5 - 18 * T + T * T + 72 * C - 58 * _EP2) * Aa**5 / 120)
    north = _K0 * (M + N * tp * (Aa**2 / 2 + (5 - T + 9 * C + 4 * C * C) * Aa**4 / 24
                                 + (61 - 58 * T + T * T + 600 * C - 330 * _EP2) * Aa**6 / 720))
    return east, north


def local_to_utm(x, y):
    return to_utm32(*local_to_latlon(x, y))


def utm_to_local(e, n, iters=3):
    """Inverse of local_to_utm by Newton steps on the (nearly affine) map."""
    e = np.asarray(e, dtype=np.float64)
    n = np.asarray(n, dtype=np.float64)
    e0, n0 = local_to_utm(0.0, 0.0)
    ex, nx = local_to_utm(1000.0, 0.0)
    ey, ny = local_to_utm(0.0, 1000.0)
    J = np.array([[ex - e0, ey - e0], [nx - n0, ny - n0]]) / 1000.0
    Ji = np.linalg.inv(J)
    x = Ji[0, 0] * (e - e0) + Ji[0, 1] * (n - n0)
    y = Ji[1, 0] * (e - e0) + Ji[1, 1] * (n - n0)
    for _ in range(iters):
        ee, nn = local_to_utm(x, y)
        de, dn = e - ee, n - nn
        x = x + Ji[0, 0] * de + Ji[0, 1] * dn
        y = y + Ji[1, 0] * de + Ji[1, 1] * dn
    return x, y


def utm32_to_latlon(e, n):
    """UTM zone 32N (EPSG:25832) to latitude and longitude, inverse transverse Mercator (Snyder 1987,
    eq. 8-12 to 8-18); millimetres within the zone and its usual overlap."""
    ep2 = _EP2
    x = (np.asarray(e, np.float64) - _FE) / _K0
    M = np.asarray(n, np.float64) / _K0
    mu = M / (_A * (1 - _E2 / 4 - 3 * _E2**2 / 64 - 5 * _E2**3 / 256))
    e1 = (1 - math.sqrt(1 - _E2)) / (1 + math.sqrt(1 - _E2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * np.sin(2 * mu) + (21 * e1**2 / 16 - 55 * e1**4 / 32) * np.sin(4 * mu)
            + (151 * e1**3 / 96) * np.sin(6 * mu) + (1097 * e1**4 / 512) * np.sin(8 * mu))
    s1, c1, t1 = np.sin(phi1), np.cos(phi1), np.tan(phi1)
    C1, T1 = ep2 * c1**2, t1**2
    N1 = _A / np.sqrt(1 - _E2 * s1**2)
    R1 = _A * (1 - _E2) / (1 - _E2 * s1**2) ** 1.5
    D = x / N1
    lat = phi1 - (N1 * t1 / R1) * (D**2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1**2 - 9 * ep2) * D**4 / 24
                                   + (61 + 90 * T1 + 298 * C1 + 45 * T1**2 - 252 * ep2 - 3 * C1**2) * D**6 / 720)
    lon = _LONC + (D - (1 + 2 * T1 + C1) * D**3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1**2 + 8 * ep2 + 24 * T1**2) * D**5 / 120) / c1
    return np.degrees(lat), np.degrees(lon)


# ------------------------------------------------------------------ the true frame (outer rings)
# The scene frame above maps latitude and longitude to metres with two constants. That is exact to a
# few centimetres over the field and to 0.4 m at 1.3 km, but further out the parallels of a true map
# curve and the metres per degree of longitude change with latitude (about 100 m wrong at 20 km, km
# at 100 km). Everything beyond the 1.3 km ring is therefore placed in the "true frame": the azimuthal
# equidistant projection from the scene origin on the GRS80 ellipsoid (exact distance and direction
# from the origin, Vincenty 1975), scaled by the same two constants, so the two frames agree to first
# order where they meet. The ground also falls away with the curvature of the earth, lifted a little
# by refraction (k = 0.13, the standard coefficient for light near the ground).
_B = _A * (1 - _F)
_S0 = math.sin(math.radians(LAT0))
M_LAT_TRUE = math.pi / 180 * _A * (1 - _E2) / (1 - _E2 * _S0**2) ** 1.5
M_LON_TRUE = math.pi / 180 * _A * math.cos(math.radians(LAT0)) / math.sqrt(1 - _E2 * _S0**2)
SX, SY = M_LON / M_LON_TRUE, M_LAT / M_LAT_TRUE
R_GAUSS = math.sqrt((M_LAT_TRUE * 180 / math.pi) * (M_LON_TRUE * 180 / math.pi) / math.cos(math.radians(LAT0)))
K_REFRACTION = 0.13
R_EFF = R_GAUSS / (1 - K_REFRACTION)


def geo_to_true(lat, lon, iters=40):
    """Latitude and longitude to the true frame (Vincenty's inverse from the origin)."""
    phi2, lam2 = np.radians(np.asarray(lat, np.float64)), np.radians(np.asarray(lon, np.float64))
    phi1, lam1 = math.radians(LAT0), math.radians(LON0)
    U1 = math.atan((1 - _F) * math.tan(phi1))
    U2 = np.arctan((1 - _F) * np.tan(phi2))
    sU1, cU1 = math.sin(U1), math.cos(U1)
    sU2, cU2 = np.sin(U2), np.cos(U2)
    L = lam2 - lam1
    lam = L.copy()
    for _ in range(iters):
        sl, cl = np.sin(lam), np.cos(lam)
        ss = np.sqrt((cU2 * sl) ** 2 + (cU1 * sU2 - sU1 * cU2 * cl) ** 2)
        cs = sU1 * sU2 + cU1 * cU2 * cl
        sig = np.arctan2(ss, cs)
        sa = np.where(ss > 0, cU1 * cU2 * sl / np.where(ss > 0, ss, 1), 0.0)
        c2a = 1 - sa * sa
        c2m = np.where(c2a > 0, cs - 2 * sU1 * sU2 / np.where(c2a > 0, c2a, 1), 0.0)
        C = _F / 16 * c2a * (4 + _F * (4 - 3 * c2a))
        lam = L + (1 - C) * _F * sa * (sig + C * ss * (c2m + C * cs * (-1 + 2 * c2m * c2m)))
    u2 = c2a * (_A * _A - _B * _B) / (_B * _B)
    Ak = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
    Bk = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
    ds = Bk * ss * (c2m + Bk / 4 * (cs * (-1 + 2 * c2m * c2m) - Bk / 6 * c2m * (-3 + 4 * ss * ss) * (-3 + 4 * c2m * c2m)))
    s = _B * Ak * (sig - ds)
    az = np.arctan2(cU2 * np.sin(lam), cU1 * sU2 - sU1 * cU2 * np.cos(lam))
    return s * np.sin(az) * SX, s * np.cos(az) * SY


def true_to_geo(x, y, iters=12):
    """The true frame to latitude and longitude (Vincenty's direct from the origin)."""
    xs, ys = np.asarray(x, np.float64) / SX, np.asarray(y, np.float64) / SY
    s = np.hypot(xs, ys)
    a1 = np.arctan2(xs, ys)
    phi1 = math.radians(LAT0)
    U1 = math.atan((1 - _F) * math.tan(phi1))
    sU1, cU1 = math.sin(U1), math.cos(U1)
    sig1 = np.arctan2(math.tan(U1), np.cos(a1))
    sa = cU1 * np.sin(a1)
    c2a = 1 - sa * sa
    u2 = c2a * (_A * _A - _B * _B) / (_B * _B)
    Ak = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
    Bk = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
    sig = s / (_B * Ak)
    for _ in range(iters):
        c2m = np.cos(2 * sig1 + sig)
        ss, cs = np.sin(sig), np.cos(sig)
        ds = Bk * ss * (c2m + Bk / 4 * (cs * (-1 + 2 * c2m * c2m) - Bk / 6 * c2m * (-3 + 4 * ss * ss) * (-3 + 4 * c2m * c2m)))
        sig = s / (_B * Ak) + ds
    c2m = np.cos(2 * sig1 + sig)
    ss, cs = np.sin(sig), np.cos(sig)
    ca1 = np.cos(a1)
    phi2 = np.arctan2(sU1 * cs + cU1 * ss * ca1, (1 - _F) * np.sqrt(sa * sa + (sU1 * ss - cU1 * cs * ca1) ** 2))
    lam = np.arctan2(ss * np.sin(a1), cU1 * cs - sU1 * ss * ca1)
    C = _F / 16 * c2a * (4 + _F * (4 - 3 * c2a))
    L = lam - (1 - C) * _F * sa * (sig + C * ss * (c2m + C * cs * (-1 + 2 * c2m * c2m)))
    return np.degrees(phi2), LON0 + np.degrees(L)


def true_to_utm(x, y):
    return to_utm32(*true_to_geo(x, y))


def utm_to_true(e, n):
    return geo_to_true(*utm32_to_latlon(e, n))


def curvature_drop(x, y):
    """How far the ground at (x, y) lies below the origin's horizontal plane: the earth's curvature,
    less the share refraction gives back (metres)."""
    return (np.asarray(x, np.float64) ** 2 + np.asarray(y, np.float64) ** 2) / (2 * R_EFF)


def utm_bbox_of_local_square(half, pad=60.0):
    """UTM bbox covering the local square [-half, half]^2 plus a margin."""
    s = np.linspace(-half - pad, half + pad, 9)
    gx, gy = np.meshgrid(s, s)
    e, n = local_to_utm(gx, gy)
    return float(e.min()), float(n.min()), float(e.max()), float(n.max())


# web mercator
def merc_pixel(lat, lon, z):
    n = 256.0 * 2**z
    x = (np.asarray(lon) + 180.0) / 360.0 * n
    latr = np.radians(np.asarray(lat))
    y = (1.0 - np.arcsinh(np.tan(latr)) / math.pi) / 2.0 * n
    return x, y


# ------------------------------------------------------------------ downloads
def fetch(url: str, *, name: str | None = None, timeout: int = 180, tries: int = 4, binary: bool = True, headers=None):
    """GET with an on-disk cache under source/twin/http (keyed by the URL)."""
    key = name or hashlib.sha1(url.encode()).hexdigest()[:20]
    path = CACHE / "http" / key
    if path.exists() and path.stat().st_size > 0:
        data = path.read_bytes()
        return data if binary else data.decode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    last = None
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
                data = r.read()
            path.write_bytes(data)
            return data if binary else data.decode("utf-8")
        except Exception as exc:  # network hiccups: back off and retry
            last = exc
            time.sleep(2.0 * (k + 1))
    raise RuntimeError(f"download failed: {url}: {last}")


def post(url: str, body: str, *, name: str, timeout: int = 300):
    path = CACHE / "http" / name
    if path.exists() and path.stat().st_size > 0:
        return path.read_bytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, data=body.encode("utf-8"), headers={**UA, "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
        data = r.read()
    path.write_bytes(data)
    return data


# ------------------------------------------------------------------ rasters
class UtmRaster:
    """A north-up UTM raster (row 0 = north) with bilinear sampling at scene coordinates."""

    def __init__(self, arr, e_min, n_max, pix, nodata_le=None):
        self.a = arr.astype(np.float32)
        self.e_min, self.n_max, self.pix = e_min, n_max, pix
        self.h, self.w = arr.shape
        self.nodata_le = nodata_le

    @classmethod
    def load(cls, stem):
        meta = json.loads((CACHE / f"{stem}.json").read_text(encoding="utf-8"))
        arr = np.load(CACHE / f"{stem}.npy")
        return cls(arr, meta["e_min"], meta["n_max"], meta["pix"])

    def sample_utm(self, e, n, nearest=False):
        fc = (np.asarray(e) - self.e_min) / self.pix - 0.5
        fr = (self.n_max - np.asarray(n)) / self.pix - 0.5
        if nearest:
            c = np.clip(np.rint(fc).astype(np.int64), 0, self.w - 1)
            r = np.clip(np.rint(fr).astype(np.int64), 0, self.h - 1)
            return self.a[r, c]
        c0 = np.clip(np.floor(fc).astype(np.int64), 0, self.w - 2)
        r0 = np.clip(np.floor(fr).astype(np.int64), 0, self.h - 2)
        tx = np.clip(fc - c0, 0.0, 1.0)
        ty = np.clip(fr - r0, 0.0, 1.0)
        a = self.a
        v00, v10 = a[r0, c0], a[r0, c0 + 1]
        v01, v11 = a[r0 + 1, c0], a[r0 + 1, c0 + 1]
        return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty

    def sample(self, x, y, nearest=False):
        e, n = local_to_utm(x, y)
        return self.sample_utm(e, n, nearest)


def save_lossless(img, path: Path):
    """A data texture (masks, codes) saved without loss: lossless WebP for a .webp path (a third to a half
    smaller than PNG for these), optimised PNG otherwise."""
    if Path(path).suffix == ".webp":
        img.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
    else:
        img.save(path, optimize=True)


def save_raster(stem, arr, e_min, n_max, pix, extra=None):
    np.save(CACHE / f"{stem}.npy", arr.astype(np.float32))
    (CACHE / f"{stem}.json").write_text(json.dumps({"e_min": e_min, "n_max": n_max, "pix": pix, "shape": list(arr.shape), **(extra or {})}, indent=1), encoding="utf-8")


# ------------------------------------------------------------------ glTF
def write_glb(path: Path, meshes: list[dict], *, images: dict[str, bytes] | None = None, extras: dict | None = None):
    """Write a minimal glTF 2.0 binary.

    meshes: [{name, position (N,3) float32, normal?, uv?, color? (N,3|4 uint8 or float), index (M,) uint32,
              material: {name, image?, color?, roughness?, metallic?, doubleSided?, vertexColors?}, extras?,
              quantize?, uv_scale?}]
    Positions are in three.js axes already (x east, y up, z south).
    With quantize (KHR_mesh_quantization): positions as 16-bit integers over the mesh's own box, which
    the node's translation and scale turn back into metres (under 0.16 m a step over 10 km, and finer
    in height), and uv as 16-bit integers over +-uv_scale (the material multiplies by uv_scale).
    """
    images = images or {}
    bin_chunks: list[bytes] = []
    offset = 0
    buffer_views, accessors, gl_meshes, nodes, materials, textures, gl_images, samplers = [], [], [], [], [], [], [], []
    img_index: dict[str, int] = {}

    def add_view(data: bytes, target=None):
        nonlocal offset
        pad = (-offset) % 4
        if pad:
            bin_chunks.append(b"\0" * pad)
            offset += pad
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            bv["target"] = target
        buffer_views.append(bv)
        bin_chunks.append(data)
        offset += len(data)
        return len(buffer_views) - 1

    def add_accessor(arr: np.ndarray, kind: str, comp: int, normalized=False, target=None, minmax=False, stride=None):
        view = add_view(arr.tobytes(), target)
        if stride:
            buffer_views[view]["byteStride"] = stride
        acc = {"bufferView": view, "componentType": comp, "count": int(arr.shape[0]), "type": kind}
        if normalized:
            acc["normalized"] = True
        if minmax:
            cols = {"VEC3": 3, "VEC2": 2, "SCALAR": 1}.get(kind, arr.shape[1])
            acc["min"] = [float(v) for v in arr[:, :cols].min(axis=0)]
            acc["max"] = [float(v) for v in arr[:, :cols].max(axis=0)]
        accessors.append(acc)
        return len(accessors) - 1

    for name, data in images.items():
        view = add_view(data)
        mime = "image/webp" if data[8:12] == b"WEBP" else ("image/png" if data[:4] == b"\x89PNG" else "image/jpeg")
        gl_images.append({"bufferView": view, "mimeType": mime, "name": name})
        img_index[name] = len(gl_images) - 1

    if images:
        samplers.append({"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071})

    mat_index: dict[str, int] = {}
    for m in meshes:
        mat = m["material"]
        if mat["name"] not in mat_index:
            pbr = {"metallicFactor": float(mat.get("metallic", 0.0)), "roughnessFactor": float(mat.get("roughness", 1.0))}
            if "color" in mat:
                pbr["baseColorFactor"] = [float(c) for c in mat["color"]]
            if mat.get("image"):
                textures.append({"sampler": 0, "source": img_index[mat["image"]]})
                pbr["baseColorTexture"] = {"index": len(textures) - 1}
            g = {"name": mat["name"], "pbrMetallicRoughness": pbr}
            if mat.get("doubleSided"):
                g["doubleSided"] = True
            materials.append(g)
            mat_index[mat["name"]] = len(materials) - 1

        pos = np.ascontiguousarray(m["position"], dtype=np.float32)
        node_trs = {}
        if m.get("quantize"):
            lo, hi = pos.astype(np.float64).min(0), pos.astype(np.float64).max(0)
            mid, half = (lo + hi) / 2, np.maximum((hi - lo) / 2, 1e-6)
            q = np.zeros((len(pos), 4), np.int16)                      # 6 bytes padded to 8 (attributes align to 4)
            q[:, :3] = np.clip(np.rint((pos - mid) / half * 32767), -32767, 32767)
            attrs = {"POSITION": add_accessor(q, "VEC3", 5122, normalized=True, target=34962, minmax=True, stride=8)}
            node_trs = {"translation": [float(v) for v in mid], "scale": [float(v) for v in half]}
        else:
            attrs = {"POSITION": add_accessor(pos, "VEC3", 5126, target=34962, minmax=True)}
        if m.get("normal") is not None:
            attrs["NORMAL"] = add_accessor(np.ascontiguousarray(m["normal"], dtype=np.float32), "VEC3", 5126, target=34962)
        if m.get("uv") is not None:
            if m.get("quantize"):
                sc = float(m["uv_scale"])
                quv = np.clip(np.rint(np.asarray(m["uv"], np.float64) / sc * 32767), -32767, 32767).astype(np.int16)
                attrs["TEXCOORD_0"] = add_accessor(np.ascontiguousarray(quv), "VEC2", 5122, normalized=True, target=34962)
            else:
                attrs["TEXCOORD_0"] = add_accessor(np.ascontiguousarray(m["uv"], dtype=np.float32), "VEC2", 5126, target=34962)
        if m.get("color") is not None:
            col = np.ascontiguousarray(m["color"])
            if col.dtype == np.uint8:
                if col.shape[1] == 3:
                    col = np.ascontiguousarray(np.concatenate([col, np.full((col.shape[0], 1), 255, np.uint8)], axis=1))
                attrs["COLOR_0"] = add_accessor(col, "VEC4", 5121, normalized=True, target=34962)
            else:
                attrs["COLOR_0"] = add_accessor(col.astype(np.float32), "VEC3" if col.shape[1] == 3 else "VEC4", 5126, target=34962)
        for key, arr in (m.get("attributes") or {}).items():
            arr = np.ascontiguousarray(arr, dtype=np.float32)
            kind = {1: "SCALAR", 2: "VEC2", 3: "VEC3", 4: "VEC4"}[arr.shape[1] if arr.ndim == 2 else 1]
            attrs[key] = add_accessor(arr.reshape(arr.shape[0], -1), kind, 5126, target=34962)
        idx = np.ascontiguousarray(m["index"]).ravel()
        if idx.max(initial=0) < 65536:
            ia = add_accessor(idx.astype(np.uint16).reshape(-1, 1), "SCALAR", 5123, target=34963)
        else:
            ia = add_accessor(idx.astype(np.uint32).reshape(-1, 1), "SCALAR", 5125, target=34963)
        prim = {"attributes": attrs, "indices": ia, "material": mat_index[mat["name"]]}
        gm = {"name": m["name"], "primitives": [prim]}
        if m.get("extras"):
            gm["extras"] = m["extras"]
        gl_meshes.append(gm)
        nodes.append({"name": m["name"], "mesh": len(gl_meshes) - 1, **node_trs})

    gltf = {
        "asset": {"version": "2.0", "generator": "knotten twin_common.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": gl_meshes,
        "materials": materials,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": offset}],
    }
    if extras:
        gltf["extras"] = extras
    if any(mm.get("quantize") for mm in meshes):
        gltf["extensionsUsed"] = ["KHR_mesh_quantization"]
        gltf["extensionsRequired"] = ["KHR_mesh_quantization"]
    if gl_images:
        gltf["images"] = gl_images
        gltf["textures"] = textures
        gltf["samplers"] = samplers
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * ((-len(js)) % 4)
    binary = b"".join(bin_chunks)
    binary += b"\0" * ((-len(binary)) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<4sII", b"glTF", 2, total))
        fh.write(struct.pack("<I4s", len(js), b"JSON"))
        fh.write(js)
        fh.write(struct.pack("<I4s", len(binary), b"BIN\0"))
        fh.write(binary)
    return path.stat().st_size


def to_three(x, y, z):
    """Scene metres (x east, y north, z up) to three.js axes (x, y up, z south)."""
    return np.stack([np.asarray(x, np.float32), np.asarray(z, np.float32), -np.asarray(y, np.float32)], axis=-1)


def jpeg_bytes(img, quality=82):
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=False, subsampling="4:2:0")
    return buf.getvalue()


def webp_bytes(img, quality=80):
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=6)
    return buf.getvalue()
