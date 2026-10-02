"""The roads of the twin from Statens vegvesen's road database (NVDB, twin_nvdb.py): where every road,
footpath, pavement and crossing runs, how wide it is and what it is made of, painted into the ground;
and the bridges, guardrails and street lights standing on them, as 3D objects.

Roads in the ground. For each of the three inner rings a texture on the ring's own grid holds, per
texel, the signed distance to the nearest road centreline and that road's half width (so the terrain
shader draws sharp road edges at any distance, however coarse the texel), the road's surface and its
markings:
  R  128 + 8 * signed distance (m, left of the road positive), clamped to +-15.9 m
  G  16 * half width (m)
  B  flags: bits 0-1 surface (1 asphalt, 2 gravel, 3 paving), bit 2 centre line, bit 3 edge lines,
     bit 4 pedestrian crossing, bit 5 road on a bridge (the deck is drawn instead)
  A  127.5 + 127.5 * sin(2 pi * metres along the road): the stripes of a crossing
Widths are NVDB's measured paved width (Vegbredde) where it has one; elsewhere the usual width for the
road's type and number of lanes (stated in roads.json). Surfaces are NVDB's (Vegdekke: asphalt or
gravel) where it has one; a public road (E, F, K) without a record is paved; a private road, forest
road or footpath without one is not painted at all, so the aerial photo shows what it is (the photo
cannot tell asphalt from gravel reliably: on the roads NVDB knows, a brightness test was no better
than chance). Markings are drawn only where NVDB records them (Vegoppmerking): it records few here,
so most roads have none, and the model says so. The colours are the aerial photo's own, measured
along the roads NVDB records (sunlit asphalt is light grey from the air, gravel darker).

3D objects (roads.glb): bridge decks with their railings (from NVDB's deck outline or centreline and
width, at the deck's own height; culverts and bridges in fill stay part of the road), guardrails of
NVDB's type (steel rail on wooden or steel posts, concrete, guard stones) at their measured line or,
where NVDB has none, at the road's edge on its recorded side, and street lights on 8 m masts at their
measured points (the mast height is not in NVDB: 8 m is the usual mast for these roads).

Positions: the inner rings' frame within 1.3 km, the true frame beyond (twin_common.py).
Outputs: site/public/twin/ring_r0_r.png, ring_r1_r.png, ring_r2_r.png, roads.glb; source/twin/roads.json
Run after twin_nvdb.py and twin_terrain.py: python pipeline/twin_roads.py
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict

import numpy as np
from PIL import Image

import twin_common as tc
from twin_buildings import ear_clip

D = tc.CACHE / "nvdb"
RINGS = {"r0": dict(frame="local", px=1024), "r1": dict(frame="local", px=2048), "r2": dict(frame="true", px=1024)}
INNER = 1280.0
DEFAULT_WIDTH = {"E": 8.5, "R": 7.5, "F": 6.0, "K": 4.5, "P": 3.5, "S": 3.5}
TYPE_WIDTH = {"Rundkjøring": 6.5, "Gang- og sykkelveg": 3.0, "Gangveg": 2.0, "Fortau": 2.5, "Sti": 1.2, "Traktorveg": 3.0, "Gangfelt": 3.0}
SKIP_TYPES = {"Trapp", "Bilferje", "Passasjerferje"}
GRAVEL = {"Grus", "Grusdekke"}


# ------------------------------------------------------------------ reading NVDB
def wkt_coords(wkt):
    """(lat, lon, z or nan) rows of a WKT LINESTRING/POINT/POLYGON in NVDB's lat-lon order."""
    body = re.sub(r"^[A-Z ]+\(+", "", wkt.strip()).rstrip(")")
    rows = []
    for part in body.replace("(", "").replace(")", "").split(","):
        v = [float(q) for q in part.split()]
        rows.append((v[0], v[1], v[2] if len(v) > 2 else float("nan")))
    return np.array(rows, np.float64)


def props(o):
    return {p.get("navn"): p.get("verdi") for p in o.get("egenskaper", []) if "verdi" in p}


