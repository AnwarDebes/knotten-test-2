"""Terrain rings for the browser twin: height maps, aerial textures and land/water masks.

Five nested squares round the site, each coarser than the one inside it:
  r0  +-320 m     1.25 m posts  Kartverket DTM 1 m                          aerial 0.32 m/px  scene frame
  r1  +-1280 m    2.5 m posts   Kartverket DTM 1 m                          aerial 1.26 m/px  scene frame
  r2  +-5120 m    20 m posts    Kartverket DTM 5 m, forest canopy (DOM 5 m)   aerial 5 m/px     true frame
  r3  +-20480 m   80 m posts    Kartverket DTM 20 m, canopy (DOM 20 m)        aerial 20 m/px    true frame
  r4  +-104858 m  409.6 m posts Kartverket DTM 200 m                         aerial 103 m/px   true frame

The two inner rings carry the 3D trees (twin_trees.py) and buildings. Beyond them the woods are part of
the ground: the canopy of Kartverket's surface model (DOM minus DTM, at most 35 m) wherever NIBIO's
AR5 says the land can carry trees (forest, bog, open ground), so the ridges a few kilometres off have
their real tree-lined skyline instead of the bare ground under the trees. The canopy rises from
nothing at the edge of the 3D trees over 40 m.

The outer rings are laid out in the true frame (twin_common.py: exact distance and direction from
the origin) and bend down with the earth's curvature, less what standard refraction gives back:
0.1 m at 1.3 km, 1.7 m at 5 km, 27 m at 20 km, 680 m at 100 km. The last ring reaches +-105 km (409.6 m posts, so the 20 km ring's edge falls on its grid), far
enough that the inland mountains 55 to 100 km north stand on the skyline seen from the air (with the
land of the old model ending at 20 km, the sea used to show there); its land runs down to the curved
open sea over the last 4 km, long after the haze has hidden it.

Water is not a separate sheet. Kartverket flattens the sea to exactly 0.0 m and the lakes to (nearly)
their level, so the terrain mesh already is the water surface; the mask texture tells the shader where
to draw water. Nothing is coplanar, so nothing can flicker.

The national surface and terrain models resampled to 20 m and 200 m carry single-cell artefacts along
the edge of their coverage (2597.7 m, higher than any mountain in Norway): cells over 1700 m or more
than 300 m above all their neighbours are replaced by their neighbours' median.

Outputs in site/public/twin/:
  ring_rN_h.png     height map, RGB: R*256+G = (h + ring.offset) / ring.step, B unused
  ring_rN.webp      aerial photo, colour-matched to the ring inside it
  ring_rN_m.webp    masks (lossless): R water, G forest (NIBIO AR5; canopy for r4), B broadleaf share (twin_broadleaf.py)
  twin.json         ring layout, encodings, frames, the earth's radius, sources (other steps' entries and ring
                    textures, such as the roads and the water depth, are kept)
Run: python pipeline/twin_terrain.py   (then twin_broadleaf.py, which fills the masks' blue channel)
"""
from __future__ import annotations

import json

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

import twin_common as tc

Image.MAX_IMAGE_PIXELS = None

H_OFF = 20.0                        # the inner rings' height code offset (the manifest keeps it as the default)
RINGS = [
    dict(name="r0", half=320.0, n=513, step=0.02, offset=20.0, frame="local", src="dtm1", tex="img_r0", tex_half=330.0, ar5="ar5_arealtype", tex_px=2048, mask_px=2048, blur=0.8),
    dict(name="r1", half=1280.0, n=1025, step=0.05, offset=20.0, frame="local", src="dtm1", tex="img_r1", tex_half=1290.0, ar5="ar5_arealtype", tex_px=2048, mask_px=2048, blur=0.6),
    dict(name="r2", half=5120.0, n=513, step=0.1, offset=20.0, frame="true", src="dtm5", canopy="dom5", canopy_ramp=40.0, tex="img_r2t", tex_half=5150.0, ar5="ar5_arealtype_5", tex_px=2048, mask_px=1024, blur=0.6),
    dict(name="r3", half=20480.0, n=513, step=0.25, offset=100.0, frame="true", src="dtm20", canopy="dom20", tex="img_r3t", tex_half=20500.0, ar5="ar5_arealtype_20", tex_px=2048, mask_px=1024, blur=0.6),
    dict(name="r4", half=104857.6, n=513, step=0.1, offset=2000.0, frame="true", src="dtm200", canopy=None, forest_from="dom200", tex="img_r4", tex_half=105400.0, ar5=None, tex_px=2048, mask_px=1024, blur=0.0, shore_m=4000.0),
]
CANOPY_MAX = 35.0

