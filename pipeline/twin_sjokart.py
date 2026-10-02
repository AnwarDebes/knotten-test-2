"""The sea bed from Kartverket's nautical chart (Sjøkart - Dybdedata, CC BY 4.0; twin_geonorge.py):
the water's depth for the terrain shader, so shallows, sandbanks and rocks just under the surface show
the bottom through the water the way they do in the aerial photo, and deep water stays dark.

The chart divides the sea into depth areas (0-2 m, 2-5 m, 5-10 m, 10-20 m, ...). Inside each area the
depth runs from its shallow edge to its deep edge in proportion to the distances to the two
(depth = lo + (hi - lo) * d_lo / (d_lo + d_hi)); the deepest area of a basin rises to its deepest
sounding at the middle. The chart's shoals (grunne, with their depth) and rocks (skjær, awash) lift the
bottom round them at a slope of 1 in 4. Areas that dry at low water (tørrfall) are 0 m. Water the chart
does not cover (lakes and the rivers above the sea) has no depth: the shader keeps its dark default
there, which is also how deep water looks.

Where a river meets the sea (the chart's river mouth lines) the river's brown water lies on the sea and
spreads over the estuary, so there, within 500 m of the mouth and gone by 1 km, the photo's own colour
is the water's wherever the photo is brighter than deep water is in it.

Outputs in site/public/twin/:
  ring_rN_d.webp  R depth: code = 255 * sqrt(depth / 250 m); 255 also where there is no depth (lakes,
                  rivers). G the share of the photo's colour at the river mouths. Land carries its
                  nearest water's values so the filtered edge is clean. Rings without charted water
                  have none.
  twin.json       rings[].files.depth, sources.depth
Cache: source/twin/sjokart.json (the features out to the 20 km ring, UTM 32)
Run after twin_geonorge.py and twin_terrain.py: python pipeline/twin_sjokart.py
"""
from __future__ import annotations

import json
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

import twin_common as tc

Image.MAX_IMAGE_PIXELS = None

SRC = tc.CACHE / "geonorge" / "sjokart"
CACHE = tc.CACHE / "sjokart.json"
GML = "{http://www.opengis.net/gml/3.2}"
APP = "{http://skjema.geonorge.no/SOSI/produktspesifikasjon/Dybdedata/20201001}"
REACH = 20600.0                       # the 20 km ring and a little more
AREAS = ("Dybdeareal", "Tørrfall")
LINES = ("Dybdekurve", "Kystkontur", "Tørrfallsgrense", "HavElvSperre", "KaiBrygge", "Utstikker", "Molo", "PirKant", "Slipp", "BygningsmessigAnleggVann")
POINTS = ("Dybdepunkt", "Grunne", "Skjær")
DEPTH_MAX = 250.0
SHOAL_SLOPE = 0.25
# the depth textures: the rings that carry water the chart covers (r4 is open sea, dark at that range)
RINGS = {"r0": 512, "r1": 1024, "r2": 1024, "r3": 1024}


def _pos(text):
    v = np.array(text.split(), float)
    return v.reshape(-1, 2)


def parse():
    """Every chart feature the twin uses, out to the 20 km ring, cached as UTM 32 coordinates."""
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    e0, n0 = tc.true_to_utm(np.array([-REACH, REACH]), np.array([-REACH, REACH]))
    box = (float(e0.min()) - 500, float(n0.min()) - 500, float(e0.max()) + 500, float(n0.max()) + 500)
    out = {"source": "Kartverket, Sjøkart - Dybdedata (CC BY 4.0), via Geonorge", "files": [], "areas": [], "lines": [], "points": []}
    seen = set()
    for f in sorted(SRC.glob("*.gml")):
        out["files"].append(f.name)
        n_in = 0
        for _, el in ET.iterparse(f, events=("end",)):
            if el.tag != GML + "featureMember":
                continue
            feat = el[0]
            kind = feat.tag.replace(APP, "")
            lid = feat.findtext(f"{APP}identifikasjon/{APP}Identifikasjon/{APP}lokalId")
            if kind in AREAS + LINES + POINTS and lid not in seen:
                rec = None
                if kind in AREAS:
                    polys = []
                    for patch in feat.iter(GML + "PolygonPatch"):
                        ext = patch.find(f"{GML}exterior/{GML}LinearRing/{GML}posList")
                        ints = patch.findall(f"{GML}interior/{GML}LinearRing/{GML}posList")
                        polys.append([_pos(ext.text)] + [_pos(i.text) for i in ints])
                    pts = np.concatenate([p[0] for p in polys])
                    rec = {"kind": kind, "rings": [[r.round(2).tolist() for r in p] for p in polys]}
                    if kind == "Dybdeareal":
                        lo, hi = feat.findtext(APP + "minimumsdybde"), feat.findtext(APP + "maksimumsdybde")
                        rec["lo"] = float(lo) if lo is not None else 0.0
                        rec["hi"] = float(hi) if hi is not None else None
                elif kind in LINES:
                    pl = feat.find(f".//{GML}posList")
                    pts = _pos(pl.text)
                    rec = {"kind": kind, "p": pts.round(2).tolist()}
                    d = feat.findtext(APP + "dybde")
                    if d is not None:
                        rec["depth"] = float(d)
                else:
                    pts = _pos(feat.find(f".//{GML}pos").text)
                    rec = {"kind": kind, "p": pts[0].round(2).tolist()}
                    d = feat.findtext(APP + "dybde")
                    if d is not None:
                        rec["depth"] = float(d)
                    t = feat.findtext(APP + "dybdetype")
                    if t is not None:
                        rec["type"] = int(t)
                if pts[:, 0].max() >= box[0] and pts[:, 0].min() <= box[2] and pts[:, 1].max() >= box[1] and pts[:, 1].min() <= box[3]:
                    seen.add(lid)
                    out["areas" if kind in AREAS else "lines" if kind in LINES else "points"].append(rec)
                    n_in += 1
            el.clear()
        print(f"  {f.name}: {n_in} features within {REACH / 1000:.1f} km")
    CACHE.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return out