def index_objects(objs):
    idx = defaultdict(list)
    for o in objs:
        for s in (o.get("lokasjon") or {}).get("stedfestinger", []):
            if "veglenkesekvensid" in s:
                idx[s["veglenkesekvensid"]].append((s.get("startposisjon", 0.0), s.get("sluttposisjon", 1.0), s, o))
    return idx


def covering(idx, seg):
    """The object covering most of the segment, with its stedfesting."""
    a, b = seg["startposisjon"], seg["sluttposisjon"]
    best, ov_best = None, 0.0
    for s0, s1, st, o in idx.get(seg["veglenkesekvensid"], []):
        ov = min(b, s1) - max(a, s0)
        if ov > ov_best + 1e-9:
            best, ov_best = (st, o), ov
    return best if best and ov_best > 0.3 * max(b - a, 1e-9) else None


def to_frame(lat, lon, frame):
    return tc.latlon_to_local(lat, lon) if frame == "local" else tc.geo_to_true(lat, lon)


def scene_xy(lat, lon):
    """Scene position for 3D objects: the inner frame within 1.3 km, the true frame beyond."""
    lat, lon = np.atleast_1d(np.asarray(lat, np.float64)), np.atleast_1d(np.asarray(lon, np.float64))
    x, y = tc.latlon_to_local(lat, lon)
    x, y = np.array(x, np.float64), np.array(y, np.float64)
    out = (np.abs(x) > INNER) | (np.abs(y) > INNER)
    if out.any():
        x[out], y[out] = tc.geo_to_true(lat[out], lon[out])
    return x, y, out


# ------------------------------------------------------------------ terrain heights for objects
class Ground:
    """The ground height (NN2000) at scene points: 1 m model within 1.3 km, 5 m and 20 m beyond."""

    def __init__(self):
        self.d1, self.d5, self.d20 = tc.UtmRaster.load("dtm1"), tc.UtmRaster.load("dtm5"), tc.UtmRaster.load("dtm20")

    def at(self, lat, lon):
        e, n = tc.to_utm32(np.asarray(lat, np.float64), np.asarray(lon, np.float64))
        x, y = tc.latlon_to_local(lat, lon)
        x, y = np.asarray(x), np.asarray(y)
        h1, h5, h20 = self.d1.sample_utm(e, n), self.d5.sample_utm(e, n), self.d20.sample_utm(e, n)
        r = np.maximum(np.abs(x), np.abs(y))
        h = np.where(r < 1250, h1, np.where(r < 5150, h5, h20))
        return np.where(np.isfinite(h), np.maximum(h, 0.0), 0.0)