AR5 = {"fulldyrka": (255, 209, 110), "overflatedyrka": (255, 255, 76), "innmarksbeite": (255, 255, 173),
       "skog": (158, 204, 115), "myr": (110, 200, 240), "apen": (217, 217, 217), "ferskvann": (145, 231, 255),
       "hav": (204, 254, 254), "bebygd": (252, 219, 214), "samferdsel": (179, 120, 76)}
AR5_NAMES = list(AR5)
WOODED = [AR5_NAMES.index(k) for k in ("skog", "myr", "apen")] + [-1]   # land that can carry trees (-1: not mapped)


class Ar5:
    def __init__(self, stem):
        meta = json.loads((tc.CACHE / f"{stem}.json").read_text(encoding="utf-8"))
        rgba = np.asarray(Image.open(tc.CACHE / f"{stem}.png").convert("RGBA")).astype(np.int32)
        cols = np.array([AR5[k] for k in AR5_NAMES])
        d = ((rgba[..., None, :3] - cols[None, None]) ** 2).sum(-1)
        lab = d.argmin(-1).astype(np.int16)
        lab[(rgba[..., 3] < 128) | (d.min(-1) > 2500)] = -1        # transparent or not a class colour (borders, labels)
        self.lab, self.meta = lab, meta
        self.h, self.w = lab.shape

    def sample_utm(self, e, n):
        c = np.clip(((np.asarray(e) - self.meta["e_min"]) / self.meta["pix"]).astype(np.int64), 0, self.w - 1)
        r = np.clip(((self.meta["n_max"] - np.asarray(n)) / self.meta["pix"]).astype(np.int64), 0, self.h - 1)
        return self.lab[r, c]

    def sample(self, x, y):
        return self.sample_utm(*tc.local_to_utm(x, y))


_CLEAN: dict[str, tc.UtmRaster] = {}


def clean(stem):
    """A model raster with no-data as NaN and single-cell artefacts replaced by their neighbours' median."""
    if stem in _CLEAN:
        return _CLEAN[stem]
    r = tc.UtmRaster.load(stem)
    a = r.a.astype(np.float32).copy()
    a[(a < -1000) | (a > 3000)] = np.nan
    valid = ~np.isnan(a)
    filled = np.where(valid, a, -1e4)
    ring = np.ones((3, 3), bool)
    ring[1, 1] = False
    nb_max = ndi.maximum_filter(filled, footprint=ring, mode="nearest")
    spike = valid & ((a > 1700) | (a > nb_max + 300))
    if spike.any():
        src = np.where(valid & ~spike, a, np.nan)
        H, W = a.shape
        for r_, c_ in zip(*np.nonzero(spike)):
            win = src[max(0, r_ - 1):min(H, r_ + 2), max(0, c_ - 1):min(W, c_ + 2)]
            a[r_, c_] = np.nanmedian(win) if np.isfinite(win).any() else np.nan
        print(f"    {stem}: {int(spike.sum())} artefact cells replaced")
    r.a = a
    _CLEAN[stem] = r
    return r


def utm_of(ring, gx, gy):
    return tc.local_to_utm(gx, gy) if ring["frame"] == "local" else tc.true_to_utm(gx, gy)


def grid(half, n):
    s = np.linspace(-half, half, n)
    gx, gy = np.meshgrid(s, -s)          # row 0 = north
    return gx, gy


def ground_at(ring, E, N):
    """Ground height and a sea flag at UTM points: no-data counts as sea."""
    g = clean(ring["src"]).sample_utm(E, N).astype(np.float64)
    nod = np.isnan(g)
    g = np.where(nod, 0.0, g)
    return g, nod | (g <= 0.003)