def to_ring(desc, e, n):
    x, y = tc.utm_to_local(e, n) if desc["frame"] == "local" else tc.utm_to_true(e, n)
    return np.asarray(x, float), np.asarray(y, float)


def to_texel(desc, px, e, n):
    """UTM to texel coordinates of the ring's textures (u east, v south; texel i spans [i, i + 1))."""
    th = desc["tex_half"]
    x, y = to_ring(desc, e, n)
    return (x + th) * px / (2 * th), (th - y) * px / (2 * th)


def rasterise_areas(data, desc, px):
    """Each texel's depth area (lo, hi), NaN where the chart has none, and how many depth areas claimed it."""
    lo = np.full((px, px), np.nan, np.float32)
    hi = np.full((px, px), np.nan, np.float32)
    hits = np.zeros((px, px), np.uint8)
    # drying areas last: on some sheets they lie inside the shallowest depth area's outline
    for a in sorted(data["areas"], key=lambda a: a["kind"] == "Tørrfall"):
        if a["kind"] == "Dybdeareal":
            a_lo, a_hi = a["lo"], (a["hi"] if a["hi"] is not None else np.inf)
        else:
            a_lo = a_hi = 0.0
        for poly in a["rings"]:
            rings = []
            for r in poly:
                r = np.asarray(r, float)
                u, v = to_texel(desc, px, r[:, 0], r[:, 1])
                rings.append(np.stack([u - 0.5, v - 0.5], 1))      # PIL puts a pixel's centre on the integer
            u0, v0 = np.floor(rings[0].min(0)).astype(int)
            u1, v1 = np.ceil(rings[0].max(0)).astype(int) + 1
            u0, v0, u1, v1 = max(u0, 0), max(v0, 0), min(u1, px), min(v1, px)
            if u1 <= u0 or v1 <= v0:
                continue
            sub = Image.new("L", (u1 - u0, v1 - v0), 0)
            dr = ImageDraw.Draw(sub)
            dr.polygon([tuple(q) for q in rings[0] - (u0, v0)], fill=1)
            for r in rings[1:]:
                dr.polygon([tuple(q) for q in r - (u0, v0)], fill=0)
            m = np.asarray(sub, bool)
            lo[v0:v1, u0:u1][m] = a_lo
            hi[v0:v1, u0:u1][m] = a_hi
            if a["kind"] == "Dybdeareal":
                hits[v0:v1, u0:u1] += ndi.binary_erosion(m)     # shared edges are drawn by both areas
    return lo, hi, hits