# ------------------------------------------------------------------ the road list
def roads():
    segs = json.loads((D / "vegnett.json").read_text(encoding="utf-8"))
    widths, surfaces = index_objects(json.loads((D / "583.json").read_text(encoding="utf-8"))), index_objects(json.loads((D / "241.json").read_text(encoding="utf-8")))
    marks = index_objects(json.loads((D / "836.json").read_text(encoding="utf-8")))
    bridges = [o for o in json.loads((D / "60.json").read_text(encoding="utf-8")) if real_bridge(o)]
    bridge_idx = index_objects(bridges)
    out, stats = [], Counter()
    for s in segs:
        tv = s.get("typeVeg")
        if tv in SKIP_TYPES or s.get("type") in ("KONNEKTERING", "DETALJERT_KONNEKTERING") or s.get("detaljnivå") in ("Vegtrase", "Kjørefelt"):
            stats["skipped " + str(tv if tv in SKIP_TYPES else s.get("type") if "KONNEKTERING" in str(s.get("type")) else s.get("detaljnivå"))] += 1
            continue
        g = wkt_coords(s["geometri"]["wkt"])
        vs = (s.get("vegsystemreferanse") or {}).get("vegsystem") or {}
        cat = vs.get("vegkategori")
        lanes = [f for f in s.get("feltoversikt", []) if f.isdigit()]
        w = covering(widths, s)
        if w:
            p = props(w[1])
            width, wsrc = float(p.get("Dekkebredde") or p.get("Vegbredde, totalt") or 0.0), "NVDB Vegbredde"
            if width <= 0.5:
                w = None
        if not w:
            if tv in TYPE_WIDTH:
                width = TYPE_WIDTH[tv]
            elif tv == "Kanalisert veg" or s.get("detaljnivå") == "Kjørebane":
                width = max(1, len(lanes)) * 3.25 + 1.0
            else:
                width = DEFAULT_WIDTH.get(cat, 3.5)
            wsrc = "usual width for the type"
        sf = covering(surfaces, s)
        mass = props(sf[1]).get("Massetype") if sf else None
        surface = None if mass is None else (2 if mass in GRAVEL else 1)
        if tv in ("Fortau",):
            surface = 3
        mk = covering(marks, s)
        mtype = props(mk[1]).get("Type", "") if mk else ""
        br = covering(bridge_idx, s)
        out.append({"id": s["referanse"], "type": tv, "cat": cat, "num": vs.get("nummer"), "name": (s.get("adresse") or {}).get("navn"),
                    "lat": g[:, 0], "lon": g[:, 1], "z": g[:, 2], "width": round(width, 2), "width_source": wsrc,
                    "surface": surface, "surface_source": "NVDB Vegdekke" if mass else None, "mass": mass,
                    "centre": "midt" in mtype.lower(), "edges": "kant" in mtype.lower(), "crossing": tv == "Gangfelt",
                    "bridge": props(br[1]).get("Navn") if br else None})
        stats[tv] += 1
    return out, stats, bridges


def real_bridge(o):
    p = props(o)
    kind = str(p.get("Byggverkstype") or "")
    return p.get("Brukategori") in ("Vegbru", "G/S-bru") and not re.search(r"kulvert|rør|hvelv", kind, re.I)


def classify_surfaces(rs):
    """The surface where NVDB has none. Public roads (E, F, K) and their footpaths are paved; a path is
    gravel. Private and forest roads without a record are not guessed: they get no paint, and the
    aerial photo shows what they are. (Telling asphalt from gravel in the photo along the roads NVDB
    does know came out no better than chance, so the photo is not used to decide.)"""
    for r in rs:
        if r["surface"] is None:
            if r["cat"] in ("E", "R", "F", "K"):
                r["surface"], r["surface_source"] = 1, "public road or its footpath (paved)"
            elif r["type"] in ("Sti",):
                r["surface"], r["surface_source"] = 2, "path"
            else:
                r["surface"], r["surface_source"] = 0, "not recorded: the aerial photo shows it"
    return None


