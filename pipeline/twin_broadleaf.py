"""The share of broadleaf trees in the woods, written into the terrain masks for the winter look.

The aerial photos are summer pictures: from above a birch or oak wood is as green as a pine wood. In
winter the broadleaf woods are bare (grey-brown twigs over leaf litter) while pine and spruce stay
green. The terrain shader needs to know which is which, and the trees already do: this step counts
the twin's own trees (trees.bin, species from NIBIO SR16 and AR5) on a 4 m grid, smooths the count
over about 12 m, and writes the broadleaf share into the blue channel of the masks of the two inner
rings (0 all conifer, 255 all broadleaf). Beyond the trees, out to 20 km, the share comes from NIBIO
SR16's dominant species (spruce, pine or broadleaf, on a 16 m grid), smoothed over about 50 m; where
SR16 has no forest, and beyond 20 km, it is a typical 0.35 for the lowland woods of Agder. Mask
channels after this step:
  R water, G forest (NIBIO AR5), B broadleaf share of the trees.
Run after twin_trees.py: python pipeline/twin_broadleaf.py
"""
from __future__ import annotations

import json

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

import twin_common as tc

CELL = 4.0
DEFAULT = 0.35


def share_grid():
    """Broadleaf share on a CELL grid over the trees' square, with its extent."""
    raw = np.fromfile(tc.OUT / "trees.bin", dtype=np.uint8).reshape(-1, 10)
    x = raw[:, 0:2].copy().view("<i2").ravel() / 20.0
    y = raw[:, 2:4].copy().view("<i2").ravel() / 20.0
    sp = raw[:, 8] & 3
    half = float(np.ceil(max(np.abs(x).max(), np.abs(y).max()) / CELL) * CELL)
    n = int(2 * half / CELL)
    i = np.clip(((x + half) / CELL).astype(int), 0, n - 1)
    j = np.clip(((half - y) / CELL).astype(int), 0, n - 1)
    allc = np.zeros((n, n)); broad = np.zeros((n, n))
    np.add.at(allc, (j, i), 1.0)
    np.add.at(broad, (j, i), (sp >= 2).astype(float))
    allc = ndi.gaussian_filter(allc, 3.0)
    broad = ndi.gaussian_filter(broad, 3.0)
    weight = np.clip(allc / 0.02, 0, 1)          # where trees thin out, ease toward the default
    share = np.where(allc > 1e-6, broad / np.maximum(allc, 1e-6), DEFAULT)
    return half, n, share * weight + DEFAULT * (1 - weight)


SR16 = {"gran": (82, 176, 56), "furu": (205, 170, 101), "lauv": (255, 220, 130)}


def sr16_share(stem, smooth_m=50.0):
    """Broadleaf share from SR16's dominant species on its own UTM grid (NaN where SR16 has no forest)."""
    meta = json.loads((tc.CACHE / f"{stem}.json").read_text(encoding="utf-8"))
    rgba = np.asarray(Image.open(tc.CACHE / f"{stem}.png").convert("RGBA")).astype(np.int32)
    names = list(SR16)
    cols = np.array([SR16[k] for k in names])
    d = ((rgba[..., None, :3] - cols[None, None]) ** 2).sum(-1)
    lab = d.argmin(-1)
    known = (rgba[..., 3] >= 128) & (d.min(-1) <= 1200)
    broad = ((lab == names.index("lauv")) & known).astype(np.float64)
    sig = smooth_m / meta["pix"]
    num = ndi.gaussian_filter(broad, sig)
    den = ndi.gaussian_filter(known.astype(np.float64), sig)
    share = np.where(den > 0.05, num / np.maximum(den, 1e-6), np.nan)
    return share, meta


def main():
    half, n, share = share_grid()
    manifest = json.loads((tc.OUT / "twin.json").read_text(encoding="utf-8"))
    outer = {"r2": "sr16_treslag_10", "r3": "sr16_treslag_40"}
    for ring in manifest["rings"]:
        path = tc.OUT / ring["files"]["mask"]
        im = np.asarray(Image.open(path).convert("RGB")).copy()
        px = im.shape[0]
        th = ring["tex_half"]
        s = (np.arange(px) + 0.5) / px * 2 * th - th
        gx, gy = np.meshgrid(s, -s)
        b = np.full((px, px), DEFAULT)
        stem = outer.get(ring["name"])
        if stem and (tc.CACHE / f"{stem}.png").exists():
            sh, meta = sr16_share(stem)
            e, nn = (tc.true_to_utm if ring.get("frame") == "true" else tc.local_to_utm)(gx, gy)
            fc = (e - meta["e_min"]) / meta["pix"] - 0.5
            fr = (meta["n_max"] - nn) / meta["pix"] - 0.5
            v = ndi.map_coordinates(np.nan_to_num(sh, nan=-1.0), [fr, fc], order=0, mode="nearest")
            b = np.where(v >= 0, v, DEFAULT)
        fi = (gx + half) / CELL - 0.5
        fj = (half - gy) / CELL - 0.5
        inside = (fi >= 0) & (fi <= n - 1) & (fj >= 0) & (fj <= n - 1)
        if inside.any():
            b[inside] = ndi.map_coordinates(share, [fj[inside], fi[inside]], order=1, mode="nearest")
        # in 32 steps: plenty for a tint, and the mask compresses to a third less
        b = np.round(np.clip(b, 0.0, 1.0) * 31.0) / 31.0
        im[..., 2] = np.clip(np.round(b * 255), 0, 255).astype(np.uint8)
        tc.save_lossless(Image.fromarray(im), path)
        cov = b[inside].mean() if inside.any() else DEFAULT
        print(f"  {ring['name']}: {path.name} blue = broadleaf share (mean {cov:.2f} where trees are known)")
    manifest.setdefault("sources", {})["broadleaf"] = "share of broadleaf trees in trees.bin (NIBIO SR16, AR5) and, out to 20 km, NIBIO SR16 dominant species; mask channel B"
    (tc.OUT / "twin.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