def depth_field(lo, hi, texel, sounding_max):
    """The depth inside each depth area: from its shallow edge to its deep edge in proportion to the
    distances to the two; an area with nothing deeper next to it (a basin, or the deepest water in reach)
    deepens towards its middle, to its deepest sounding (the middle of its range where it has none)."""
    chart = np.isfinite(lo)
    depth = np.full(lo.shape, np.nan, np.float32)
    d_shallow, d_deep = {}, {}

    def dist(mask):
        return ndi.distance_transform_edt(~mask) * texel if mask.any() else np.full(mask.shape, np.inf)

    for a, b in sorted({(float(p), float(q)) for p, q in zip(lo[chart], hi[chart])}):
        sel = chart & (lo == a) & (hi == b)
        if b <= a:
            depth[sel] = a                                   # dries at low water
            continue
        if a not in d_shallow:
            d_shallow[a] = dist(~chart | (hi <= a))          # land or shallower water
        if b not in d_deep:
            d_deep[b] = dist(chart & (lo >= b))
        ds, dd = d_shallow[a], d_deep[b]
        lab, n = ndi.label(sel, structure=np.ones((3, 3)))
        idx = np.arange(1, n + 1)
        touches = np.asarray(ndi.maximum((dd <= 1.5 * texel).astype(np.uint8), lab, idx), bool)
        far = np.asarray(ndi.maximum(ds, lab, idx), np.float32)
        snd = np.asarray(ndi.maximum(np.where((sounding_max >= a) & (sounding_max <= b), sounding_max, -1.0), lab, idx), np.float32)
        mid = (a + b) / 2 if np.isfinite(b) else a + 10.0
        bottom = np.where(snd > 0, snd, mid)
        comp = lab[sel] - 1
        t_edges = ds[sel] / np.maximum(ds[sel] + dd[sel], 1e-6)
        t_basin = np.clip(ds[sel] / np.maximum(far[comp], texel), 0.0, 1.0)
        val = np.where(touches[comp], a + (min(b, 1e4) - a) * t_edges, a + (bottom[comp] - a) * (1 - (1 - t_basin) ** 2))
        depth[sel] = val
    return depth


def shoals(depth, pts, slope=SHOAL_SLOPE):
    """The chart's shoals and rocks (u, v, depth in texels and metres) lift the bottom round them."""
    texel = pts.texel
    n = 0
    H, W = depth.shape
    for u, v, z in pts.uvz:
        if not (0 <= u < W and 0 <= v < H):
            continue
        r = int(np.ceil(max(0.0, 30.0 - z) / slope / texel)) + 1
        c0, c1, r0, r1 = max(int(u) - r, 0), min(int(u) + r + 1, W), max(int(v) - r, 0), min(int(v) + r + 1, H)
        cc, rr = np.meshgrid(np.arange(c0, c1) + 0.5, np.arange(r0, r1) + 0.5)
        cone = max(z, 0.0) + slope * np.hypot(cc - u, rr - v) * texel
        win = depth[r0:r1, c0:c1]
        np.minimum(win, cone, out=win, where=np.isfinite(win))
        n += 1
    return n


def smooth(depth, sigma):
    """A light blur inside the charted water only (the depth areas are drawn texel by texel)."""
    w = np.isfinite(depth).astype(np.float32)
    num = ndi.gaussian_filter(np.nan_to_num(depth) * w, sigma)
    den = ndi.gaussian_filter(w, sigma)
    return np.where(w > 0, num / np.maximum(den, 1e-6), np.nan).astype(np.float32)


def _smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def river_water(data, desc, px, water):
    """Where a river meets the sea (the chart's HavElvSperre lines) its brown water lies on top of the
    sea and spreads over the estuary: there the photo's own colour is the water's, however deep it is.
    The share is the photo's brightness (deep clear water is dark in it, the brown water and the sand
    are not), within 500 m of the river mouth and gone by 1 km."""
    texel = 2 * desc["tex_half"] / px
    canvas = Image.new("L", (px, px), 0)
    dr = ImageDraw.Draw(canvas)
    for l in data["lines"]:
        if l["kind"] == "HavElvSperre":
            q = np.asarray(l["p"], float)
            u, v = to_texel(desc, px, q[:, 0], q[:, 1])
            dr.line(list(zip(u - 0.5, v - 0.5)), fill=1, width=1)
    line = np.asarray(canvas, bool)
    if not line.any():
        return np.zeros((px, px), np.float32)
    near = 1.0 - _smoothstep(500.0, 1000.0, ndi.distance_transform_edt(~line) * texel)
    c = np.asarray(Image.open(tc.OUT / desc["files"]["aerial"]).convert("RGB").resize((px, px), Image.BOX), np.float32) / 255
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    luma = c @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    # deep water in this photo is darker than 0.016 (99th percentile, linear) wherever the chart has it deeper than 6 m
    return np.where(water, near * _smoothstep(0.015, 0.05, luma), 0.0).astype(np.float32)


class _Pts:
    def __init__(self, uvz, texel):
        self.uvz, self.texel = uvz, texel


def encode(depth):
    return np.clip(np.rint(255 * np.sqrt(np.clip(depth, 0, DEPTH_MAX) / DEPTH_MAX)), 0, 255).astype(np.uint8)


