"""Terrain rings for the browser twin: height maps, aerial textures and land/water masks.

Four nested squares around the site, each finer than the next:
  r0  +-320 m    1.25 m posts   Kartverket DTM 1 m    aerial 0.32 m/px
  r1  +-1280 m   2.5 m posts    Kartverket DTM 1 m    aerial 1.26 m/px
  r2  +-5120 m   10 m posts     Kartverket DTM 5 m    aerial 5 m/px
  r3  +-20480 m  40 m posts     Kartverket DTM 20 m   aerial 20 m/px

Water is not a separate sheet any more. Kartverket flattens the sea to exactly 0.0 m and the
lakes to (nearly) their level, so the terrain mesh already is the water surface; the mask
texture tells the shader where to draw water. Nothing is coplanar, so nothing can flicker.

Outputs in site/public/twin/:
  ring_rN_h.png     height map, RGB: R*256+G = (h + 20) / step (step per ring), B unused
  ring_rN.webp      aerial photo, colour-matched to the ring inside it
  ring_rN_m.png     masks: R water, G forest (NIBIO AR5), B broadleaf share (twin_broadleaf.py; 0.35 until it runs)
  twin.json         ring layout, encodings, sources
Run: python pipeline/twin_terrain.py
"""
from __future__ import annotations

import json

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

import twin_common as tc

Image.MAX_IMAGE_PIXELS = None

H_OFF = 20.0                        # height code = (h + 20) / step, 16 bits in R and G; step per ring
RINGS = [
    dict(name="r0", half=320.0, n=513, step=0.02, src="dtm1", tex="img_r0", tex_half=330.0, ar5="ar5_arealtype", tex_px=2048, mask_px=2048, blur=0.8),
    dict(name="r1", half=1280.0, n=1025, step=0.05, src="dtm1", tex="img_r1", tex_half=1290.0, ar5="ar5_arealtype", tex_px=2048, mask_px=2048, blur=0.6),
    dict(name="r2", half=5120.0, n=513, step=0.1, src="dtm5", tex="img_r2", tex_half=5150.0, ar5="ar5_arealtype_5", tex_px=2048, mask_px=1024, blur=0.0),
    dict(name="r3", half=20480.0, n=513, step=0.25, src="dtm20", tex="img_r3", tex_half=20500.0, ar5="ar5_arealtype_20", tex_px=2048, mask_px=1024, blur=0.0),
]

AR5 = {"fulldyrka": (255, 209, 110), "overflatedyrka": (255, 255, 76), "innmarksbeite": (255, 255, 173),
       "skog": (158, 204, 115), "myr": (110, 200, 240), "apen": (217, 217, 217), "ferskvann": (145, 231, 255),
       "hav": (204, 254, 254), "bebygd": (252, 219, 214), "samferdsel": (179, 120, 76)}
AR5_NAMES = list(AR5)


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

    def sample(self, x, y):
        e, n = tc.local_to_utm(x, y)
        c = np.clip(((e - self.meta["e_min"]) / self.meta["pix"]).astype(np.int64), 0, self.w - 1)
        r = np.clip(((self.meta["n_max"] - n) / self.meta["pix"]).astype(np.int64), 0, self.h - 1)
        return self.lab[r, c]


def grid(half, n):
    s = np.linspace(-half, half, n)
    gx, gy = np.meshgrid(s, -s)          # row 0 = north
    return gx, gy


def heights(ring, dem):
    gx, gy = grid(ring["half"], ring["n"])
    return dem.sample(gx, gy).astype(np.float64)


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


def build_ring(ring):
    dem = tc.UtmRaster.load(ring["src"])
    gx, gy = grid(ring["half"], ring["n"])
    h = dem.sample(gx, gy).astype(np.float64)
    # land never dips under the sea: the sea is exactly 0.0, land next to it is lifted a hand's breadth
    sea = h <= 0.003
    return np.where(sea, 0.0, np.maximum(h, 0.12))


def seam_profile(outer_ring, outer_h, half_inner):
    """Heights the outer ring's mesh has along the inner ring's edge (linear between its posts)."""
    no, ho = outer_ring["n"], outer_ring["half"]
    step = 2 * ho / (no - 1)
    def at(x, y):
        # bilinear on the outer ring's post grid, which is exact on its grid lines
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
    # the part of img covered by ref
    s = img.size[0]
    k = ref_half / img_half
    c0, c1 = int(s * (0.5 - k / 2)), int(s * (0.5 + k / 2))
    crop = Image.fromarray(a[c0:c1, c0:c1].astype(np.uint8)).resize((256, 256), Image.BILINEAR)
    refs = Image.fromarray(b.astype(np.uint8)).resize((256, 256), Image.BILINEAR)
    ca, cb = np.asarray(crop, np.float32).reshape(-1, 3), np.asarray(refs, np.float32).reshape(-1, 3)
    gain = cb.std(0) / np.maximum(ca.std(0), 1e-3)
    gain = np.clip(gain, 0.8, 1.25)
    off = cb.mean(0) - ca.mean(0) * gain
    out = np.clip(a * gain + off, 0, 255).astype(np.uint8)
    print(f"    colour match: gain {gain.round(3)}, offset {off.round(1)}")
    return Image.fromarray(out)