# ------------------------------------------------------------------ the road textures
def rasterise(rs, ring, desc):
    frame, px = RINGS[ring]["frame"], RINGS[ring]["px"]
    th = desc["tex_half"]
    texel = 2 * th / px
    best = np.full((px, px), np.inf, np.float32)
    sd_o = np.zeros((px, px), np.float32)
    hw_o = np.zeros((px, px), np.float32)
    fl_o = np.zeros((px, px), np.uint8)
    ph_o = np.full((px, px), 127.5, np.float32)
    for r in rs:
        x, y = to_frame(r["lat"], r["lon"], frame)
        x, y = np.asarray(x, np.float64), np.asarray(y, np.float64)
        hw = r["width"] / 2
        if np.min(np.maximum(np.abs(x), np.abs(y))) > th + 20:
            continue
        flags = (r["surface"] or 0) | (4 if r["centre"] else 0) | (8 if r["edges"] else 0) | (16 if r["crossing"] else 0) | (32 if r["bridge"] else 0)
        reach = hw + max(3.0, 2 * texel)
        along = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(x), np.diff(y)))])
        for k in range(len(x) - 1):
            x0, y0, x1, y1 = x[k], y[k], x[k + 1], y[k + 1]
            dx, dy = x1 - x0, y1 - y0
            L2 = dx * dx + dy * dy
            if L2 < 1e-6:
                continue
            c0 = int(max(0, math.floor((min(x0, x1) - reach + th) / texel)))
            c1 = int(min(px - 1, math.ceil((max(x0, x1) + reach + th) / texel)))
            r0_ = int(max(0, math.floor((th - max(y0, y1) - reach) / texel)))
            r1_ = int(min(px - 1, math.ceil((th - min(y0, y1) + reach) / texel)))
            if c1 < c0 or r1_ < r0_:
                continue
            cx = (np.arange(c0, c1 + 1) + 0.5) * texel - th
            cy = th - (np.arange(r0_, r1_ + 1) + 0.5) * texel
            gx, gy = np.meshgrid(cx, cy)
            t = np.clip(((gx - x0) * dx + (gy - y0) * dy) / L2, 0.0, 1.0)
            qx, qy = x0 + t * dx, y0 + t * dy
            dist = np.hypot(gx - qx, gy - qy)
            side = np.sign(dx * (gy - y0) - dy * (gx - x0))
            sub = best[r0_:r1_ + 1, c0:c1 + 1]
            win = (dist < sub) & (dist <= reach)
            if not win.any():
                continue
            sub[win] = dist[win]
            sd_o[r0_:r1_ + 1, c0:c1 + 1][win] = (side * dist)[win]
            hw_o[r0_:r1_ + 1, c0:c1 + 1][win] = hw
            fl_o[r0_:r1_ + 1, c0:c1 + 1][win] = flags
            if r["crossing"]:
                s_along = along[k] + t * math.sqrt(L2)
                ph_o[r0_:r1_ + 1, c0:c1 + 1][win] = (127.5 + 127.5 * np.sin(2 * np.pi * s_along / 1.0))[win]
    road = np.isfinite(best)
    rgba = np.zeros((px, px, 4), np.uint8)
    rgba[..., 0] = np.where(road, np.clip(np.rint(128 + sd_o * 8), 0, 255), 255).astype(np.uint8)
    rgba[..., 1] = np.clip(np.rint(hw_o * 16), 0, 255).astype(np.uint8)
    rgba[..., 2] = fl_o
    rgba[..., 3] = np.clip(np.rint(ph_o), 0, 255).astype(np.uint8)
    path = tc.OUT / f"ring_{ring}_r.png"
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)
    cover = float(np.mean(road & (np.abs(sd_o) <= hw_o)))
    print(f"  {ring}: {px}x{px} at {texel:.2f} m, road surface on {cover * 100:.2f} % of the ring, {path.stat().st_size // 1024} KB")
    return path.name


# ------------------------------------------------------------------ 3D objects
class Mesh:
    def __init__(self):
        self.pos, self.nrm, self.col, self.idx = [], [], [], []

    def quad(self, a, b, c, d, color):
        n = np.cross(np.subtract(b, a), np.subtract(d, a))
        ln = np.linalg.norm(n)
        if ln < 1e-12:
            return
        n = tuple(float(v) for v in n / ln)
        base = len(self.pos)
        for p in (a, b, c, d):
            self.pos.append(tuple(float(v) for v in p)); self.nrm.append(n); self.col.append(color)
        self.idx += [base, base + 1, base + 2, base, base + 2, base + 3]

    def tri(self, a, b, c, color):
        n = np.cross(np.subtract(b, a), np.subtract(c, a))
        ln = np.linalg.norm(n)
        if ln < 1e-12:
            return
        n = tuple(float(v) for v in n / ln)
        base = len(self.pos)
        for p in (a, b, c):
            self.pos.append(tuple(float(v) for v in p)); self.nrm.append(n); self.col.append(color)
        self.idx += [base, base + 1, base + 2]

    def box(self, cx, cy, z0, z1, hx, hy, ang, color, top=True):
        """A box standing on z0 (scene x east, y north), turned by ang (radians from east)."""
        c, s = math.cos(ang), math.sin(ang)
        pts = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
        P = [(cx + u * c - v * s, cy + u * s + v * c) for u, v in pts]
        T = lambda p, z: (p[0], z, -p[1])   # noqa: E731  three.js axes
        for i in range(4):
            a, b = P[i], P[(i + 1) % 4]
            self.quad(T(a, z0), T(b, z0), T(b, z1), T(a, z1), color)
        if top:
            self.quad(T(P[0], z1), T(P[1], z1), T(P[2], z1), T(P[3], z1), color)


