"""Every building within 1.3 km of the site, with its real roof, from Kartverket's laser data.

Footprints: OpenStreetMap where it has them (the site tile, source/osm_raw.json), otherwise found in
the laser data itself: surface 2 m or more above the ground, smooth like a roof, and not green in the
aerial photo. Roofs: each footprint's 1 m surface model is fitted with flat, shed, gable (either way)
and hipped roofs, and the best fit is kept, so ridge direction, pitch, eaves and ridge height are
measured, not assumed. Roof colour is the median of the aerial photo on the roof. Wall colours are
not in any data set; they follow the building type (barns red, houses mostly white), and say so.

Outputs:
  site/public/twin/buildings.glb    one mesh: walls and roofs with colours and wall coordinates
  source/twin/building_mask.npy     building pixels on the 1 m raster (used by twin_trees.py)
  source/twin/buildings.json        the fitted records (also used by twin_trees.py)
Run after twin_fetch.py: python pipeline/twin_buildings.py
"""
from __future__ import annotations

import hashlib
import json
import math

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

import twin_common as tc

Image.MAX_IMAGE_PIXELS = None
HALF = 1280.0


def lin(c):
    """sRGB 0..1 to linear light: glTF vertex colours are linear."""
    c = np.asarray(c, np.float64)
    return tuple(float(v) for v in np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4))


def h01(*parts):
    """Deterministic 0..1 from any key."""
    d = hashlib.sha1("|".join(map(str, parts)).encode()).digest()
    return int.from_bytes(d[:4], "little") / 2**32


class Aerial:
    """The colour-matched ring textures, sampled at scene coordinates (finest available)."""

    def __init__(self):
        man = json.loads((tc.OUT / "twin.json").read_text(encoding="utf-8"))
        self.rings = []
        for r in man["rings"][:2]:
            im = np.asarray(Image.open(tc.OUT / r["files"]["aerial"]).convert("RGB"), np.float32)
            self.rings.append((r["tex_half"], im))

    def sample(self, x, y):
        x, y = np.asarray(x, np.float64), np.asarray(y, np.float64)
        out = np.zeros(x.shape + (3,), np.float32)
        done = np.zeros(x.shape, bool)
        for th, im in self.rings:
            n = im.shape[0]
            inside = (np.abs(x) < th) & (np.abs(y) < th) & ~done
            c = np.clip(((x + th) / (2 * th) * n).astype(int), 0, n - 1)
            r = np.clip(((th - y) / (2 * th) * n).astype(int), 0, n - 1)
            out[inside] = im[r[inside], c[inside]]
            done |= inside
        return out


def obb(points):
    """Minimum-area rectangle of 2D points: centre, length, width, angle of the long side."""
    pts = np.asarray(points, np.float64)
    from scipy.spatial import ConvexHull
    hull = pts[ConvexHull(pts).vertices] if len(pts) >= 3 else pts
    best = None
    for i in range(len(hull)):
        e = hull[(i + 1) % len(hull)] - hull[i]
        a = math.atan2(e[1], e[0])
        c, s = math.cos(a), math.sin(a)
        R = np.array([[c, s], [-s, c]])
        q = hull @ R.T
        mn, mx = q.min(0), q.max(0)
        area = (mx - mn).prod()
        if best is None or area < best[0]:
            ctr = ((mn + mx) / 2) @ R
            best = (area, ctr, mx - mn, a)
    _, ctr, size, a = best
    if size[1] > size[0]:
        size = size[::-1]
        a += math.pi / 2
    return ctr, float(size[0]), float(size[1]), a


