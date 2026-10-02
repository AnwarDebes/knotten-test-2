"""Every registered building out to 5 km round the site that has no surveyed outline (twin_buildings.py
draws those, in the site tile): the farms and houses round the field, Vigeland, Snig, Lonestrand,
Spangereid's east side, the cabins and boathouses along the shore, as registered and as measured.

Every building in Matrikkelen (Kartverket's register: position, NS 3457 type, status; twin_matrikkel.py)
is looked for in Kartverket's laser data: the roof standing 2 m or more over the ground, smooth like a
roof, at or within 6 m of its registered point, then grown into the smooth laser heights next to it
(the smooth-roof test loses a roof's edges, ridges and valleys); several registered buildings under
one roof share it out by nearest point. The growing is calibrated on the 102 buildings with surveyed
outlines near the site: fitted rectangles come out at the surveyed size (median area ratio 1.00,
quartiles 0.88 to 1.13). Each footprint is the measured roof's minimum rectangle and its roof is fitted
to the 1 m surface model (flat, shed, gable either way or hipped; twin_buildings.fit_roof), so
position, size, height, ridge direction and pitch are measured. A registered building the laser data
does not show (built after the scan, or under trees) is left out and counted. Churches get their tower
and spire where the surface rises more than 3 m over the nave's ridge, and a cross church (Valle kirke)
its two crossing wings, each measured.

Roof colours are the median of the aerial photo (Esri z17, about 1.2 m) on each roof. Wall colours
are not in any data set: they follow the registered building type, as in twin_buildings.py.

The laser data is fetched in 512 m cells (1 m, with 32 m margins) only where registered buildings are,
cached in source/twin/cells/. Within the inner 1.3 km square positions are in the scene frame, like the
terrain there; beyond it in the true frame (twin_common.py), bent down with the earth's curvature like
the ground they stand on. The buildings within 1.3 km are added to the building mask the tree step
uses (source/twin/building_mask.npy).

Outputs:
  site/public/twin/buildings_far.glb   one mesh, the same layout as buildings.glb (colours, wall metres, _KIND)
  source/twin/buildings_far.json       the fitted records (type, register numbers, size, roof, heights)
Run after twin_matrikkel.py and twin_terrain.py: python pipeline/twin_world_buildings.py
"""
from __future__ import annotations

import concurrent.futures as cf
import io
import json
import math
import urllib.parse
from collections import Counter

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

import twin_common as tc
from twin_buildings import WALLS, fit_roof, lin, obb, roof_z
from twin_fetch import tile

Image.MAX_IMAGE_PIXELS = None
INNER, OUTER = 1280.0, 5120.0
CELL, MARGIN = 512.0, 32.0
NHM = "https://hoydedata.no/arcgis/rest/services/{svc}/ImageServer/exportImage"
STANDING = {"TB", "FA", "MB", "MT", "FS", "MF", "IG"}
# which register group a shared roof takes, most telling first
PRIORITY = ["church", "school", "health", "civic", "commercial", "industry", "transport", "house", "farm", "cabin", "boathouse", "garage", "other"]
KIND = {"house": "house", "cabin": "house", "farm": "barn", "garage": "shed", "boathouse": "shed", "other": "shed",
        "church": "big", "school": "big", "health": "big", "civic": "big", "commercial": "big", "industry": "big", "transport": "big"}
# white churches are the rule on this coast; everything else uses twin_buildings' palettes
SPECIAL_WALL = {"church": (0.95, 0.95, 0.93)}
# the largest roof one registered building of each kind plausibly has (m2): a larger smooth patch round
# its point is the building joined to something else, and is worn down to the building
MAX_AREA = {"house": 600, "cabin": 350, "garage": 250, "boathouse": 300, "other": 300, "farm": 3000,
            "church": 1500, "school": 6000, "health": 6000, "civic": 6000, "commercial": 8000, "industry": 10000, "transport": 8000}
# how far a roof grows from its smooth core into the laser heights next to it, and how smooth those must be:
# calibrated on the 102 buildings with surveyed outlines in the site tile (source/osm_raw.json), where 6 m
# and 0.25 m give fitted rectangles of the surveyed size (median area ratio 1.00, quartiles 0.88-1.13; length
# +0.06 m, width +0.11 m); without growing they were half the size
GROW_STEPS = 6
GROW_ROUGH = 0.25
# how far from its registered point a building with no smooth roof there may reach (m)
SEED_RADIUS = {"garage": 6, "boathouse": 7, "other": 6, "cabin": 9, "house": 12, "farm": 20, "church": 16}


def cell_raster(svc, ci, cj):
    stem = f"{svc.split('_')[1].lower()}_{ci}_{cj}"
    path = tc.CACHE / "cells" / f"{stem}.npy"
    e0, n0 = ci * CELL - MARGIN, cj * CELL - MARGIN
    e1, n1 = (ci + 1) * CELL + MARGIN, (cj + 1) * CELL + MARGIN
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        w = h = int(e1 - e0)
        params = {"bbox": f"{e0},{n0},{e1},{n1}", "bboxSR": "25832", "imageSR": "25832", "size": f"{w},{h}", "format": "tiff",
                  "pixelType": "F32", "noDataInterpretation": "esriNoDataMatchAny", "noData": "-9999",
                  "interpolation": "RSP_BilinearInterpolation", "f": "image"}
        raw = tc.fetch(NHM.format(svc=svc) + "?" + urllib.parse.urlencode(params), name=f"cells/{stem}.tif", timeout=300)
        if raw[:1] == b"{":
            raise RuntimeError(raw[:300])
        a = np.asarray(Image.open(io.BytesIO(raw)), np.float32)
        a = np.where((a < -1000) | (a > 3000), np.nan, a)
        np.save(path, a)
    return np.load(path), e0, n1


