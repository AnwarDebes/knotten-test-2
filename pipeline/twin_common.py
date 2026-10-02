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


def save_raster(stem, arr, e_min, n_max, pix, extra=None):
    np.save(CACHE / f"{stem}.npy", arr.astype(np.float32))
    (CACHE / f"{stem}.json").write_text(json.dumps({"e_min": e_min, "n_max": n_max, "pix": pix, "shape": list(arr.shape), **(extra or {})}, indent=1), encoding="utf-8")


# ------------------------------------------------------------------ glTF
def write_glb(path: Path, meshes: list[dict], *, images: dict[str, bytes] | None = None, extras: dict | None = None):
    """Write a minimal glTF 2.0 binary.

    meshes: [{name, position (N,3) float32, normal?, uv?, color? (N,3|4 uint8 or float), index (M,) uint32,
              material: {name, image?, color?, roughness?, metallic?, doubleSided?, vertexColors?}, extras?}]
    Positions are in three.js axes already (x east, y up, z south).
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

    def add_accessor(arr: np.ndarray, kind: str, comp: int, normalized=False, target=None, minmax=False):
        view = add_view(arr.tobytes(), target)
        acc = {"bufferView": view, "componentType": comp, "count": int(arr.shape[0]), "type": kind}
        if normalized:
            acc["normalized"] = True
        if minmax:
            acc["min"] = [float(v) for v in arr.min(axis=0)]
            acc["max"] = [float(v) for v in arr.max(axis=0)]
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
        attrs = {"POSITION": add_accessor(pos, "VEC3", 5126, target=34962, minmax=True)}
        if m.get("normal") is not None:
            attrs["NORMAL"] = add_accessor(np.ascontiguousarray(m["normal"], dtype=np.float32), "VEC3", 5126, target=34962)
        if m.get("uv") is not None:
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
        nodes.append({"name": m["name"], "mesh": len(gl_meshes) - 1})

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