def fit_roof(u, v, z, L, W):
    """Fit roof models to surface heights at OBB coordinates (u along the long side, v across)."""
    n = len(z)
    if n < 6:
        return {"kind": "flat", "ridge": float(np.median(z)), "eave": float(np.median(z)), "rss": 0.0}
    A1 = np.ones((n, 1))
    cands = []

    def ls(A):
        coef, res, *_ = np.linalg.lstsq(A, z, rcond=None)
        rss = float(((A @ coef - z) ** 2).sum())
        return coef, rss

    coef, rss = ls(A1)
    cands.append(({"kind": "flat", "ridge": float(coef[0]), "eave": float(coef[0])}, rss, 1))
    coef, rss = ls(np.stack([np.ones(n), u, v], 1))
    cands.append(({"kind": "shed", "a": float(coef[0]), "bu": float(coef[1]), "bv": float(coef[2])}, rss, 3))
    for axis, half_span in (("u", W / 2), ("v", L / 2)):
        best = None
        for off in np.linspace(-0.2, 0.2, 9) * (2 * half_span):
            d = np.abs((v if axis == "u" else u) - off)
            coef, rss = ls(np.stack([np.ones(n), -d], 1))
            if coef[1] > 0 and (best is None or rss < best[1]):
                best = (coef, rss, off)
        if best:
            coef, rss, off = best
            cands.append(({"kind": "gable", "axis": axis, "off": float(off), "ridge": float(coef[0]), "slope": float(coef[1])}, rss, 3))
    d = np.maximum(np.abs(v), np.abs(u) - (L - W) / 2)
    coef, rss = ls(np.stack([np.ones(n), -d], 1))
    if coef[1] > 0:
        cands.append(({"kind": "hip", "ridge": float(coef[0]), "slope": float(coef[1])}, rss, 2))
    # BIC with a floor on the residual (laser noise is ~5 cm)
    def score(c):
        return n * math.log(max(c[1] / n, 0.0025)) + c[2] * math.log(n) * 1.5
    best = min(cands, key=score)
    m = dict(best[0])
    m["rms"] = math.sqrt(best[1] / n)
    # pitch sanity: steeper than 55 degrees is a tree or a wall edge, not a roof
    if m["kind"] in ("gable", "hip") and math.degrees(math.atan(m["slope"])) > 55:
        m = dict(cands[0][0])
        m["rms"] = math.sqrt(cands[0][1] / n)
    return m


def roof_z(m, u, v, L, W):
    k = m["kind"]
    if k == "flat":
        return np.full_like(np.asarray(u, float), m["ridge"])
    if k == "shed":
        return m["a"] + m["bu"] * u + m["bv"] * v
    if k == "gable":
        d = np.abs((v if m["axis"] == "u" else u) - m["off"])
        return m["ridge"] - m["slope"] * d
    d = np.maximum(np.abs(v), np.abs(u) - (L - W) / 2)
    return m["ridge"] - m["slope"] * d


WALLS = {   # (probability, colour) per type; colours of painted wood cladding common on the Sorlandet coast
    "house": [(0.52, (0.93, 0.92, 0.88)), (0.12, (0.86, 0.84, 0.78)), (0.10, (0.88, 0.80, 0.55)), (0.12, (0.56, 0.20, 0.16)), (0.08, (0.32, 0.34, 0.35)), (0.06, (0.70, 0.74, 0.74))],
    "barn": [(0.70, (0.56, 0.17, 0.13)), (0.15, (0.90, 0.89, 0.85)), (0.15, (0.55, 0.55, 0.53))],
    "shed": [(0.50, (0.58, 0.19, 0.15)), (0.35, (0.92, 0.91, 0.87)), (0.15, (0.45, 0.42, 0.38))],
    "big": [(0.55, (0.86, 0.86, 0.84)), (0.25, (0.62, 0.64, 0.64)), (0.20, (0.56, 0.18, 0.14))],
}


def classify(osm_type, area, L, W, height, roof_rgb):
    t = osm_type or ""
    if t in ("barn", "farm_auxiliary", "cowshed", "stable"):
        return "barn"
    if t in ("garage", "garages", "shed", "cabin", "greenhouse"):
        return "shed"
    if t in ("commercial", "industrial", "civic", "retail", "office", "kindergarten", "school"):
        return "big"
    if t in ("house", "detached", "residential", "farm"):
        return "house"
    if area < 35:
        return "shed"
    if area > 260 or (L / max(W, 1) > 2.2 and area > 150):
        return "barn" if height < 11 else "big"
    return "house"