def cell_aerial(ci, cj, z=17):
    """The aerial photo resampled to the cell's 1 m UTM grid."""
    path = tc.CACHE / "cells" / f"img_{ci}_{cj}.png"
    e0, n1 = ci * CELL - MARGIN, (cj + 1) * CELL + MARGIN
    size = int(CELL + 2 * MARGIN)
    if path.exists():
        return np.asarray(Image.open(path).convert("RGB"), np.float32)
    s = np.arange(size) + 0.5
    E, N = np.meshgrid(e0 + s, n1 - s)
    lat, lon = tc.utm32_to_latlon(E, N)
    mx, my = tc.merc_pixel(lat, lon, z)
    tx0, tx1 = int(mx.min() // 256), int(mx.max() // 256)
    ty0, ty1 = int(my.min() // 256), int(my.max() // 256)
    mosaic = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256, 3), np.float32)
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = np.asarray(tile(z, tx, ty), np.float32)
    fx = np.clip(mx - tx0 * 256 - 0.5, 0, mosaic.shape[1] - 1.001)
    fy = np.clip(my - ty0 * 256 - 0.5, 0, mosaic.shape[0] - 1.001)
    x0, y0 = np.floor(fx).astype(int), np.floor(fy).astype(int)
    ax, ay = (fx - x0)[..., None], (fy - y0)[..., None]
    img = (mosaic[y0, x0] * (1 - ax) + mosaic[y0, x0 + 1] * ax) * (1 - ay) + (mosaic[y0 + 1, x0] * (1 - ax) + mosaic[y0 + 1, x0 + 1] * ax) * ay
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(path)
    return img


def roof_colour(px):
    """A roof's colour from the aerial photo's pixels on it (0..255): the median of its sunlit half. The
    median of all pixels mixes in the shaded side (a red roof turns mauve and dark); the ground takes
    the photo's sunlit look as its colour too, and the renderer shades both alike."""
    px = np.asarray(px, np.float64)
    lum = px.mean(1)
    lit = px[lum >= np.median(lum)]
    return (np.median(lit, 0) if len(lit) else np.median(px, 0)) / 255.0


def pick_wall(kind, key):
    r = int.from_bytes(key.encode()[:8].ljust(8, b"\0"), "little") % 10007 / 10007.0
    acc = 0.0
    for p, c in WALLS[kind]:
        acc += p
        if r <= acc:
            return c
    return WALLS[kind][0][1]


def cruciform(u, v, z, tower):
    """The two wings of a cross-shaped roof in the building's own frame (u along its longer side):
    each wing's centre line and width from the roof's outline, its ridge and eaves from the surface
    model along its centre line and sides (outside the crossing). None when the outline is no cross."""
    if len(u) < 50:
        return None
    umin, umax, vmin, vmax = float(u.min()), float(u.max()), float(v.min()), float(v.max())

    def extents(a, b, lo, hi):
        bins = np.arange(math.floor(lo), math.ceil(hi) + 1)
        ext, mid = [], []
        for b0 in bins:
            sel = (a >= b0) & (a < b0 + 1)
            if sel.sum() < 2:
                ext.append(np.nan); mid.append(np.nan)
                continue
            ext.append(b[sel].max() - b[sel].min() + 1.0)
            mid.append((b[sel].max() + b[sel].min()) / 2)
        return bins + 0.5, np.array(ext), np.array(mid)

    bu, ev, cv = extents(u, v, umin, umax)     # the roof's width across, at each metre along u
    bv, eu, cu = extents(v, u, vmin, vmax)     # and across, at each metre along v
    endu = (bu < umin + 0.25 * (umax - umin)) | (bu > umax - 0.25 * (umax - umin))
    endv = (bv < vmin + 0.25 * (vmax - vmin)) | (bv > vmax - 0.25 * (vmax - vmin))
    if not endu.any() or not endv.any():
        return None
    wn, vn = float(np.nanmedian(ev[endu])), float(np.nanmedian(cv[endu]))
    wt, ut = float(np.nanmedian(eu[endv])), float(np.nanmedian(cu[endv]))
    if not all(np.isfinite([wn, vn, wt, ut])) or wn > 0.8 * (vmax - vmin) or wt > 0.8 * (umax - umin):
        return None

    def heights(along, across, centre, half, lo, hi):
        out = (along < lo) | (along > hi)
        rid = z[out & (np.abs(across - centre) < 1.0)]
        eav = z[out & (np.abs(across - centre) > half - 1.2)]
        if len(rid) < 3 or len(eav) < 3:
            return None
        return float(np.percentile(rid, 85)), float(np.percentile(eav, 20))

    hn = heights(u, v, vn, wn / 2, ut - wt / 2, ut + wt / 2)
    ht = heights(v, u, ut, wt / 2, vn - wn / 2, vn + wn / 2)
    if not hn or not ht or hn[0] <= hn[1] or ht[0] <= ht[1]:
        return None
    return {"umin": umin - 0.3, "umax": umax + 0.3, "vmin": vmin - 0.3, "vmax": vmax + 0.3, "vn": vn, "wn": wn, "ut": ut, "wt": wt,
            "ridge_n": hn[0], "eave_n": hn[1], "ridge_t": ht[0], "eave_t": ht[1]}


def _flat_poly(pts3, color, uvs, kind, add_poly, up=False):
    a3, b3, c3 = (np.array(pts3[0]), np.array(pts3[1]), np.array(pts3[2]))
    nn = np.cross(b3 - a3, c3 - a3)
    if up and nn[1] < 0:
        pts3, uvs, nn = pts3[::-1], uvs[::-1], -nn
    nn = nn / (np.linalg.norm(nn) or 1)
    add_poly(pts3, tuple(float(q) for q in nn), color, uvs, kind)