def lin(c):
    c = np.asarray(c, np.float64)
    return tuple(float(v) for v in np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4))


STEEL, WOOD, CONCRETE, STONE = lin((0.62, 0.64, 0.66)), lin((0.36, 0.28, 0.2)), lin((0.66, 0.65, 0.62)), lin((0.55, 0.54, 0.5))
ASPHALT, DECK_SIDE, POLE, LAMP = lin((0.17, 0.17, 0.18)), lin((0.6, 0.6, 0.58)), lin((0.55, 0.57, 0.6)), lin((0.95, 0.9, 0.75))


def build_objects(rs, bridges, ground):
    deck, rails = Mesh(), Mesh()
    objects = {"rails": [], "wood": [], "steel": [], "stones": [], "lights": []}
    width_of = {}
    for r in rs:
        width_of[r["id"]] = r["width"]

    def drop(x, y, far):
        return np.where(far, tc.curvature_drop(x, y), 0.0)

    # ---- bridges: the deck at its own height, with railings
    nb = 0
    for o in bridges:
        p = props(o)
        g = wkt_coords(o["geometri"]["wkt"])
        wkt = o["geometri"]["wkt"].upper()
        x, y, far = scene_xy(g[:, 0], g[:, 1])
        z = g[:, 2]
        if np.isnan(z).all():
            # no deck heights: level between the ground at the two ends (the abutments)
            gz = ground.at(g[[0, -1], 0], g[[0, -1], 1])
            z = np.linspace(gz[0], gz[1], len(g)) + 0.3
        z = np.where(np.isnan(z), np.nanmean(z), z) - drop(x, y, far)
        if wkt.startswith("POLYGON"):
            ring = np.stack([x, y], 1)[:-1]
            zr = z[:-1]
            tris = ear_clip(ring)
            for a, b, c in tris:
                deck.tri((ring[a][0], zr[a] + 0.05, -ring[a][1]), (ring[b][0], zr[b] + 0.05, -ring[b][1]), (ring[c][0], zr[c] + 0.05, -ring[c][1]), ASPHALT)
            # the deck's sides and its railings along the outline's long sides (edges running with the
            # bridge's main axis; the ends, across it, meet the road and carry none)
            for i in range(len(ring)):
                j = (i + 1) % len(ring)
                a, b = ring[i], ring[j]
                if math.hypot(*(b - a)) < 0.3:
                    continue
                deck.quad((a[0], zr[i] - 0.9, -a[1]), (b[0], zr[j] - 0.9, -b[1]), (b[0], zr[j] + 0.05, -b[1]), (a[0], zr[i] + 0.05, -a[1]), DECK_SIDE)
            cov = np.cov((ring - ring.mean(0)).T)
            axis = np.linalg.eigh(cov)[1][:, -1]
            for i in range(len(ring)):
                j = (i + 1) % len(ring)
                a, b = ring[i], ring[j]
                seg = math.hypot(*(b - a))
                if seg < 0.3 or abs(np.dot((b - a) / seg, axis)) < 0.7:
                    continue
                rails.quad((a[0], zr[i] + 1.0, -a[1]), (b[0], zr[j] + 1.0, -b[1]), (b[0], zr[j] + 1.12, -b[1]), (a[0], zr[i] + 1.12, -a[1]), STEEL)
                for k in range(int(seg // 2.0) + 1):
                    t = min(1.0, k * 2.0 / max(seg, 1e-6))
                    px_, py_ = a + (b - a) * t
                    rails.box(px_, py_, zr[i] + (zr[j] - zr[i]) * t, zr[i] + (zr[j] - zr[i]) * t + 1.0, 0.05, 0.05, 0.0, STEEL, top=False)
        else:
            w = float(p.get("Bredde") or 6.0)
            for k in range(len(x) - 1):
                a, b = np.array([x[k], y[k]]), np.array([x[k + 1], y[k + 1]])
                d = b - a
                L = math.hypot(*d)
                if L < 0.05:
                    continue
                nrm2 = np.array([-d[1], d[0]]) / L * (w / 2)
                pa, pb, pc, pd = a + nrm2, b + nrm2, b - nrm2, a - nrm2
                za, zb = z[k] + 0.05, z[k + 1] + 0.05
                deck.quad((pd[0], za, -pd[1]), (pc[0], zb, -pc[1]), (pb[0], zb, -pb[1]), (pa[0], za, -pa[1]), ASPHALT)
                for q0, q1 in ((pa, pb), (pc, pd)):
                    zq0, zq1 = (za, zb) if q0 is pa else (zb, za)
                    deck.quad((q0[0], zq0 - 0.9, -q0[1]), (q1[0], zq1 - 0.9, -q1[1]), (q1[0], zq1, -q1[1]), (q0[0], zq0, -q0[1]), DECK_SIDE)
                    rails.quad((q0[0], zq0 + 1.0, -q0[1]), (q1[0], zq1 + 1.0, -q1[1]), (q1[0], zq1 + 1.12, -q1[1]), (q0[0], zq0 + 1.12, -q0[1]), STEEL)
        nb += 1

    # ---- guardrails
    rails_n = Counter()
    seg_by_link = defaultdict(list)
    for s in json.loads((D / "vegnett.json").read_text(encoding="utf-8")):
        seg_by_link[s["veglenkesekvensid"]].append(s)
    road_width = {}
    for r in rs:
        road_width[r["id"]] = r["width"]
    for o in json.loads((D / "5.json").read_text(encoding="utf-8")):
        p = props(o)
        typ = str(p.get("Rekkverkstype") or "")
        g = wkt_coords(o["geometri"]["wkt"])
        if len(g) < 2:
            continue
        if not o["geometri"].get("egengeometri"):
            # on the road's centreline: move it out to the road's edge. A guardrail stands where the
            # ground falls away (slope, cliff, water), so the side is the lower one when the terrain
            # says so clearly, and NVDB's recorded side (relative to the link's metering) otherwise.
            st = ((o.get("lokasjon") or {}).get("stedfestinger") or [{}])[0]
            seg = next((s for s in seg_by_link.get(st.get("veglenkesekvensid"), []) if s["startposisjon"] <= st.get("startposisjon", 0) <= s["sluttposisjon"]), None)
            w = road_width.get(seg["referanse"], 5.0) if seg else 5.0
            x, y, far = scene_xy(g[:, 0], g[:, 1])
            dx, dy = np.gradient(x), np.gradient(y)
            ln = np.hypot(dx, dy) + 1e-9
            nx, ny = -dy / ln, dx / ln
            off = w / 2 + 0.45
            # the ground 3 m beyond each edge (the scene frame is metres; back to lat/lon for the model)
            dlat, dlon = ny * (off + 3.0) / tc.M_LAT, nx * (off + 3.0) / tc.M_LON
            zl = ground.at(g[:, 0] + dlat, g[:, 1] + dlon)
            zr = ground.at(g[:, 0] - dlat, g[:, 1] - dlon)
            diff = float(np.median(zl - zr))
            side = st.get("sideposisjon")
            if abs(diff) > 0.8:
                sgn = -1.0 if diff > 0 else 1.0          # towards the lower side
            elif side in ("H", "V"):
                sgn = -1.0 if side == "H" else 1.0
                if st.get("retning") == "MOT":
                    sgn = -sgn
            else:
                continue
            x, y = x + sgn * nx * off, y + sgn * ny * off
            lat, lon = g[:, 0] + sgn * dlat * off / (off + 3.0), g[:, 1] + sgn * dlon * off / (off + 3.0)
        else:
            x, y, far = scene_xy(g[:, 0], g[:, 1])
            lat, lon = g[:, 0], g[:, 1]
        z = ground.at(lat, lon) - drop(x, y, far)
        along = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(x), np.diff(y)))])
        total = along[-1]
        if total < 1.0:
            continue
        concrete = "betong" in typ.lower()
        stones = "stabbestein" in typ.lower()
        wood = "trestolper" in typ.lower()
        if stones:
            for s_ in np.arange(1.0, total, 2.4):
                xi, yi, zi = np.interp(s_, along, x), np.interp(s_, along, y), np.interp(s_, along, z)
                k = min(len(x) - 2, int(np.searchsorted(along, s_) - 1))
                ang = math.atan2(y[k + 1] - y[k], x[k + 1] - x[k])
                objects["stones"].append([round(float(xi), 2), round(float(yi), 2), round(float(zi), 2), round(ang, 3)])
            rails_n["guard stones"] += 1
            continue
        keep = simplify(np.stack([x, y, z], 1), 0.12)
        objects["rails"].append({"k": "concrete" if concrete else "steel", "p": [[round(float(a), 2) for a in q] for q in keep]})
        if not concrete:
            spacing = float(p.get("Stolpeavstand") or (2.0 if wood else 4.0))
            for s_ in np.arange(0.2, total, max(1.0, spacing)):
                xi, yi, zi = np.interp(s_, along, x), np.interp(s_, along, y), np.interp(s_, along, z)
                objects["wood" if wood else "steel"].append([round(float(xi), 2), round(float(yi), 2), round(float(zi), 2)])
        rails_n["wood posts" if wood else "concrete" if concrete else "steel posts"] += 1

    # ---- street lights: 8 m masts with an arm and a lamp over the nearest road, at their measured points
    from scipy.spatial import cKDTree
    rp = []
    for r in rs:
        if r["type"] in ("Enkel bilveg", "Kanalisert veg", "Rundkjøring", "Gang- og sykkelveg", "Gangveg"):
            xx, yy, _ = scene_xy(r["lat"], r["lon"])
            rp.append(np.stack([xx, yy], 1))
    tree = cKDTree(np.concatenate(rp)) if rp else None
    nl = 0
    for o in json.loads((D / "87.json").read_text(encoding="utf-8")):
        g = wkt_coords(o["geometri"]["wkt"])
        if not len(g):
            continue
        x, y, far = scene_xy(g[:1, 0], g[:1, 1])
        z0 = float(ground.at(g[:1, 0], g[:1, 1])[0] - drop(x, y, far)[0])
        x0, y0 = float(x[0]), float(y[0])
        ang = 0.0
        if tree is not None:
            d, k = tree.query([x0, y0])
            if d > 0.3:
                q = tree.data[k]
                ang = math.atan2(q[1] - y0, q[0] - x0)
        objects["lights"].append([round(x0, 2), round(y0, 2), round(z0, 2), round(ang, 3)])
        nl += 1
    print(f"  bridges drawn: {nb}; guardrails: {dict(rails_n)}; street lights: {nl}")

    meshes = []
    for name, m, mat in (("roads-deck", deck, {"name": "deck", "roughness": 0.85, "vertexColors": True, "doubleSided": True}),
                         ("roads-rails", rails, {"name": "rails", "roughness": 0.45, "metallic": 0.2, "vertexColors": True, "doubleSided": True})):
        if not m.pos:
            continue
        meshes.append({"name": name, "position": np.array(m.pos, np.float32), "normal": np.array(m.nrm, np.float32), "color": np.array(m.col, np.float32),
                       "index": np.array(m.idx, np.uint32), "material": mat})
    size = tc.write_glb(tc.OUT / "roads.glb", meshes, extras={"source": "Statens vegvesen NVDB, Bru (60): decks and railings; heights from NVDB or Kartverket NHM DTM"})
    print(f"  roads.glb (bridges): {sum(len(m['position']) for m in meshes)} vertices, {size // 1024} KB")
    objects["note"] = ("Guardrails (rail polylines x, y, z at the ground, posts), guard stones (x, y, z, heading) and street "
                       "lights (x, y, z at the foot, heading of the arm) from Statens vegvesen NVDB (Rekkverk 5, Belysningspunkt 87); "
                       "ground heights Kartverket NHM DTM; scene metres (inner frame within 1.3 km, true frame beyond, bent by the "
                       "curvature). Mast height 8 m and the rail and post sizes are the usual ones, not in NVDB.")
    path = tc.OUT / "road_objects.json"
    path.write_text(json.dumps(objects, separators=(",", ":")), encoding="utf-8")
    print(f"  road_objects.json: {len(objects['rails'])} rails, {len(objects['wood']) + len(objects['steel'])} posts, {len(objects['stones'])} stones, {len(objects['lights'])} lights, {path.stat().st_size // 1024} KB")