def masks(ring, dem, ar5):
    """Water and forest masks on the texture grid (anti-aliased); blue is filled in by twin_broadleaf.py."""
    px = ring["mask_px"]
    th = ring["tex_half"]
    texel = 2 * th / px
    s = (np.arange(px) + 0.5) / px * 2 * th - th
    gx, gy = np.meshgrid(s, -s)
    h = dem.sample(gx, gy)
    cls = ar5.sample(gx, gy)
    sea = h <= 0.003
    lakes = fresh_water(h, cls, texel, 0.25 if texel < 2 else (0.5 if texel < 10 else 1.0))
    water = sea | lakes
    forest = cls == AR5_NAMES.index("skog")
    out = np.stack([water, forest & ~water, np.zeros_like(water)], -1).astype(np.uint8) * 255
    out[..., 2] = 89                                  # broadleaf share 0.35 until twin_broadleaf.py runs
    im = Image.fromarray(out)
    if ring["blur"]:
        im = im.filter(ImageFilter.GaussianBlur(ring["blur"]))
    return im, water


def main():
    manifest = {"version": 2, "built": __import__("datetime").date.today().isoformat(),
                "height": {"offset": H_OFF, "note": "h = (R*256 + G) * ring.step - offset, metres above NN2000"},
                "sea_level": 0.0, "rings": [],
                "sources": {
                    "terrain": "Kartverket, Nasjonal detaljert hoydemodell (NHM), DTM 1 m, 5 m and 20 m via hoydedata.no",
                    "aerial": "Esri World Imagery (Maxar, Earthstar Geographics and contributors)",
                    "land_cover": "NIBIO, AR5 arealtype",
                }}
    built = {}
    prev_tex = None
    for ring in RINGS:
        built[ring["name"]] = build_ring(ring)

    # seams: each ring's outer edge follows the next ring's mesh, blended over 12 posts
    for i in range(len(RINGS) - 1):
        inner, outer = RINGS[i], RINGS[i + 1]
        hi, ho = built[inner["name"]], built[outer["name"]]
        prof = seam_profile(outer, ho, inner["half"])
        n = inner["n"]
        gx, gy = grid(inner["half"], n)
        target = prof(gx, gy)
        # distance in posts from the edge
        idx = np.arange(n)
        d = np.minimum.outer(np.minimum(idx, n - 1 - idx), np.minimum(idx, n - 1 - idx))
        w = np.clip(1.0 - d / 12.0, 0.0, 1.0) ** 2
        built[inner["name"]] = np.where(hi <= 0.0, hi, hi * (1 - w) + target * w)
        edge = d == 0
        built[inner["name"]][edge] = target[edge]

    for ring in RINGS:
        name = ring["name"]
        h = built[name]
        code = np.clip(np.rint((h + H_OFF) / ring["step"]), 0, 65535).astype(np.uint32)
        rgb = np.zeros((ring["n"], ring["n"], 3), np.uint8)
        rgb[..., 0] = (code >> 8).astype(np.uint8)
        rgb[..., 1] = (code & 255).astype(np.uint8)
        Image.fromarray(rgb).save(tc.OUT / f"ring_{name}_h.png", optimize=True)

        dem = tc.UtmRaster.load(ring["src"])
        ar5 = Ar5(ring["ar5"])
        tex = Image.open(tc.CACHE / f"{ring['tex']}.png").convert("RGB")
        if prev_tex is not None:
            tex = match_colours(tex, prev_tex[0], ring["tex_half"], prev_tex[1])
        prev_tex = (tex, ring["tex_half"])
        tex.save(tc.OUT / f"ring_{name}.webp", quality=80, method=6)
        m, water = masks(ring, dem, ar5)
        m.save(tc.OUT / f"ring_{name}_m.png", optimize=True)
        sizes = {k: (tc.OUT / f"ring_{name}{k}").stat().st_size // 1024 for k in ("_h.png", ".webp", "_m.png")}
        print(f"  {name}: h {h.min():.1f}..{h.max():.1f} m, water {water.mean() * 100:.1f} %, files KB {sizes}")
        manifest["rings"].append({
            "name": name, "half": ring["half"], "n": ring["n"], "step": ring["step"], "post_m": 2 * ring["half"] / (ring["n"] - 1),
            "tex_half": ring["tex_half"], "hole": RINGS[RINGS.index(ring) - 1]["half"] if RINGS.index(ring) else 0,
            "files": {"height": f"ring_{name}_h.png", "aerial": f"ring_{name}.webp", "mask": f"ring_{name}_m.png"},
        })
    (tc.OUT / "twin.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print("manifest written")


if __name__ == "__main__":
    main()