def canopy_raster(ring):
    """The forest canopy on the surface model's own grid (m above the ground), smoothed to the ring's posts."""
    dom = clean(ring["canopy"])
    dtm = clean(ring["src"])
    rr, cc = np.mgrid[0:dom.a.shape[0], 0:dom.a.shape[1]]
    E = dom.e_min + (cc + 0.5) * dom.pix
    N = dom.n_max - (rr + 0.5) * dom.pix
    ground = dtm.sample_utm(E, N) if (dom.a.shape != dtm.a.shape or dom.e_min != dtm.e_min or dom.n_max != dtm.n_max) else dtm.a
    ch = np.nan_to_num(dom.a - ground, nan=0.0)
    ch = np.clip(ch, 0.0, CANOPY_MAX)
    # only where the land can carry trees (AR5 forest, bog, open ground): not fields, roads, yards or water
    ar5 = Ar5(ring["ar5"])
    cls = ar5.sample_utm(E, N)
    ch = np.where(np.isin(cls, WOODED), ch, 0.0)
    ch = np.where(np.nan_to_num(ground, nan=0.0) <= 0.003, 0.0, ch)
    sigma = 0.5 * (2 * ring["half"] / (ring["n"] - 1)) / dom.pix      # half a post
    ch = ndi.gaussian_filter(ch, sigma)
    return tc.UtmRaster(ch, dom.e_min, dom.n_max, dom.pix)


def ring_heights(ring, hole):
    """Heights at the ring's posts: ground (and canopy), sea at 0, the outer rings bent by the curvature."""
    gx, gy = grid(ring["half"], ring["n"])
    E, N = utm_of(ring, gx, gy)
    g, sea = ground_at(ring, E, N)
    h = np.where(sea, 0.0, np.maximum(g, 0.12))       # land never dips under the sea: lifted a hand's breadth
    canopy = np.zeros_like(h)
    if ring.get("canopy"):
        canopy = canopy_raster(ring).sample_utm(E, N)
        canopy = np.where(sea, 0.0, canopy)
        if ring.get("canopy_ramp"):
            # from nothing where the 3D trees end (the edge of the ring inside) to full height 40 m out
            d_out = np.maximum(np.abs(gx), np.abs(gy)) - hole
            t = np.clip(d_out / ring["canopy_ramp"], 0.0, 1.0)
            canopy = canopy * t * t * (3 - 2 * t)
        h = h + canopy
    if ring.get("shore_m"):
        # the last ring's land runs down to the open sea over its last few kilometres
        d_in = ring["half"] - np.maximum(np.abs(gx), np.abs(gy))
        h = h * np.clip(d_in / ring["shore_m"], 0.0, 1.0) ** 1.5
    if ring["frame"] == "true":
        h = h - tc.curvature_drop(gx, gy)
    return h, canopy


def seam_profile(outer_ring, outer_h):
    """Heights the outer ring's mesh has along the inner ring's edge (linear between its posts)."""
    no, ho = outer_ring["n"], outer_ring["half"]
    step = 2 * ho / (no - 1)

    def at(x, y):
        fc = (x + ho) / step
        fr = (ho - y) / step
        c0 = np.clip(np.floor(fc).astype(int), 0, no - 2)
        r0 = np.clip(np.floor(fr).astype(int), 0, no - 2)
        tx, ty = fc - c0, fr - r0
        a = outer_h
        return (a[r0, c0] * (1 - tx) + a[r0, c0 + 1] * tx) * (1 - ty) + (a[r0 + 1, c0] * (1 - tx) + a[r0 + 1, c0 + 1] * tx) * ty
    return at


def match_colours(img, ref, img_half, ref_half):
    """Gain and offset per channel so `img` has `ref`'s colour statistics where they overlap."""
    a = np.asarray(img, dtype=np.float32)
    b = np.asarray(ref, dtype=np.float32)
    s = img.size[0]
    k = ref_half / img_half
    c0, c1 = int(s * (0.5 - k / 2)), int(s * (0.5 + k / 2))
    if c1 - c0 < 8:                    # the ring inside covers only a few texels here: match on what there is
        c0, c1 = s // 2 - 4, s // 2 + 4
    crop = Image.fromarray(a[c0:c1, c0:c1].astype(np.uint8)).resize((256, 256), Image.BILINEAR)
    refs = Image.fromarray(b.astype(np.uint8)).resize((256, 256), Image.BILINEAR)
    ca, cb = np.asarray(crop, np.float32).reshape(-1, 3), np.asarray(refs, np.float32).reshape(-1, 3)
    gain = cb.std(0) / np.maximum(ca.std(0), 1e-3)
    gain = np.clip(gain, 0.8, 1.25)
    off = cb.mean(0) - ca.mean(0) * gain
    out = np.clip(a * gain + off, 0, 255).astype(np.uint8)
    print(f"    colour match: gain {gain.round(3)}, offset {off.round(1)}")
    return Image.fromarray(out)