def pick(kind, key):
    r = h01(key)
    acc = 0.0
    for p, c in WALLS[kind]:
        acc += p
        if r <= acc:
            return c
    return WALLS[kind][0][1]


def main():
    dtm = tc.UtmRaster.load("dtm1")
    dom = tc.UtmRaster.load("dom1")
    H, Wd = dtm.a.shape
    aerial = Aerial()

    # scene coordinates of every raster pixel
    rr, cc = np.mgrid[0:H, 0:Wd]
    E = dtm.e_min + (cc + 0.5) * dtm.pix
    N = dtm.n_max - (rr + 0.5) * dtm.pix
    X, Y = tc.utm_to_local(E, N)
    inside = (np.abs(X) < HALF) & (np.abs(Y) < HALF)
    ndsm = dom.a - dtm.a
    water = dtm.a <= 0.003
    rgb = aerial.sample(X, Y)
    green = rgb[..., 1] - 0.5 * (rgb[..., 0] + rgb[..., 2])
    rough = np.abs(dom.a - ndi.median_filter(dom.a, size=3))
    lap = np.abs(ndi.laplace(ndi.gaussian_filter(dom.a, 0.6)))

    def to_px(xy):
        e, n = tc.local_to_utm(np.asarray(xy)[:, 0], np.asarray(xy)[:, 1])
        return np.stack([(e - dtm.e_min) / dtm.pix, (dtm.n_max - n) / dtm.pix], 1)

    # ---------------- OpenStreetMap footprints (site tile)
    osm = json.load(open(tc.SRC / "osm_raw.json", encoding="utf-8"))
    foot = []
    for el in osm.get("elements", []):
        t = el.get("tags", {})
        if "building" not in t or el.get("type") != "way" or not el.get("geometry"):
            continue
        lat = np.array([g["lat"] for g in el["geometry"]])
        lon = np.array([g["lon"] for g in el["geometry"]])
        x, y = tc.latlon_to_local(lat, lon)
        ring = np.stack([x, y], 1)
        if np.allclose(ring[0], ring[-1]):
            ring = ring[:-1]
        if len(ring) < 3 or np.abs(ring).max() > HALF:
            continue
        foot.append({"src": "osm", "id": f"osm-{el['id']}", "type": t.get("building"), "ring": ring})

    osm_mask = Image.new("L", (Wd, H), 0)
    dr = ImageDraw.Draw(osm_mask)
    for f in foot:
        dr.polygon([tuple(p) for p in to_px(f["ring"])], fill=255)
    osm_mask = np.asarray(osm_mask) > 0

    # ---------------- buildings found in the laser data
    cand = inside & ~water & (ndsm > 2.2) & (rough < 0.3) & (lap < 0.6) & (green < 10)
    cand = ndi.binary_opening(cand, iterations=1)
    cand = ndi.binary_closing(cand, iterations=1)
    lab, n = ndi.label(cand)
    objs = ndi.find_objects(lab)
    found = 0
    for k, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        comp = lab[sl] == k
        area = int(comp.sum())
        if area < 14 or area > 6000:
            continue
        if (osm_mask[sl] & comp).sum() > 0.2 * area:
            continue
        ys, xs = np.nonzero(comp)
        px = X[sl][ys, xs]
        py = Y[sl][ys, xs]
        ctr, L, W, a = obb(np.stack([px, py], 1))
        if W < 2.6 or L < 3.5 or L / W > 8:
            continue
        rect = area / (L * W)
        if rect < 0.6:
            continue
        # roofs are smooth; a tree crown that slipped through is rough across the whole patch
        if float(np.median(rough[sl][comp])) > 0.12:
            continue
        c, s = math.cos(a), math.sin(a)
        corners = np.array([[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]])
        ring = corners @ np.array([[c, s], [-s, c]]) + ctr
        foot.append({"src": "lidar", "id": f"lid-{k}", "type": None, "ring": ring})
        found += 1
    print(f"footprints: {sum(f['src'] == 'osm' for f in foot)} from OpenStreetMap, {found} found in the laser data")

    # ---------------- fit roofs and build the mesh
    project = json.load(open(tc.DATA / "buildings.json", encoding="utf-8"))["buildings"]
    proj_existing = [b for b in project if b["status"] == "existing"]

    pos, nrm, col, wuv, kind_attr = [], [], [], [], []
    idx = []
    records = []
    mask_all = Image.new("L", (Wd, H), 0)
    dm = ImageDraw.Draw(mask_all)

    def add_poly(points3, normal, color, uvs, kind):
        base = len(pos)
        for p, uvv in zip(points3, uvs):
            pos.append(p)
            nrm.append(normal)
            col.append(color)
            wuv.append(uvv)
            kind_attr.append(kind)
        for i in range(1, len(points3) - 1):
            idx.extend([base, base + i, base + i + 1])

    for f in foot:
        ring = f["ring"]
        ctr, L, W, a = obb(ring)
        poly_area = 0.5 * abs(np.dot(ring[:, 0], np.roll(ring[:, 1], -1)) - np.dot(ring[:, 1], np.roll(ring[:, 0], -1)))
        rect = poly_area / max(L * W, 1e-6)
        c, s = math.cos(a), math.sin(a)
        # use the rectangle when the polygon is (nearly) one
        if rect > 0.86 or f["src"] == "lidar":
            corners = np.array([[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]])
            ring = corners @ np.array([[c, s], [-s, c]]) + ctr
        # surface heights inside (eroded), as OBB coordinates
        pxr = to_px(ring)
        lo = np.floor(pxr.min(0)).astype(int) - 2
        hi = np.ceil(pxr.max(0)).astype(int) + 3
        lo = np.clip(lo, 0, [Wd - 1, H - 1]); hi = np.clip(hi, 1, [Wd, H])
        sub = Image.new("L", (hi[0] - lo[0], hi[1] - lo[1]), 0)
        ImageDraw.Draw(sub).polygon([tuple(p - lo) for p in pxr], fill=255)
        sm = np.asarray(sub) > 0
        dm.polygon([tuple(p) for p in pxr], fill=255)
        er = ndi.binary_erosion(sm, iterations=1)
        if er.sum() < 6:
            er = sm
        ys, xs = np.nonzero(er)
        gy, gx = ys + lo[1], xs + lo[0]
        bx, by = X[gy, gx], Y[gy, gx]
        z = dom.a[gy, gx].astype(np.float64)
        rel = np.stack([bx - ctr[0], by - ctr[1]], 1) @ np.array([[c, -s], [s, c]])
        u, v = rel[:, 0], rel[:, 1]
        # the ground around: DTM along the outline, 1.5 m outside
        ground = float(np.percentile(dtm.sample(ring[:, 0], ring[:, 1]), 20))
        roofish = (z > ground + 1.2) & (rough[gy, gx] < 0.25) & (green[gy, gx] < 15)
        ok = roofish if roofish.sum() >= max(6, 0.3 * len(z)) else (z > ground + 1.2)
        if ok.sum() >= 6:
            u, v, z = u[ok], v[ok], z[ok]
            bx, by = bx[ok], by[ok]
        m = fit_roof(u, v, z, L, W)
        roof_px = aerial.sample(bx, by)
        roof_rgb = np.median(roof_px, 0) / 255.0
        h_ridge = float(np.max(roof_z(m, u, v, L, W)))
        height = max(2.4, float(np.percentile(z, 95)) - ground)
        typ = classify(f["type"], poly_area, L, W, height, roof_rgb)
        # the project's own buildings keep their names
        name = None
        for pb in proj_existing:
            pr = np.array(pb["ring_local"])
            if np.hypot(*(pr.mean(0) - ring.mean(0))) < 8:
                name = pb["id"]
        wall_srgb = pick(typ, f["id"])
        wall = lin(wall_srgb)
        wall_kind = {"house": 0.0, "barn": 0.25, "shed": 0.5, "big": 0.75}[typ]
        # draw: walls follow the outline from the ground up to the roof surface at the outline
        local = (ring - ctr) @ np.array([[c, -s], [s, c]])
        lu, lv = local[:, 0], local[:, 1]
        top = roof_z(m, lu, lv, L, W)
        eave_min = ground + 2.2
        top = np.maximum(top, eave_min)
        nv = len(ring)
        # gable ends: insert the ridge point where the ridge crosses an outline edge
        ridge_pts = []
        if m["kind"] == "gable":
            for i in range(nv):
                j = (i + 1) % nv
                a0 = (lv if m["axis"] == "u" else lu)[i] - m["off"]
                a1 = (lv if m["axis"] == "u" else lu)[j] - m["off"]
                if a0 * a1 < 0:
                    t = a0 / (a0 - a1)
                    ridge_pts.append((i, t))
        ridge_at = {i: t for i, t in ridge_pts}
        gz = dtm.sample(ring[:, 0], ring[:, 1]) - 0.3
        perim = 0.0
        for i in range(nv):
            j = (i + 1) % nv
            p0, p1 = ring[i], ring[j]
            seg = float(np.hypot(*(p1 - p0)))
            if seg < 0.05:
                continue
            nx, ny = (p1[1] - p0[1]) / seg, -(p1[0] - p0[0]) / seg
            # outward normal: the ring may wind either way
            mid = (p0 + p1) / 2
            if np.dot(mid - ring.mean(0), [nx, ny]) < 0:
                nx, ny = -nx, -ny
            nrm3 = (nx, 0.0, -ny)
            pts = [(p0, gz[i], top[i], 0.0)]
            if i in ridge_at:
                t = ridge_at[i]
                pm_ = p0 + (p1 - p0) * t
                lr = (pm_ - ctr) @ np.array([[c, -s], [s, c]])
                pts.append((pm_, gz[i] + (gz[j] - gz[i]) * t, float(roof_z(m, np.array([lr[0]]), np.array([lr[1]]), L, W)[0]), seg * t))
            pts.append((p1, gz[j], top[j], seg))
            # the wall as quads between consecutive columns (two, or three with a gable point)
            for k2 in range(len(pts) - 1):
                qa, qb = pts[k2], pts[k2 + 1]
                quad = [(qa[0][0], qa[1], -qa[0][1]), (qb[0][0], qb[1], -qb[0][1]), (qb[0][0], qb[2], -qb[0][1]), (qa[0][0], qa[2], -qa[0][1])]
                quv = [(perim + qa[3], qa[1] - ground), (perim + qb[3], qb[1] - ground), (perim + qb[3], qb[2] - ground), (perim + qa[3], qa[2] - ground)]
                # winding: counter-clockwise seen from outside
                e1 = np.subtract(quad[1], quad[0]); e2 = np.subtract(quad[3], quad[0])
                if np.dot(np.cross(e1, e2), nrm3) < 0:
                    quad = quad[::-1]; quv = quv[::-1]
                add_poly(quad, nrm3, wall, quv, wall_kind)
            perim += seg

        # roof surface with an overhang, triangulated per model
        ov = 0.45
        def P(uu, vv):
            w = np.array([uu, vv]) @ np.array([[c, s], [-s, c]]) + ctr
            zz = float(roof_z(m, np.array([uu]), np.array([vv]), L, W)[0])
            return (float(w[0]), zz, float(-w[1]))
        roofc = lin(np.clip(roof_rgb * 0.96, 0, 1))
        Lh, Wh = L / 2 + ov * 0.7, W / 2 + ov
        if rect <= 0.86 and f["src"] == "osm":
            # complex outline: the roof planes clipped to the outline itself, split along the ridge
            if m["kind"] == "hip":
                m = gable_from(u, v, z, L, W) or m
            parts = [local]
            if m["kind"] == "gable":
                axis_idx = 1 if m["axis"] == "u" else 0
                parts = [clip_half(local, axis_idx, m["off"], +1), clip_half(local, axis_idx, m["off"], -1)]
            for part in parts:
                if len(part) < 3:
                    continue
                pts3 = [P(float(pu), float(pv)) for pu, pv in part]
                tri = ear_clip(part)
                base = len(pos)
                a3, b3, c3 = (np.array(pts3[t]) for t in tri[0]) if tri else (None, None, None)
                if a3 is None:
                    continue
                nrm_ = np.cross(b3 - a3, c3 - a3)
                flip = nrm_[1] < 0
                nrm_ = (-nrm_ if flip else nrm_)
                nrm_ = nrm_ / (np.linalg.norm(nrm_) or 1)
                for pp in pts3:
                    pos.append(pp); nrm.append(tuple(float(q) for q in nrm_)); col.append(roofc); wuv.append((0.0, 0.0)); kind_attr.append(1.0)
                for t3 in tri:
                    if flip:
                        idx.extend([base + t3[0], base + t3[2], base + t3[1]])
                    else:
                        idx.extend([base + t3[0], base + t3[1], base + t3[2]])
        elif m["kind"] == "gable":
            o = m["off"]
            if m["axis"] == "u":
                faces = [[(-Lh, o), (Lh, o), (Lh, Wh), (-Lh, Wh)], [(-Lh, -Wh), (Lh, -Wh), (Lh, o), (-Lh, o)]]
            else:
                faces = [[(o, -Wh), (o, Wh), (Lh, Wh), (Lh, -Wh)], [(-Lh, -Wh), (-Lh, Wh), (o, Wh), (o, -Wh)]]
            for fc in faces:
                add_roof(fc, P, roofc, add_poly)
        elif m["kind"] == "hip":
            r0 = max(0.0, (L - W) / 2)
            faces = [[(-Lh, Wh), (Lh, Wh), (r0, 0), (-r0, 0)], [(Lh, -Wh), (-Lh, -Wh), (-r0, 0), (r0, 0)],
                     [(Lh, Wh), (Lh, -Wh), (r0, 0)], [(-Lh, -Wh), (-Lh, Wh), (-r0, 0)]]
            for fc in faces:
                add_roof(fc, P, roofc, add_poly)
        else:
            add_roof([(-Lh, -Wh), (Lh, -Wh), (Lh, Wh), (-Lh, Wh)], P, roofc, add_poly)

        records.append({"id": f["id"], "src": f["src"], "type": typ, "osm_type": f["type"], "project": name,
                        "x": round(float(ctr[0]), 2), "y": round(float(ctr[1]), 2), "L": round(L, 2), "W": round(W, 2),
                        "angle_deg": round(math.degrees(a), 1), "ground": round(ground, 2), "roof": m["kind"],
                        "ridge": round(h_ridge, 2), "rms": round(m.get("rms", 0), 3),
                        "pitch_deg": round(math.degrees(math.atan(m.get("slope", 0.0))), 1) if m["kind"] in ("gable", "hip") else 0.0,
                        "roof_rgb": [round(float(v), 3) for v in roof_rgb], "wall_rgb": list(wall_srgb)})

    P3 = np.array(pos, np.float32)          # already three.js axes: (x, up, -north)
    meshes = [{"name": "buildings", "position": P3, "normal": np.array(nrm, np.float32), "color": np.array(col, np.float32),
               "uv": np.array(wuv, np.float32), "attributes": {"_KIND": np.array(kind_attr, np.float32).reshape(-1, 1)},
               "index": np.array(idx, np.uint32), "material": {"name": "buildings", "roughness": 0.85, "vertexColors": True},
               "extras": {"kind": "_KIND: 0 house wall, 0.25 barn wall, 0.5 shed wall, 0.75 large building wall, 1 roof; TEXCOORD_0 on walls = metres along the wall and above the ground"}}]
    size = tc.write_glb(tc.OUT / "buildings.glb", meshes, extras={"source": "Kartverket NHM DOM/DTM 1 m; footprints OpenStreetMap (site tile) and the laser data; roof colour from the aerial photo; wall colours by building type (not measured)"})
    np.save(tc.CACHE / "building_mask.npy", np.asarray(mask_all) > 0)
    (tc.CACHE / "buildings.json").write_text(json.dumps(records, indent=1), encoding="utf-8")
    from collections import Counter
    print(f"buildings: {len(records)}, roofs {Counter(r['roof'] for r in records)}, types {Counter(r['type'] for r in records)}")
    print(f"  mesh: {len(pos)} vertices, {len(idx) // 3} triangles, {size // 1024} KB")
    for r in records:
        if r["project"]:
            print("  project building:", r)