def main():
    data = parse()
    man = json.loads((tc.OUT / "twin.json").read_text(encoding="utf-8"))
    snd_all = [p for p in data["points"] if p["kind"] == "Dybdepunkt"]
    S = np.array([p["p"] for p in snd_all], float)
    SZ = np.array([p["depth"] for p in snd_all], float)
    shl = [p for p in data["points"] if p["kind"] in ("Grunne", "Skjær")]
    Q = np.array([p["p"] for p in shl], float)
    QZ = np.array([p.get("depth", 0.0) for p in shl], float)
    report = {}
    for desc in man["rings"]:
        name = desc["name"]
        out = tc.OUT / f"ring_{name}_d.webp"
        (tc.OUT / f"ring_{name}_d.png").unlink(missing_ok=True)          # PNG before
        px = RINGS.get(name)
        if px is None:
            desc["files"].pop("depth", None)
            continue
        texel = 2 * desc["tex_half"] / px
        lo, hi, hits = rasterise_areas(data, desc, px)
        chart = np.isfinite(lo)
        mask = Image.open(tc.OUT / desc["files"]["mask"]).convert("RGB").getchannel("R").resize((px, px), Image.BOX)
        water = np.asarray(mask, np.float32) / 255 > 0.5
        sea = water & chart
        if not sea.any():
            desc["files"].pop("depth", None)
            out.unlink(missing_ok=True)
            print(f"  {name}: no charted water")
            continue
        # the soundings on the texel grid: the deepest in each texel
        su, sv = to_texel(desc, px, S[:, 0], S[:, 1])
        ins = (su >= 0) & (su < px) & (sv >= 0) & (sv < px)
        smax = np.full((px, px), -1.0, np.float32)
        np.maximum.at(smax, (sv[ins].astype(int), su[ins].astype(int)), SZ[ins])
        depth = depth_field(lo, hi, texel, smax)
        iu, iv, z = su[ins].astype(int), sv[ins].astype(int), SZ[ins]
        qu, qv = to_texel(desc, px, Q[:, 0], Q[:, 1])
        n_shoal = shoals(depth, _Pts(zip(qu, qv, QZ), texel))
        depth = smooth(depth, 0.75)
        # how well the field meets the chart's own soundings, which it is not fitted to (bending it towards
        # them was tried: on a fifth held out it predicted no better)
        at = depth[iv, iu]
        ok = np.isfinite(at)
        err = np.abs(at[ok] - z[ok])
        shallow = z[ok] <= 10
        code = np.full((px, px), 255, np.uint8)
        code[chart] = encode(depth[chart])
        # water the chart leaves out: next to the charted water (the chart's coastline is generalised and
        # sits a little off the laser's) the nearest charted depth; up a river or in a lake, the dark
        # default (255), reached over 60 to 200 m
        dist, (ri, ci) = ndi.distance_transform_edt(~chart, return_indices=True)
        near = code[ri, ci].astype(np.float32)
        fade = np.clip((dist * texel - 60.0) / 140.0, 0.0, 1.0)
        rest = water & ~chart
        code[rest] = np.rint(near[rest] * (1 - fade[rest]) + 255 * fade[rest]).astype(np.uint8)
        plume = river_water(data, desc, px, water)
        rgb = np.zeros((px, px, 3), np.uint8)
        rgb[..., 0] = code
        rgb[..., 1] = np.rint(255 * plume).astype(np.uint8)
        # land carries its nearest water's values, so the filtered edge has no rim
        _, (ri, ci) = ndi.distance_transform_edt(~water, return_indices=True)
        rgb = np.where(water[..., None], rgb, rgb[ri, ci])
        tc.save_lossless(Image.fromarray(rgb, "RGB"), out)
        desc["files"]["depth"] = out.name
        report[name] = {"texel_m": round(texel, 2), "water_charted_pct": round(float(100.0 * sea.sum() / water.sum()), 1),
                        "overlapping_texels": int((hits > 1).sum()),
                        "under_2m_km2": round(float(((depth < 2) & sea).sum()) * texel * texel / 1e6, 3),
                        "soundings": int(ok.sum()),
                        "sounding_error_median_m": round(float(np.median(err)), 2) if ok.any() else None,
                        "soundings_under_10m": int(shallow.sum()),
                        "sounding_error_under_10m_median_m": round(float(np.median(err[shallow])), 2) if shallow.any() else None,
                        "shoals_and_rocks": n_shoal, "deepest_m": round(float(np.nanmax(depth)), 1),
                        "river_water_km2": round(float((plume > 0.5).sum()) * texel * texel / 1e6, 3)}
        print(f"  {name}: {report[name]} ({out.stat().st_size // 1024} KB)")
    man["depth"] = {"encoding": f"R: depth = {DEPTH_MAX:.0f} * (R / 255)^2 m below the chart datum, 255 also where the chart has no depth (lakes, rivers); "
                                f"G: share of the photo's own colour near the river mouths (the river's brown water on the sea); B unused",
                    "source": "Kartverket, Sjøkart - Dybdedata (CC BY 4.0)", "report": report}
    man.setdefault("sources", {})["depth"] = "Kartverket, Sjøkart - Dybdedata: depth areas, shoals and rocks (CC BY 4.0)"
    (tc.OUT / "twin.json").write_text(json.dumps(man, indent=1, ensure_ascii=False), encoding="utf-8")
    print("manifest updated")


if __name__ == "__main__":
    main()