def fresh_water(h, cls, texel_m, tol):
    """Lakes and rivers: AR5 fresh water where the DTM sits at the local water level (rivers slope, lakes do not)."""
    fresh = cls == AR5_NAMES.index("ferskvann")
    if not fresh.any():
        return np.zeros_like(fresh)
    near = ndi.binary_dilation(fresh, iterations=2)
    hh = np.where(near, h, np.inf)
    win = max(3, int(round(40.0 / texel_m)))
    lm = ndi.minimum_filter(hh, size=win, mode="nearest")
    return near & (h <= lm + tol)


def flat_lakes(stem):
    """Lakes in a coarse model without a land-cover map: Kartverket levels every lake, so a 3 x 3 window
    that is flat to 5 cm above the sea is water."""
    r = clean(stem)
    a = r.a
    valid = ~np.isnan(a)
    filled = np.where(valid, a, 0.0)
    rng = ndi.maximum_filter(filled, 3) - ndi.minimum_filter(filled, 3)
    lake = valid & (filled > 0.5) & (rng < 0.05)
    lake = ndi.binary_opening(lake, iterations=1) | lake & ndi.binary_dilation(ndi.binary_opening(lake, iterations=1), iterations=1)
    return tc.UtmRaster(lake.astype(np.float32), r.e_min, r.n_max, r.pix)


def masks(ring):
    """Water and forest masks on the texture grid (anti-aliased); blue is filled in by twin_broadleaf.py."""
    px = ring["mask_px"]
    th = ring["tex_half"]
    texel = 2 * th / px
    s = (np.arange(px) + 0.5) / px * 2 * th - th
    gx, gy = np.meshgrid(s, -s)
    E, N = utm_of(ring, gx, gy)
    h, sea = ground_at(ring, E, N)
    if ring.get("ar5"):
        ar5 = Ar5(ring["ar5"])
        cls = ar5.sample_utm(E, N)
        lakes = fresh_water(h, cls, texel, 0.25 if texel < 2 else (0.5 if texel < 10 else 1.0))
        forest = cls == AR5_NAMES.index("skog")
    else:
        lakes = flat_lakes(ring["src"]).sample_utm(E, N) > 0.5
        dom, dtm = clean(ring["forest_from"]), clean(ring["src"])
        rr, cc = np.mgrid[0:dom.a.shape[0], 0:dom.a.shape[1]]
        ground = dtm.sample_utm(dom.e_min + (cc + 0.5) * dom.pix, dom.n_max - (rr + 0.5) * dom.pix)
        ch = np.nan_to_num(dom.a - ground, nan=0.0)
        cover = tc.UtmRaster(ndi.uniform_filter((ch > 4.0).astype(np.float32), 3), dom.e_min, dom.n_max, dom.pix)
        forest = cover.sample_utm(E, N) > 0.45
    water = sea | lakes
    out = np.stack([water, forest & ~water, np.zeros_like(water)], -1).astype(np.uint8) * 255
    out[..., 2] = 89                                  # broadleaf share 0.35 until twin_broadleaf.py runs
    im = Image.fromarray(out)
    if ring["blur"]:
        im = im.filter(ImageFilter.GaussianBlur(ring["blur"]))
    return im, water