def add_roof(face_uv, P, color, add_poly):
    pts = [P(u, v) for u, v in face_uv]
    a, b, c = (np.array(pts[0]), np.array(pts[1]), np.array(pts[2]))
    nrm = np.cross(b - a, c - a)
    if nrm[1] < 0:
        pts = pts[::-1]
        nrm = -nrm
    nrm = nrm / (np.linalg.norm(nrm) or 1)
    add_poly(pts, tuple(float(v) for v in nrm), color, [(0.0, 0.0)] * len(pts), 1.0)


def clip_half(poly, axis, off, sign):
    """Sutherland-Hodgman: the part of a polygon where sign * (coord[axis] - off) >= 0."""
    out = []
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        da, db = sign * (a[axis] - off), sign * (b[axis] - off)
        if da >= 0:
            out.append(tuple(a))
        if (da >= 0) != (db >= 0):
            t = da / (da - db)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return np.array(out) if out else np.zeros((0, 2))


def gable_from(u, v, z, L, W):
    """Best gable fit (for complex outlines, where a hipped roof cannot be clipped cleanly)."""
    m = fit_roof(u, v, z, L, W)
    if m["kind"] == "gable":
        return m
    n = len(z)
    best = None
    for axis in ("u", "v"):
        for off in np.linspace(-0.2, 0.2, 9) * (W if axis == "u" else L):
            d = np.abs((v if axis == "u" else u) - off)
            A = np.stack([np.ones(n), -d], 1)
            coef, *_ = np.linalg.lstsq(A, z, rcond=None)
            rss = float(((A @ coef - z) ** 2).sum())
            if coef[1] > 0 and (best is None or rss < best[0]):
                best = (rss, {"kind": "gable", "axis": axis, "off": float(off), "ridge": float(coef[0]), "slope": float(coef[1]), "rms": math.sqrt(rss / n)})
    return best[1] if best else None


def ear_clip(poly2):
    """Triangulate a simple polygon (indices), counter-clockwise or not."""
    pts = [tuple(p) for p in poly2]
    n = len(pts)
    idxs = list(range(n))
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    if area < 0:
        idxs.reverse()
    tris = []
    guard = 0
    while len(idxs) > 3 and guard < 10000:
        guard += 1
        m = len(idxs)
        for k in range(m):
            i0, i1, i2 = idxs[(k - 1) % m], idxs[k], idxs[(k + 1) % m]
            a, b, c = pts[i0], pts[i1], pts[i2]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if cross <= 1e-9:
                continue
            ok = True
            for j in idxs:
                if j in (i0, i1, i2):
                    continue
                p = pts[j]
                d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
                d2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0])
                d3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0])
                if d1 >= 0 and d2 >= 0 and d3 >= 0:
                    ok = False
                    break
            if ok:
                tris.append((i0, i1, i2))
                idxs.pop(k)
                break
        else:
            break
    if len(idxs) == 3:
        tris.append(tuple(idxs))
    return tris


if __name__ == "__main__":
    main()