def simplify(p, tol):
    """Douglas-Peucker on a 3D polyline (plan and height), keeping the ends."""
    if len(p) < 3:
        return p
    a, b = p[0], p[-1]
    ab = b - a
    L = np.linalg.norm(ab)
    if L < 1e-9:
        d = np.linalg.norm(p - a, axis=1)
    else:
        d = np.linalg.norm(np.cross(p - a, ab), axis=1) / L
    k = int(np.argmax(d))
    if d[k] <= tol:
        return np.stack([a, b])
    return np.concatenate([simplify(p[:k + 1], tol)[:-1], simplify(p[k:], tol)])


def main():
    rs, stats, bridges = roads()
    print(f"roads: {len(rs)} segments drawn; {dict(stats)}")
    thr = classify_surfaces(rs)
    print("  widths:", Counter(r["width_source"] for r in rs).most_common(), " surfaces:", Counter((r["surface"], r["surface_source"]) for r in rs).most_common())
    man = json.loads((tc.OUT / "twin.json").read_text(encoding="utf-8"))
    files = {}
    for desc in man["rings"]:
        if desc["name"] in RINGS:
            files[desc["name"]] = rasterise(rs, desc["name"], desc)
            desc["files"]["roads"] = files[desc["name"]]
    man["roads"] = {"encoding": "R 128 + 8 * signed distance to the centreline (m); G 16 * half width (m); B flags: bits 0-1 surface (1 asphalt, 2 gravel, 3 paving), 2 centre line, 3 edge lines, 4 crossing, 5 on a bridge; A 127.5 + 127.5 * sin(2 pi * metres along) for crossings",
                    "source": "Statens vegvesen, Nasjonal vegdatabank (NVDB), NLOD 2.0", "model": "roads.glb"}
    man.setdefault("sources", {})["roads"] = "Statens vegvesen NVDB: road links, Vegbredde, Vegdekke, Vegoppmerking, Bru, Rekkverk, Belysningspunkt"
    (tc.OUT / "twin.json").write_text(json.dumps(man, indent=1), encoding="utf-8")
    build_objects(rs, bridges, Ground())
    summary = Counter()
    names = defaultdict(float)
    for r in rs:
        L = float(np.sum(np.hypot(np.diff(r["lat"]) * tc.M_LAT_TRUE, np.diff(r["lon"]) * tc.M_LON_TRUE)))
        summary[(r["type"], r["cat"])] += L
        if r["cat"] in ("E", "R", "F", "K") and r["num"]:
            names[(r["cat"], r["num"], r["name"])] += L
    (tc.CACHE / "roads.json").write_text(json.dumps({
        "source": "Statens vegvesen NVDB (NLOD 2.0)", "surface_threshold": thr,
        "length_by_type_km": {f"{k[0]} {k[1]}": round(v / 1000, 2) for k, v in summary.most_common()},
        "named_roads_km": [{"cat": k[0], "num": k[1], "name": k[2], "km": round(v / 1000, 2)} for k, v in sorted(names.items(), key=lambda kv: -kv[1])],
        "defaults": {"width_by_category_m": DEFAULT_WIDTH, "width_by_type_m": TYPE_WIDTH, "light_mast_m": 8.0}}, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