def draw_cross(c, S, add_poly, ground, base_z, wall, roofc):
    """Walls round the cross (gables at the four arm ends) and the two wings' roofs."""
    vn, hn, ut, ht = c["vn"], c["wn"] / 2, c["ut"], c["wt"] / 2
    umin, umax, vmin, vmax = c["umin"], c["umax"], c["vmin"], c["vmax"]
    P = [(umin, vn - hn), (ut - ht, vn - hn), (ut - ht, vmin), (ut + ht, vmin), (ut + ht, vn - hn), (umax, vn - hn),
         (umax, vn + hn), (ut + ht, vn + hn), (ut + ht, vmax), (ut - ht, vmax), (ut - ht, vn + hn), (umin, vn + hn)]
    perim = 0.0
    for i in range(12):
        pa, pb = P[i], P[(i + 1) % 12]
        seg = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
        along_u = abs(pb[0] - pa[0]) > abs(pb[1] - pa[1])
        if along_u:     # a side of the nave, or the end of a transept arm
            end = abs(pa[1] - vmin) < 0.01 or abs(pa[1] - vmax) < 0.01
            eave, ridge = (c["eave_t"], c["ridge_t"]) if end else (c["eave_n"], None)
        else:           # a side of a transept arm, or the end of the nave
            end = abs(pa[0] - umin) < 0.01 or abs(pa[0] - umax) < 0.01
            eave, ridge = (c["eave_n"], c["ridge_n"]) if end else (c["eave_t"], None)
        pts = [S(pa[0], pa[1], base_z), S(pb[0], pb[1], base_z), S(pb[0], pb[1], eave)]
        uvs = [(perim, base_z - ground), (perim + seg, base_z - ground), (perim + seg, eave - ground)]
        if end and ridge is not None:
            mid = ((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2)
            pts.append(S(mid[0], mid[1], ridge))
            uvs.append((perim + seg / 2, ridge - ground))
        pts.append(S(pa[0], pa[1], eave))
        uvs.append((perim, eave - ground))
        # the outline runs anticlockwise seen from above, so base, base, top keeps each wall facing out
        _flat_poly(pts, wall, uvs, 0.875, add_poly)
        perim += seg
    ov = 0.4
    kn = (c["ridge_n"] - c["eave_n"]) / max(hn, 0.5)
    kt = (c["ridge_t"] - c["eave_t"]) / max(ht, 0.5)
    en, et = c["eave_n"] - kn * ov, c["eave_t"] - kt * ov
    faces = [
        [(umin - ov, vn - hn - ov, en), (umax + ov, vn - hn - ov, en), (umax + ov, vn, c["ridge_n"]), (umin - ov, vn, c["ridge_n"])],
        [(umin - ov, vn + hn + ov, en), (umin - ov, vn, c["ridge_n"]), (umax + ov, vn, c["ridge_n"]), (umax + ov, vn + hn + ov, en)],
        [(ut - ht - ov, vmin - ov, et), (ut, vmin - ov, c["ridge_t"]), (ut, vmax + ov, c["ridge_t"]), (ut - ht - ov, vmax + ov, et)],
        [(ut + ht + ov, vmin - ov, et), (ut + ht + ov, vmax + ov, et), (ut, vmax + ov, c["ridge_t"]), (ut, vmin - ov, c["ridge_t"])],
    ]
    for f in faces:
        _flat_poly([S(*q) for q in f], roofc, [(0.0, 0.0)] * 4, 1.0, add_poly, up=True)


def draw_tower(tower, c, S, add_poly, ground, base_z, wall, roofc):
    """The tower on the nave's axis where the surface model has it, with a pyramid spire to its measured top."""
    uc = (tower["u0"] + tower["u1"]) / 2
    h = min((tower["u1"] - tower["u0"]) / 2, c["wn"] / 2 + 0.5)
    vc = c["vn"]
    top = tower["top"]
    body_top = max(c["ridge_n"] + 2.0, top - 0.45 * (top - ground))
    corners = [(uc - h, vc - h), (uc + h, vc - h), (uc + h, vc + h), (uc - h, vc + h)]
    for i in range(4):
        pa, pb = corners[i], corners[(i + 1) % 4]
        pts = [S(pa[0], pa[1], base_z), S(pb[0], pb[1], base_z), S(pb[0], pb[1], body_top), S(pa[0], pa[1], body_top)]
        uvs = [(0.0, base_z - ground), (2 * h, base_z - ground), (2 * h, body_top - ground), (0.0, body_top - ground)]
        _flat_poly(pts, wall, uvs, 0.875, add_poly)
    apex = S(uc, vc, top)
    for i in range(4):
        pa, pb = corners[i], corners[(i + 1) % 4]
        _flat_poly([S(pa[0], pa[1], body_top), S(pb[0], pb[1], body_top), apex], roofc, [(0.0, 0.0)] * 3, 1.0, add_poly, up=True)


def surveyed_outlines():
    """The surveyed building outlines twin_buildings.py draws (the site tile), in UTM."""
    osm = json.loads((tc.SRC / "osm_raw.json").read_text(encoding="utf-8"))
    out = []
    for el in osm.get("elements", []):
        if "building" in el.get("tags", {}) and el.get("type") == "way" and el.get("geometry"):
            lat = np.array([g["lat"] for g in el["geometry"]])
            lon = np.array([g["lon"] for g in el["geometry"]])
            x, y = tc.latlon_to_local(lat, lon)
            if len(lat) < 4 or np.abs(np.concatenate([x, y])).max() > INNER:
                continue
            e, n = tc.to_utm32(lat, lon)
            out.append(np.stack([e, n], 1))
    return out


def in_polygons(e, n, polys):
    """Which points (UTM) lie in any of the polygons (even-odd rule)."""
    e, n = np.asarray(e, np.float64), np.asarray(n, np.float64)
    hit = np.zeros(e.shape, bool)
    for p in polys:
        inside = np.zeros(e.shape, bool)
        for i in range(len(p) - 1):
            x0, y0 = p[i]
            x1, y1 = p[i + 1]
            if y0 == y1:
                continue
            cross = ((y0 > n) != (y1 > n)) & (e < (x1 - x0) * (n - y0) / (y1 - y0) + x0)
            inside ^= cross
        hit |= inside
    return hit


def main():
    reg = json.loads((tc.CACHE / "matrikkel_buildings.json").read_text(encoding="utf-8"))["buildings"]
    surveyed = surveyed_outlines()
    standing = [b for b in reg if b["status"] in STANDING]
    covered = in_polygons([b["e"] for b in standing], [b["n"] for b in standing], surveyed)
    pts = []
    for b, cov in zip(standing, covered):
        if cov:                                       # a surveyed outline: twin_buildings.py
            continue
        xt, yt = tc.utm_to_true(b["e"], b["n"])
        if max(abs(float(xt)), abs(float(yt))) > OUTER:
            continue
        pts.append(b)
    cells = sorted({(int(b["e"] // CELL), int(b["n"] // CELL)) for b in pts})
    print(f"registered buildings out to {OUTER / 1000:.1f} km without a surveyed outline: {len(pts)} in {len(cells)} cells of {CELL:.0f} m "
          f"({int(covered.sum())} more have one, in the site tile)")

    # fetch the laser data and photos (cached), a few at a time
    def prep(c):
        cell_raster("NHM_DTM_25832", *c)
        cell_raster("NHM_DOM_25832", *c)
        cell_aerial(*c)
        return c
    with cf.ThreadPoolExecutor(4) as ex:
        for k, _ in enumerate(ex.map(prep, cells)):
            if k % 25 == 0:
                print(f"  cells fetched: {k + 1}/{len(cells)}")

    by_cell: dict[tuple[int, int], list] = {}
    for b in pts:
        by_cell.setdefault((int(b["e"] // CELL), int(b["n"] // CELL)), []).append(b)

    records, missing = [], Counter()
    pos, nrm, col, wuv, kind_attr, idx = [], [], [], [], [], []

    def add_poly(points3, normal, color, uvs, kind):
        base = len(pos)
        for p, uvv in zip(points3, uvs):
            pos.append(p); nrm.append(normal); col.append(color); wuv.append(uvv); kind_attr.append(kind)
        for i in range(1, len(points3) - 1):
            idx.extend([base, base + i, base + i + 1])

    # within one 576 m cell the maps from UTM to the scene frame and to the true frame are quadratics to
    # far under a centimetre: fit them once per cell from the exact maps, then place every vertex with them.
    # A building inside the inner 1.3 km square is placed in the scene frame like the terrain there,
    # one beyond it in the true frame, bent by the curvature.
    fit = {"local": False}

    def to_scene(e, n, z):
        mode = "l" if fit["local"] else "t"
        (ec, nc), cx, cy = fit["c"], fit[mode + "x"], fit[mode + "y"]
        de, dn = (np.asarray(e, np.float64) - ec) / 100.0, (np.asarray(n, np.float64) - nc) / 100.0
        terms = [np.ones_like(de), de, dn, de * de, de * dn, dn * dn]
        x = sum(k * t for k, t in zip(cx, terms))
        y = sum(k * t for k, t in zip(cy, terms))
        return x, y, np.asarray(z, np.float64) - (0.0 if fit["local"] else tc.curvature_drop(x, y))

    done_blobs = set()
    centres: list[tuple[float, float, float]] = []
    inner_rings: list[np.ndarray] = []        # footprints within 1.3 km, for the tree step's building mask
    for c in cells:
        ec, nc = (c[0] + 0.5) * CELL, (c[1] + 0.5) * CELL
        s = np.linspace(-CELL / 2 - MARGIN, CELL / 2 + MARGIN, 7)
        ge, gn = np.meshgrid(ec + s, nc + s)
        de, dn = (ge.ravel() - ec) / 100.0, (gn.ravel() - nc) / 100.0
        A = np.stack([np.ones_like(de), de, dn, de * de, de * dn, dn * dn], 1)
        fit["c"] = (ec, nc)
        for mode, f in (("t", tc.utm_to_true), ("l", tc.utm_to_local)):
            tx, ty = f(ge.ravel(), gn.ravel())
            fit[mode + "x"] = np.linalg.lstsq(A, tx, rcond=None)[0]
            fit[mode + "y"] = np.linalg.lstsq(A, ty, rcond=None)[0]
            resid = max(np.abs(A @ fit[mode + "x"] - tx).max(), np.abs(A @ fit[mode + "y"] - ty).max())
            assert resid < 0.005, f"cell {c}: quadratic map off by {resid:.4f} m"
        dtm, e0, n1 = cell_raster("NHM_DTM_25832", *c)
        dom, _, _ = cell_raster("NHM_DOM_25832", *c)
        rgb = cell_aerial(*c)
        H, W = dtm.shape
        ndsm = np.nan_to_num(dom - dtm, nan=0.0)
        domf = np.nan_to_num(dom, nan=0.0)
        rough = np.abs(domf - ndi.median_filter(domf, size=3))
        lap = np.abs(ndi.laplace(ndi.gaussian_filter(domf, 0.6)))
        green = rgb[..., 1] - 0.5 * (rgb[..., 0] + rgb[..., 2])
        water = np.nan_to_num(dtm, nan=0.0) <= 0.003
        # the surveyed outlines' buildings are twin_buildings.py's: nothing here is found in or grows into them
        occ = Image.new("L", (W, H), 0)
        dr_ = ImageDraw.Draw(occ)
        for p in surveyed:
            if p[:, 0].max() < e0 or p[:, 0].min() > e0 + W or p[:, 1].max() < n1 - H or p[:, 1].min() > n1:
                continue
            dr_.polygon([(float(q[0] - e0), float(n1 - q[1])) for q in p], fill=255)
        occupied = ndi.binary_dilation(np.asarray(occ) > 0, iterations=1)
        # a roof: 2 m or more over the ground and smooth; green only when it is very smooth and plane
        # (a turf roof, common on cabins and old houses here; a tree crown is never that smooth)
        cand = (ndsm > 2.0) & ~water & ~occupied & (((rough < 0.35) & (lap < 0.7) & (green < 12)) | ((rough < 0.1) & (lap < 0.4)))
        cand = ndi.binary_closing(ndi.binary_opening(cand, iterations=1), iterations=1)
        lab, nlab = ndi.label(cand)
        groups: dict[int, list] = {}
        where: dict[str, tuple[int, int]] = {}
        seeded: list = []
        for b in by_cell[c]:
            col_, row_ = int(b["e"] - e0), int(n1 - b["n"])
            if not (0 <= row_ < H and 0 <= col_ < W):
                missing["outside cell"] += 1
                continue
            L = lab[row_, col_]
            if L == 0:
                r0, r1_ = max(0, row_ - 6), min(H, row_ + 7)
                c0, c1 = max(0, col_ - 6), min(W, col_ + 7)
                win = lab[r0:r1_, c0:c1]
                ys, xs = np.nonzero(win)
                if len(ys):
                    d = (ys + r0 - row_) ** 2 + (xs + c0 - col_) ** 2
                    k = int(np.argmin(d))
                    L = win[ys[k], xs[k]]
                    row_, col_ = int(ys[k] + r0), int(xs[k] + c0)
            if L == 0:
                seeded.append((b, int(b["e"] - e0), int(n1 - b["n"])))
                continue
            groups.setdefault(int(L), []).append(b)
            where[b["nr"]] = (row_, col_)
        objs_ = ndi.find_objects(lab)
        regions = []
        # registered buildings with no smooth roof at their point (small steep roofs, boathouses over the
        # shore): grow the building from the laser heights round the point, within a radius that fits its
        # registered type, leaving out only what is clearly a tree
        loose = (ndsm > 1.8) & (rough < 0.5) & ~occupied & ~np.isin(lab, list(groups.keys()))   # not a neighbour's roof
        for b, col_, row_ in seeded:
            R = SEED_RADIUS.get(b["group"], 12)
            r0, r1_ = max(0, row_ - R - 2), min(H, row_ + R + 3)
            c0, c1 = max(0, col_ - R - 2), min(W, col_ + R + 3)
            win = loose[r0:r1_, c0:c1]
            yy, xx = np.mgrid[r0:r1_, c0:c1]
            disc = (yy - row_) ** 2 + (xx - col_) ** 2 <= R * R
            lab3, _ = ndi.label(win & disc)
            k3 = lab3[row_ - r0, col_ - c0] if (0 <= row_ - r0 < lab3.shape[0] and 0 <= col_ - c0 < lab3.shape[1]) else 0
            if k3 == 0:
                ys3, xs3 = np.nonzero(lab3)
                if len(ys3):
                    j3 = int(np.argmin((ys3 + r0 - row_) ** 2 + (xs3 + c0 - col_) ** 2))
                    if (ys3[j3] + r0 - row_) ** 2 + (xs3[j3] + c0 - col_) ** 2 <= 9:
                        k3 = lab3[ys3[j3], xs3[j3]]
            if k3 == 0:
                missing["no roof in the laser data: " + b["group"]] += 1
                continue
            regions.append(([b], lab3 == k3, (slice(r0, r1_), slice(c0, c1))))
        for L, members in groups.items():
            if (c, L) in done_blobs:
                continue
            done_blobs.add((c, L))
            sl = objs_[L - 1]
            sl = (slice(max(0, sl[0].start - 8), min(H, sl[0].stop + 8)), slice(max(0, sl[1].start - 8), min(W, sl[1].stop + 8)))
            comp = lab[sl] == L
            if len(members) > 1:
                # several registered buildings under one roof outline (a house and its garage, a row of
                # boathouses): each pixel goes to the nearest registered point
                markers = np.zeros(comp.shape, np.int32)
                for k_, m_ in enumerate(members, start=1):
                    rr_, cc_ = where[m_["nr"]]
                    markers[rr_ - sl[0].start, cc_ - sl[1].start] = k_
                _, (iy, ix) = ndi.distance_transform_edt(markers == 0, return_indices=True)
                owner = markers[iy, ix]
                for k_, m_ in enumerate(members, start=1):
                    part = comp & (owner == k_)
                    if part.sum() >= 8:
                        regions.append(([m_], part, sl))
                    else:
                        missing["shares a roof"] += 1
            else:
                m_ = members[0]
                cap = MAX_AREA.get(m_["group"], 5000)
                part = comp
                if part.sum() > cap:
                    # one registered building in a much larger smooth patch (joined to a neighbour's
                    # roof, a pier, a hedge): wear the patch down until the building stands alone
                    rr_, cc_ = where[m_["nr"]]
                    p0 = (rr_ - sl[0].start, cc_ - sl[1].start)
                    for it in range(1, 8):
                        er = ndi.binary_erosion(comp, iterations=it)
                        lab2, _ = ndi.label(er)
                        k2 = lab2[p0]
                        if k2 == 0:
                            ys2, xs2 = np.nonzero(lab2)
                            if not len(ys2):
                                break
                            j2 = int(np.argmin((ys2 - p0[0]) ** 2 + (xs2 - p0[1]) ** 2))
                            k2 = lab2[ys2[j2], xs2[j2]]
                        core = lab2 == k2
                        grown = ndi.binary_dilation(core, iterations=it) & comp
                        part = grown
                        if grown.sum() <= cap:
                            break
                    if part.sum() > cap * 1.5:
                        missing["odd size"] += 1
                        continue
                regions.append(([m_], part, sl))
        # grow every building's roof together, metre by metre, into the smooth laser heights next to it: the
        # smooth-roof test loses a roof's edges, ridges and valleys (a church's cross falls apart), and this
        # joins them up again; no building grows into another (GROW_STEPS, GROW_ROUGH: calibrated)
        owner_full = np.zeros((H, W), np.int32)
        owner_full[occupied] = -1
        for k_, (members, part, sl) in enumerate(regions, start=1):
            sub = owner_full[sl]
            sub[part & (sub == 0)] = k_
        grow_ok = (ndsm > 1.8) & (rough < GROW_ROUGH) & ~water & ~occupied
        for _ in range(GROW_STEPS):
            dil = ndi.grey_dilation(owner_full, size=3)
            new = (owner_full == 0) & grow_ok & (dil > 0)
            if not new.any():
                break
            owner_full[new] = dil[new]
        grown_objs = ndi.find_objects(owner_full)
        for k_, (members, part, sl) in enumerate(regions, start=1):
            if k_ > len(grown_objs) or grown_objs[k_ - 1] is None:
                missing["too small"] += len(members)
                continue
            gsl = grown_objs[k_ - 1]
            ys, xs = np.nonzero(owner_full[gsl] == k_)
            ys, xs = ys + gsl[0].start, xs + gsl[1].start
            part = np.zeros((H, W), bool)
            part[ys, xs] = True
            sl = (slice(0, H), slice(0, W))
            area = len(ys)
            if area < 8:
                missing["too small"] += len(members)
                continue
            E = e0 + xs + 0.5
            N = n1 - ys - 0.5
            ctr, Lr, Wr, a = obb(np.stack([E, N], 1))
            if Wr < 1.5 or Lr < 2.0:
                missing["too small"] += len(members)
                continue
            # the same roof seen from two cells (a building on a cell border): keep the first
            if any(abs(ctr[0] - q[0]) < 1.5 and abs(ctr[1] - q[1]) < 1.5 and abs(Lr - q[2]) < 2.0 for q in centres):
                continue
            centres.append((float(ctr[0]), float(ctr[1]), float(Lr)))
            # the frame it is placed in: the scene frame inside the inner 1.3 km square, the true frame beyond
            dce, dcn = (ctr[0] - fit["c"][0]) / 100.0, (ctr[1] - fit["c"][1]) / 100.0
            t6 = np.array([1.0, dce, dcn, dce * dce, dce * dcn, dcn * dcn])
            fit["local"] = max(abs(float(t6 @ fit["lx"])), abs(float(t6 @ fit["ly"]))) < INNER
            cs, sn = math.cos(a), math.sin(a)
            rel = np.stack([E - ctr[0], N - ctr[1]], 1) @ np.array([[cs, -sn], [sn, cs]])
            u, v = rel[:, 0], rel[:, 1]
            z = dom[ys, xs].astype(np.float64)
            okz = np.isfinite(z)
            u, v, z = u[okz], v[okz], z[okz]
            if len(z) < 6:
                missing["no roof data"] += len(members)
                continue
            grp = min((m["group"] for m in members), key=lambda g: PRIORITY.index(g) if g in PRIORITY else 99)
            corners = np.array([[-Lr / 2, -Wr / 2], [Lr / 2, -Wr / 2], [Lr / 2, Wr / 2], [-Lr / 2, Wr / 2]])
            ringE = corners @ np.array([[cs, sn], [-sn, cs]]) + ctr
            if fit["local"]:
                inner_rings.append(ringE.copy())
            # the ground: the lower part of the terrain model just outside the outline
            ring_px = np.stack([(ringE[:, 0] - e0), (n1 - ringE[:, 1])], 1)
            gmask = Image.new("L", (W, H), 0)
            ImageDraw.Draw(gmask).polygon([tuple(p) for p in ring_px], fill=255)
            gm = np.asarray(gmask) > 0
            band = ndi.binary_dilation(gm, iterations=2) & ~gm
            gvals = dtm[band]
            gvals = gvals[np.isfinite(gvals)]
            if not len(gvals):
                missing["no ground"] += len(members)
                continue
            ground = float(np.percentile(gvals, 20))
            gmin = float(np.min(gvals))
            # churches: the tower is where the raw surface (steep, so outside the smooth roof mask)
            # rises more than 3 m over the nave's ridge, at or next to the building
            tower = None
            body_z = z
            if grp == "church" and any(m_["type"] == 671 for m_ in members):
                ridge0 = float(np.percentile(z, 70))
                near = ndi.binary_dilation(part, iterations=4)
                ty, tx = np.nonzero(near)
                ty, tx = ty + sl[0].start, tx + sl[1].start
                tz = dom[ty, tx]
                hi = np.isfinite(tz) & (tz > ridge0 + 3.0)
                if hi.any():
                    top = float(np.nanmax(tz))
                    # the tower's body: next to the highest point, everything over the ridge by 1.5 m
                    k_top = int(np.nanargmax(np.where(hi, tz, -np.inf)))
                    body = np.isfinite(tz) & (tz > ridge0 + 1.5) & (np.hypot(ty - ty[k_top], tx - tx[k_top]) < 6)
                    Eb, Nb = e0 + tx[body] + 0.5, n1 - ty[body] - 0.5
                    relb = np.stack([Eb - ctr[0], Nb - ctr[1]], 1) @ np.array([[cs, -sn], [sn, cs]])
                    uc, vc = float(np.median(relb[:, 0])), float(np.median(relb[:, 1]))
                    hu = max(2.0, (relb[:, 0].max() - relb[:, 0].min()) / 2 + 0.5)
                    hv = max(2.0, (relb[:, 1].max() - relb[:, 1].min()) / 2 + 0.5)
                    hu = hv = min(4.5, max(hu, hv))
                    tower = {"u0": uc - hu, "u1": uc + hu, "v0": vc - hv, "v1": vc + hv, "top": top}
                    inside_t = (u > uc - hu) & (u < uc + hu) & (v > vc - hv) & (v < vc + hv)
                    body_z = np.where(inside_t, np.nan, z)
            keep = np.isfinite(body_z)
            m = fit_roof(u[keep], v[keep], body_z[keep], Lr, Wr)
            if m["kind"] in ("gable", "hip") and m["slope"] <= 0:
                m = {"kind": "flat", "ridge": float(np.median(z)), "eave": float(np.median(z))}
            roof_rgb = roof_colour(rgb[ys, xs])
            kind = KIND.get(grp, "house")
            key = members[0]["nr"]
            wall_srgb = SPECIAL_WALL.get(grp) or pick_wall(kind, key)
            wall = lin(wall_srgb)
            wall_kind = 0.875 if grp == "church" else {"house": 0.0, "barn": 0.25, "shed": 0.5, "big": 0.75}[kind]
            roofc = lin(np.clip(roof_rgb * 0.96, 0, 1))

            # ---- a cross church (a cruciform roof fills far less of its rectangle than a plain one):
            # two gabled wings crossing, each measured from the surface model, the tower on the nave
            if grp == "church" and any(m_["type"] == 671 for m_ in members) and area / (Lr * Wr) < 0.78:
                cross = cruciform(u[keep], v[keep], body_z[keep], tower)
                if cross:
                    def S(uu, vv, zz):
                        w_ = np.array([uu, vv]) @ np.array([[cs, sn], [-sn, cs]]) + ctr
                        x_, y_, z_ = to_scene(w_[0], w_[1], zz)
                        return (float(x_), float(z_), float(-y_))
                    draw_cross(cross, S, add_poly, ground, gmin - 1.0, wall, roofc)
                    if tower:
                        draw_tower(tower, cross, S, add_poly, ground, gmin - 1.0, wall, roofc)
                    cx, cy, _ = to_scene(ctr[0], ctr[1], 0.0)
                    records.append({"nr": [m_["nr"] for m_ in members], "types": sorted({m_["type"] for m_ in members}), "group": grp,
                                    "x": round(float(cx), 1), "y": round(float(cy), 1), "e": round(float(ctr[0]), 1), "n": round(float(ctr[1]), 1),
                                    "L": round(Lr, 1), "W": round(Wr, 1), "angle_deg": round(math.degrees(a), 1), "ground": round(ground, 2),
                                    "roof": "cross", "cross": {k: round(float(v_), 2) for k, v_ in cross.items()}, "ridge": round(float(np.nanmax(z)), 2),
                                    "tower": tower, "roof_rgb": [round(float(q), 3) for q in roof_rgb], "wall_rgb": list(wall_srgb)})
                    continue

            # ---- walls: from below the ground (no gap on a slope) to the roof at the outline
            top = roof_z(m, corners[:, 0], corners[:, 1], Lr, Wr)
            top = np.maximum(top, ground + 2.2)
            base_z = gmin - 1.0
            nv = 4
            ridge_at = {}
            if m["kind"] == "gable":
                for i in range(nv):
                    j = (i + 1) % nv
                    a0 = (corners[i, 1] if m["axis"] == "u" else corners[i, 0]) - m["off"]
                    a1 = (corners[j, 1] if m["axis"] == "u" else corners[j, 0]) - m["off"]
                    if a0 * a1 < 0:
                        ridge_at[i] = a0 / (a0 - a1)
            perim = 0.0
            for i in range(nv):
                j = (i + 1) % nv
                p0, p1 = corners[i], corners[j]
                seg = float(np.hypot(*(p1 - p0)))
                cols_ = [(p0, top[i], 0.0)]
                if i in ridge_at:
                    t = ridge_at[i]
                    pm = p0 + (p1 - p0) * t
                    cols_.append((pm, float(roof_z(m, np.array([pm[0]]), np.array([pm[1]]), Lr, Wr)[0]), seg * t))
                cols_.append((p1, top[j], seg))
                # outward normal in the building's frame, then to the scene
                nu, nvv = (p1[1] - p0[1]) / seg, -(p1[0] - p0[0]) / seg
                if np.dot((p0 + p1) / 2, [nu, nvv]) < 0:
                    nu, nvv = -nu, -nvv
                ne = np.array([nu, nvv]) @ np.array([[cs, sn], [-sn, cs]])
                for k2 in range(len(cols_) - 1):
                    qa, qb = cols_[k2], cols_[k2 + 1]
                    ea = qa[0] @ np.array([[cs, sn], [-sn, cs]]) + ctr
                    eb = qb[0] @ np.array([[cs, sn], [-sn, cs]]) + ctr
                    xa, ya, za0 = to_scene(ea[0], ea[1], base_z)
                    _, _, za1 = to_scene(ea[0], ea[1], qa[1])
                    xb, yb, zb0 = to_scene(eb[0], eb[1], base_z)
                    _, _, zb1 = to_scene(eb[0], eb[1], qb[1])
                    quad = [(float(xa), float(za0), float(-ya)), (float(xb), float(zb0), float(-yb)), (float(xb), float(zb1), float(-yb)), (float(xa), float(za1), float(-ya))]
                    quv = [(perim + qa[2], base_z - ground), (perim + qb[2], base_z - ground), (perim + qb[2], qb[1] - ground), (perim + qa[2], qa[1] - ground)]
                    n3 = (float(ne[0]), 0.0, float(-ne[1]))
                    e1 = np.subtract(quad[1], quad[0]); e2 = np.subtract(quad[3], quad[0])
                    if np.dot(np.cross(e1, e2), n3) < 0:
                        quad = quad[::-1]; quv = quv[::-1]
                    add_poly(quad, n3, wall, quv, wall_kind)
                perim += seg

            # ---- roof, with a small overhang
            ov = 0.35
            Lh, Wh = Lr / 2 + ov * 0.7, Wr / 2 + ov

            def P(uu, vv):
                w_ = np.array([uu, vv]) @ np.array([[cs, sn], [-sn, cs]]) + ctr
                zz = float(roof_z(m, np.array([uu]), np.array([vv]), Lr, Wr)[0])
                x_, y_, z_ = to_scene(w_[0], w_[1], zz)
                return (float(x_), float(z_), float(-y_))

            def roof_face(fuv):
                pts3 = [P(uu, vv) for uu, vv in fuv]
                a3, b3, c3 = (np.array(pts3[0]), np.array(pts3[1]), np.array(pts3[2]))
                nn = np.cross(b3 - a3, c3 - a3)
                if nn[1] < 0:
                    pts3 = pts3[::-1]
                    nn = -nn
                nn = nn / (np.linalg.norm(nn) or 1)
                add_poly(pts3, tuple(float(q) for q in nn), roofc, [(0.0, 0.0)] * len(pts3), 1.0)

            if m["kind"] == "gable":
                o = m["off"]
                if m["axis"] == "u":
                    faces = [[(-Lh, o), (Lh, o), (Lh, Wh), (-Lh, Wh)], [(-Lh, -Wh), (Lh, -Wh), (Lh, o), (-Lh, o)]]
                else:
                    faces = [[(o, -Wh), (o, Wh), (Lh, Wh), (Lh, -Wh)], [(-Lh, -Wh), (-Lh, Wh), (o, Wh), (o, -Wh)]]
            elif m["kind"] == "hip":
                r0 = max(0.0, (Lr - Wr) / 2)
                faces = [[(-Lh, Wh), (Lh, Wh), (r0, 0), (-r0, 0)], [(Lh, -Wh), (-Lh, -Wh), (-r0, 0), (r0, 0)], [(Lh, Wh), (Lh, -Wh), (r0, 0)], [(-Lh, -Wh), (-Lh, Wh), (-r0, 0)]]
            else:
                faces = [[(-Lh, -Wh), (Lh, -Wh), (Lh, Wh), (-Lh, Wh)]]
            for fc in faces:
                roof_face(fc)

            # ---- a church tower with its spire
            if tower:
                tu0, tu1, tv0, tv1 = tower["u0"], tower["u1"], tower["v0"], tower["v1"]
                eave_t = max(float(roof_z(m, np.array([(tu0 + tu1) / 2]), np.array([(tv0 + tv1) / 2]), Lr, Wr)[0]) + 2.0, tower["top"] - 0.45 * (tower["top"] - ground))
                tc4 = [(tu0, tv0), (tu1, tv0), (tu1, tv1), (tu0, tv1)]
                for i in range(4):
                    pa, pb = tc4[i], tc4[(i + 1) % 4]
                    ea = np.array(pa) @ np.array([[cs, sn], [-sn, cs]]) + ctr
                    eb = np.array(pb) @ np.array([[cs, sn], [-sn, cs]]) + ctr
                    xa, ya, za0 = to_scene(ea[0], ea[1], base_z)
                    _, _, za1 = to_scene(ea[0], ea[1], eave_t)
                    xb, yb, zb0 = to_scene(eb[0], eb[1], base_z)
                    _, _, zb1 = to_scene(eb[0], eb[1], eave_t)
                    mid = (np.array(pa) + np.array(pb)) / 2 - np.array([(tu0 + tu1) / 2, (tv0 + tv1) / 2])
                    ne = mid / (np.linalg.norm(mid) or 1) @ np.array([[cs, sn], [-sn, cs]])
                    n3 = (float(ne[0]), 0.0, float(-ne[1]))
                    quad = [(float(xa), float(za0), float(-ya)), (float(xb), float(zb0), float(-yb)), (float(xb), float(zb1), float(-yb)), (float(xa), float(za1), float(-ya))]
                    seg = float(np.hypot(pb[0] - pa[0], pb[1] - pa[1]))
                    quv = [(0.0, base_z - ground), (seg, base_z - ground), (seg, eave_t - ground), (0.0, eave_t - ground)]
                    e1 = np.subtract(quad[1], quad[0]); e2 = np.subtract(quad[3], quad[0])
                    if np.dot(np.cross(e1, e2), n3) < 0:
                        quad = quad[::-1]; quv = quv[::-1]
                    add_poly(quad, n3, wall, quv, 0.875)
                apex_e = np.array([(tu0 + tu1) / 2, (tv0 + tv1) / 2]) @ np.array([[cs, sn], [-sn, cs]]) + ctr
                ax_, ay_, az_ = to_scene(apex_e[0], apex_e[1], tower["top"])
                apex = (float(ax_), float(az_), float(-ay_))
                for i in range(4):
                    pa, pb = tc4[i], tc4[(i + 1) % 4]
                    ea = np.array(pa) @ np.array([[cs, sn], [-sn, cs]]) + ctr
                    eb = np.array(pb) @ np.array([[cs, sn], [-sn, cs]]) + ctr
                    xa, ya, za = to_scene(ea[0], ea[1], eave_t)
                    xb, yb, zb = to_scene(eb[0], eb[1], eave_t)
                    tri = [(float(xa), float(za), float(-ya)), (float(xb), float(zb), float(-yb)), apex]
                    a3, b3, c3 = (np.array(tri[0]), np.array(tri[1]), np.array(tri[2]))
                    nn = np.cross(b3 - a3, c3 - a3)
                    if nn[1] < 0:
                        tri = tri[::-1]; nn = -nn
                    nn = nn / (np.linalg.norm(nn) or 1)
                    add_poly(tri, tuple(float(q) for q in nn), roofc, [(0.0, 0.0)] * 3, 1.0)

            cx, cy, _ = to_scene(ctr[0], ctr[1], 0.0)
            records.append({"nr": [m_["nr"] for m_ in members], "types": sorted({m_["type"] for m_ in members}), "group": grp,
                            "x": round(float(cx), 1), "y": round(float(cy), 1), "e": round(float(ctr[0]), 1), "n": round(float(ctr[1]), 1),
                            "L": round(Lr, 1), "W": round(Wr, 1), "angle_deg": round(math.degrees(a), 1), "ground": round(ground, 2),
                            "roof": m["kind"], "ridge": round(float(np.nanmax(z)), 2),
                            "pitch_deg": round(math.degrees(math.atan(m.get("slope", 0.0))), 1) if m["kind"] in ("gable", "hip") else 0.0,
                            "tower": tower, "roof_rgb": [round(float(q), 3) for q in roof_rgb], "wall_rgb": list(wall_srgb)})

    # compact: no normals (every face is flat: the material shades by face), 8-bit colours with the kind
    # of face in the alpha byte, positions and wall coordinates as 16-bit integers (KHR_mesh_quantization),
    # and chunks small enough for 16-bit indices
    P3 = np.array(pos, np.float32)
    C8 = np.clip(np.rint(np.array(col, np.float64) * 255), 0, 255).astype(np.uint8)
    UV = np.array(wuv, np.float32)
    K8 = np.clip(np.rint(np.array(kind_attr, np.float64) * 255), 0, 255).astype(np.uint8)
    C8 = np.concatenate([C8[:, :3], K8.reshape(-1, 1)], axis=1)
    uv_scale = float(np.ceil(np.abs(UV).max() + 1.0))
    I = np.array(idx, np.int64).reshape(-1, 3)
    meshes = []
    tri_first = I.min(1)
    start_t, nchunk = 0, 0
    while start_t < len(I):
        v0 = int(tri_first[start_t])
        end_t = int(np.searchsorted(tri_first, v0 + 65000, side="left"))
        end_t = max(end_t, start_t + 1)
        tri = I[start_t:end_t]
        v1 = int(tri.max()) + 1
        meshes.append({"name": f"buildings_far_{nchunk}", "position": P3[v0:v1], "color": C8[v0:v1], "uv": UV[v0:v1],
                       "index": (tri - v0).astype(np.uint32), "quantize": True, "uv_scale": uv_scale,
                       "material": {"name": "buildings", "roughness": 0.85, "vertexColors": True},
                       "extras": {"kind": "COLOR_0 alpha: 0 house wall, 0.25 barn wall, 0.5 shed wall, 0.75 large building wall, 0.875 church wall, 1 roof; TEXCOORD_0 times uv_scale on walls = metres along the wall and above the ground; no normals: shade flat",
                                  "uv_scale": uv_scale}})
        start_t, nchunk = end_t, nchunk + 1
    size = tc.write_glb(tc.OUT / "buildings_far.glb", meshes, extras={
        "source": "Kartverket Matrikkelen - Bygningspunkt (which buildings, their type); Kartverket NHM DOM/DTM 1 m (footprint, roof, height); roof colour from the aerial photo; wall colours by registered type (not measured)",
        "frame": "true frame (twin_common.py), bent by the earth's curvature", "uv_scale": uv_scale})
    (tc.CACHE / "buildings_far.json").write_text(json.dumps(records, indent=1), encoding="utf-8")
    # the buildings within 1.3 km join the surveyed ones in the tree step's building mask
    if inner_rings:
        dtm1 = tc.UtmRaster.load("dtm1")
        mpath = tc.CACHE / "building_mask.npy"
        mask = np.load(mpath) if mpath.exists() else np.zeros(dtm1.a.shape, bool)
        img = Image.fromarray(mask.astype(np.uint8) * 255)
        dr = ImageDraw.Draw(img)
        for rgE in inner_rings:
            dr.polygon([(float((q[0] - dtm1.e_min) / dtm1.pix), float((dtm1.n_max - q[1]) / dtm1.pix)) for q in rgE], fill=255)
        np.save(mpath, np.asarray(img) > 0)
        print(f"  building mask: {len(inner_rings)} footprints within 1.3 km added")
    shared = sum(len(r["nr"]) for r in records)
    print(f"buildings drawn: {len(records)} (covering {shared} registered buildings), roofs {Counter(r['roof'] for r in records)}")
    print(f"  groups: {Counter(r['group'] for r in records).most_common()}")
    print(f"  not found in the laser data: {sum(missing.values())} {dict(missing)}")
    print(f"  churches: {[(r['x'], r['y'], r['ridge'], r['tower']) for r in records if r['group'] == 'church']}")
    print(f"  mesh: {len(pos)} vertices, {len(idx) // 3} triangles, {size // 1024} KB")


if __name__ == "__main__":
    main()