def main():
    old = json.loads((tc.OUT / "twin.json").read_text(encoding="utf-8")) if (tc.OUT / "twin.json").exists() else {}
    manifest = {"version": 3, "built": __import__("datetime").date.today().isoformat(),
                "height": {"offset": H_OFF, "note": "h = (R*256 + G) * ring.step - ring.offset (or height.offset), metres; the true-frame rings are bent by the earth's curvature (earth.r_eff)"},
                "sea_level": 0.0,
                "frames": {
                    "scene": f"x east, y north in metres from {tc.LAT0} N {tc.LON0} E, x = (lon - {tc.LON0}) * {tc.M_LON:.4f}, y = (lat - {tc.LAT0}) * {tc.M_LAT:.1f}",
                    "true": f"azimuthal equidistant from the same origin on GRS80 (Vincenty), x scaled by {tc.SX:.6f} and y by {tc.SY:.6f} so it meets the scene frame to first order; the scene is therefore about 0.23 % smaller than the ground everywhere",
                },
                "earth": {"r_eff": round(tc.R_EFF, 1), "r": round(tc.R_GAUSS, 1), "k": tc.K_REFRACTION, "note": "drop = (x^2 + y^2) / (2 r_eff): the curvature less standard refraction"},
                "rings": [],
                "sources": {
                    "terrain": "Kartverket, Nasjonal detaljert hoydemodell (NHM), DTM 1 m, 5 m, 20 m and 200 m via hoydedata.no",
                    "canopy": "Kartverket NHM DOM 5 m and 20 m minus DTM, where NIBIO AR5 has forest, bog or open ground",
                    "aerial": "Esri World Imagery (Maxar, Earthstar Geographics and contributors)",
                    "land_cover": "NIBIO, AR5 arealtype",
                }}
    for k, v in old.items():
        if k not in manifest:
            manifest[k] = v                       # other steps' entries (graded, roads, depth) are kept
    for k, v in old.get("sources", {}).items():
        manifest["sources"].setdefault(k, v)

    built, canopies = {}, {}
    for i, ring in enumerate(RINGS):
        hole = RINGS[i - 1]["half"] if i else 0.0
        built[ring["name"]], canopies[ring["name"]] = ring_heights(ring, hole)

    # seams: each ring's outer edge follows the next ring's mesh, blended over 12 posts
    for i in range(len(RINGS) - 1):
        inner, outer = RINGS[i], RINGS[i + 1]
        hi, ho = built[inner["name"]], built[outer["name"]]
        prof = seam_profile(outer, ho)
        n = inner["n"]
        gx, gy = grid(inner["half"], n)
        target = prof(gx, gy)
        idx = np.arange(n)
        d = np.minimum.outer(np.minimum(idx, n - 1 - idx), np.minimum(idx, n - 1 - idx))
        w = np.clip(1.0 - d / 12.0, 0.0, 1.0) ** 2
        if inner["frame"] == "local":
            # the inner rings keep their sea at exactly 0 inside the band (the curvature is 0.1 m here)
            built[inner["name"]] = np.where(hi <= 0.0, np.where(d == 0, target, hi), hi * (1 - w) + target * w)
        else:
            built[inner["name"]] = hi * (1 - w) + target * w
        edge = d == 0
        built[inner["name"]][edge] = target[edge]

    prev_tex = None
    for i, ring in enumerate(RINGS):
        name = ring["name"]
        h = built[name]
        code = np.clip(np.rint((h + ring["offset"]) / ring["step"]), 0, 65535).astype(np.uint32)
        assert code.max() < 65535 and code.min() > 0, f"{name}: heights out of the code range"
        rgb = np.zeros((ring["n"], ring["n"], 3), np.uint8)
        rgb[..., 0] = (code >> 8).astype(np.uint8)
        rgb[..., 1] = (code & 255).astype(np.uint8)
        Image.fromarray(rgb).save(tc.OUT / f"ring_{name}_h.png", optimize=True)

        tex = Image.open(tc.CACHE / f"{ring['tex']}.png").convert("RGB")
        if prev_tex is not None:
            tex = match_colours(tex, prev_tex[0], ring["tex_half"], prev_tex[1])
        prev_tex = (tex, ring["tex_half"])
        tex.save(tc.OUT / f"ring_{name}.webp", quality=80, method=6)
        m, water = masks(ring)
        tc.save_lossless(m, tc.OUT / f"ring_{name}_m.webp")
        (tc.OUT / f"ring_{name}_m.png").unlink(missing_ok=True)          # the masks were PNG before
        sizes = {k: (tc.OUT / f"ring_{name}{k}").stat().st_size // 1024 for k in ("_h.png", ".webp", "_m.webp")}
        cano = canopies[name]
        print(f"  {name}: h {h.min():.1f}..{h.max():.1f} m, canopy mean {cano[cano > 0].mean() if (cano > 0).any() else 0:.1f} m on {np.mean(cano > 1) * 100:.0f} % of posts, water {water.mean() * 100:.1f} %, files KB {sizes}")
        files = {"height": f"ring_{name}_h.png", "aerial": f"ring_{name}.webp", "mask": f"ring_{name}_m.webp"}
        old_files = next((r["files"] for r in old.get("rings", []) if r["name"] == name), {})
        for k, f in old_files.items():
            if k not in files and (tc.OUT / f).exists():
                files[k] = f                      # other steps' textures (roads, depth)
        manifest["rings"].append({
            "name": name, "half": ring["half"], "n": ring["n"], "step": ring["step"], "offset": ring["offset"],
            "post_m": 2 * ring["half"] / (ring["n"] - 1), "tex_half": ring["tex_half"], "frame": ring["frame"],
            "curved": ring["frame"] == "true", "shore_m": ring.get("shore_m", 0.0),
            "hole": RINGS[i - 1]["half"] if i else 0,
            "files": files,
        })
    (tc.OUT / "twin.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print("manifest written")


if __name__ == "__main__":
    main()
