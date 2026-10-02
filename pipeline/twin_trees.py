"""The forest for the twin: every tree within 1.28 km, with its measured height and its species.

Positions and heights: treetops in Kartverket's laser data (surface model minus terrain model, 1 m),
found the same way as the site tile's trees in prep_kartverket.py. Inside the site tile the existing
trees are kept exactly (data/trees.json), because the plan's clearing (house pads, roads, the view
corridors in the sun and view passports) is defined on them; only their species are re-read.

Species: NIBIO SR16 (dominant species on a 16 m grid: spruce, pine or broadleaf), then NIBIO AR5
forest type, then the aerial photo's colour for trees outside the forest maps. A stand is never
pure: within a pixel the dominant species gets three trees in four and the rest follow the photo.
Where the photo is unambiguous over a whole crown (a dark summer crown is a conifer), it overrides
the 16 m map, which misses small stands. (A bright crown is not taken as broadleaf: a small pine
over pale rock or heather looks bright from the air too.)
Broadleaf trees are split into birch and oak (with aspen and rowan drawn as one of those two); the
maps do not separate them.

Output: site/public/twin/trees.bin, 10 bytes per tree, little endian
  int16 x, int16 y        scene metres * 20 (x east, y north)
  uint16 z                ground height, centimetres above sea level
  uint8 h                 tree height / 0.15 m
  uint8 crown             crown radius / 0.04 m
  uint8 code              bits 0-1 species (0 spruce, 1 pine, 2 birch, 3 oak), bit 2 cleared by the plan, bits 3-7 tint
  uint8 rot               rotation * 256 / 2pi
and site/public/twin/trees.json with counts and sources.
Run after twin_buildings.py: python pipeline/twin_trees.py
"""
from __future__ import annotations

import hashlib
import json
import math
import struct

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

import twin_common as tc

HALF = 1280.0
TILE = 500.0                       # the site tile, where the existing trees are kept
SPECIES = {"spruce": 0, "pine": 1, "birch": 2, "oak": 3}
SR16 = {"gran": (82, 176, 56), "furu": (205, 170, 101), "lauv": (255, 220, 130)}
AR5T = {"bar": (125, 191, 110), "lauv": (128, 255, 8), "bland": (158, 204, 115), "ikke": (207, 204, 145)}


def h01(*parts):
    d = hashlib.sha1("|".join(map(str, parts)).encode()).digest()
    return int.from_bytes(d[:4], "little") / 2**32


def classes(stem, table):
    meta = json.loads((tc.CACHE / f"{stem}.json").read_text(encoding="utf-8"))
    rgba = np.asarray(Image.open(tc.CACHE / f"{stem}.png").convert("RGBA")).astype(np.int32)
    names = list(table)
    cols = np.array([table[k] for k in names])
    d = ((rgba[..., None, :3] - cols[None, None]) ** 2).sum(-1)
    lab = d.argmin(-1).astype(np.int16)
    lab[(rgba[..., 3] < 128) | (d.min(-1) > 1600)] = -1
    def sample(x, y):
        e, n = tc.local_to_utm(x, y)
        c = np.clip(((e - meta["e_min"]) / meta["pix"]).astype(np.int64), 0, lab.shape[1] - 1)
        r = np.clip(((meta["n_max"] - n) / meta["pix"]).astype(np.int64), 0, lab.shape[0] - 1)
        return lab[r, c]
    return names, sample


def detect(dtm, dom, bmask):
    """Treetops on the 1 m raster: local maxima of the smoothed canopy, window growing with height."""
    chm = np.clip(dom.a - dtm.a, 0, 45)
    chm[dtm.a <= 0.003] = 0
    chm[ndi.binary_dilation(bmask, iterations=1)] = 0
    sm = ndi.uniform_filter(chm, 3)
    peaks = np.zeros_like(sm, bool)
    for rad, lo, hi in ((1, 3.0, 7.0), (2, 7.0, 18.0), (3, 18.0, 99.0)):
        mx = ndi.maximum_filter(sm, size=2 * rad + 1)
        peaks |= (sm >= mx) & (sm >= lo) & (sm < hi)
    rr, cc = np.nonzero(peaks)
    hs = np.maximum(chm[rr, cc], sm[rr, cc])
    tops = [(r, c, h, False) for r, c, h in zip(rr, cc, hs)]
    # gap fill, as for the site tile: sub-canopy trees where the canopy is 4 m+ and no top within 3 m
    occ = np.zeros_like(sm, bool)
    occ[rr, cc] = True
    near = ndi.binary_dilation(occ, structure=np.ones((7, 7), bool))
    gr, gc = np.mgrid[2:sm.shape[0] - 2:3, 2:sm.shape[1] - 2:3]
    sel = (sm[gr, gc] >= 4.0) & ~near[gr, gc]
    for r, c in zip(gr[sel], gc[sel]):
        tops.append((r, c, max(3.0, chm[r, c] * 0.92), True))
    return tops


def main():
    dtm = tc.UtmRaster.load("dtm1")
    dom = tc.UtmRaster.load("dom1")
    bmask = np.load(tc.CACHE / "building_mask.npy")
    sr_names, sr = classes("sr16_treslag", SR16)
    ar_names, ar = classes("ar5_treslag", AR5T)
    aerial = [(r["tex_half"], np.asarray(Image.open(tc.OUT / r["files"]["aerial"]).convert("RGB"), np.float32))
              for r in json.loads((tc.OUT / "twin.json").read_text(encoding="utf-8"))["rings"][:2]]

    def colour(x, y):
        out = np.zeros((len(x), 3), np.float32)
        done = np.zeros(len(x), bool)
        for th, im in aerial:
            n = im.shape[0]
            ins = (np.abs(x) < th) & (np.abs(y) < th) & ~done
            c = np.clip(((x + th) / (2 * th) * n).astype(int), 0, n - 1)
            r = np.clip(((th - y) / (2 * th) * n).astype(int), 0, n - 1)
            out[ins] = im[r[ins], c[ins]]
            done |= ins
        return out / 255.0

    # the same photos as summed-area tables: a crown's mean colour in O(1) per tree
    sats = [(th, im.shape[0], np.pad(im.cumsum(0).cumsum(1), ((1, 0), (1, 0), (0, 0)))) for th, im in aerial]

    def crown_colour(x, y, rad):
        out = np.zeros((len(x), 3), np.float32)
        done = np.zeros(len(x), bool)
        for th, n, sat in sats:
            ins = (np.abs(x) < th - 6) & (np.abs(y) < th - 6) & ~done
            px = 2 * th / n
            c = (x + th) / px
            r = (th - y) / px
            k = np.maximum(1.0, rad / px)
            c0 = np.clip(c - k, 0, n).astype(int); c1 = np.clip(c + k + 1, 0, n).astype(int)
            r0 = np.clip(r - k, 0, n).astype(int); r1 = np.clip(r + k + 1, 0, n).astype(int)
            area = np.maximum(1, (c1 - c0) * (r1 - r0))[:, None]
            tot = sat[r1, c1] - sat[r0, c1] - sat[r1, c0] + sat[r0, c0]
            out[ins] = (tot / area)[ins]
            done |= ins
        return out / 255.0, done

    # ---------------- the site tile's existing trees (positions, heights and clearing kept)
    old = json.load(open(tc.DATA / "trees.json", encoding="utf-8"))["trees"]
    ox = np.array([t["x"] for t in old]); oy = np.array([t["y"] for t in old])
    oz = np.array([t["z"] for t in old]); oh = np.array([t["h"] for t in old])
    ocr = np.array([t["crown"] for t in old]); ocl = np.array([bool(t["cleared"]) for t in old])
    orot = np.array([t.get("rot", 0.0) for t in old])
    print(f"site tile: {len(old)} trees kept, {ocl.sum()} cleared by the plan")

    # ---------------- new trees in the rest of the 1.28 km square
    tops = detect(dtm, dom, bmask)
    rr = np.array([t[0] for t in tops]); cc = np.array([t[1] for t in tops])
    e = dtm.e_min + (cc + 0.5) * dtm.pix
    n = dtm.n_max - (rr + 0.5) * dtm.pix
    nx, ny = tc.utm_to_local(e, n)
    fill_all = np.array([t[3] for t in tops])
    # sub-canopy trees only matter up close; beyond 700 m the canopy hides them
    keep = (np.abs(nx) <= HALF) & (np.abs(ny) <= HALF) & ~((np.abs(nx) < TILE) & (np.abs(ny) < TILE))
    keep &= ~fill_all | ((np.abs(nx) < 700) & (np.abs(ny) < 700))
    nx, ny = nx[keep], ny[keep]
    nh = np.array([t[2] for t in tops])[keep]
    nz = dtm.a[rr[keep], cc[keep]].astype(np.float64)
    fill = fill_all[keep]
    ncr = np.where(fill, np.clip(0.22 * nh, 1.0, 4.2), np.clip(0.26 * nh, 1.2, 5.0))
    print(f"new trees outside the tile: {len(nx)} ({fill.sum()} sub-canopy)")

    X = np.concatenate([ox, nx]); Y = np.concatenate([oy, ny]); Z = np.concatenate([oz, nz])
    Hh = np.concatenate([oh, nh]); CR = np.concatenate([ocr, ncr]); CL = np.concatenate([ocl, np.zeros(len(nx), bool)])
    ROT = np.concatenate([orot, np.array([h01("rot", i) * 2 * math.pi for i in range(len(nx))])])

    # ---------------- species
    s_sr = sr(X, Y)
    s_ar = ar(X, Y)
    rgb = colour(X, Y)
    val = rgb.mean(1)
    green = rgb[:, 1] - 0.5 * (rgb[:, 0] + rgb[:, 2])
    # colour vote: dark and blue-green = spruce, bright yellow-green = broadleaf, between = pine
    col_vote = np.where(val < 0.17, 0, np.where((green > 0.045) & (val > 0.24), 2, 1))
    # the crown as a whole (not one pixel): where the photo is unambiguous it has the last word over
    # the 16 m forest map, which misses small stands (the spruces behind Raudberg's barns, say)
    crgb, cin = crown_colour(X, Y, CR)
    cval = crgb.mean(1)
    sp = np.empty(len(X), np.int8)
    for i in range(len(X)):
        r = h01("sp", round(X[i], 2), round(Y[i], 2))
        dom_sp = None
        if s_sr[i] >= 0:
            dom_sp = {"gran": 0, "furu": 1, "lauv": 2}[sr_names[s_sr[i]]]
        elif s_ar[i] >= 0 and ar_names[s_ar[i]] in ("bar", "lauv"):
            dom_sp = 2 if ar_names[s_ar[i]] == "lauv" else (0 if col_vote[i] == 0 else 1)
        if dom_sp is None:
            k = col_vote[i]
        elif r < 0.72:
            k = dom_sp
        else:
            k = col_vote[i] if col_vote[i] != dom_sp else (2 if dom_sp != 2 else 1)
        if cin[i] and k >= 2 and cval[i] < 0.15:
            k = 0 if cval[i] < 0.125 else 1          # a dark crown in summer is spruce, or pine
        # very tall trees on this coast are pine or spruce, not birch
        if k == 2 and Hh[i] > 24:
            k = 1
        if k == 2:  # broadleaf: oak on the warm, dry south faces and ridges, birch elsewhere
            k = 3 if h01("bl", round(X[i], 2), round(Y[i], 2)) < 0.5 else 2
        sp[i] = k
    tint = np.clip(((val - val.min()) / max(1e-6, np.ptp(val))) * 31 + np.array([h01("t", i) * 6 - 3 for i in range(len(X))]), 0, 31).astype(np.uint8)

    names = ["spruce", "pine", "birch", "oak"]
    counts = {names[k]: int((sp == k).sum()) for k in range(4)}
    print("species:", counts, "| sr16 cover %.0f %%" % (100 * (s_sr >= 0).mean()))

    # kept first, grouped by 80 m cells (so the page can pick the trees near the camera fast), then cleared
    CELL = 80.0
    ncell = int(2 * HALF / CELL)
    ci = np.clip(((X + HALF) // CELL).astype(int), 0, ncell - 1)
    cj = np.clip(((HALF - Y) // CELL).astype(int), 0, ncell - 1)
    cell = cj * ncell + ci
    order = np.lexsort((cell, CL))
    kept_cells = cell[order][: int((~CL).sum())]
    starts = np.searchsorted(kept_cells, np.arange(ncell * ncell + 1)).tolist()
    buf = bytearray()
    for i in order:
        code = int(sp[i]) | (4 if CL[i] else 0) | (int(tint[i]) << 3)
        buf += struct.pack("<hhHBBBB", int(round(X[i] * 20)), int(round(Y[i] * 20)), int(round(Z[i] * 100)),
                           min(255, int(round(Hh[i] / 0.15))), min(255, int(round(CR[i] / 0.04))), code,
                           int(round((ROT[i] % (2 * math.pi)) / (2 * math.pi) * 256)) % 256)
    (tc.OUT / "trees.bin").write_bytes(bytes(buf))
    meta = {"count": int(len(X)), "kept": int((~CL).sum()), "cleared": int(CL.sum()), "bytes_per_tree": 10,
            "grid": {"half": HALF, "cell": CELL, "n": ncell, "starts": starts, "note": "kept trees of cell (row j from the north, column i from the west) are [starts[j*n+i], starts[j*n+i+1])"},
            "layout": "int16 x*20, int16 y*20, uint16 z cm, uint8 h/0.15, uint8 crown/0.04, uint8 code (bits 0-1 species 0 spruce 1 pine 2 birch 3 oak, bit 2 cleared, bits 3-7 tint), uint8 rot*256/2pi",
            "order": "kept trees first, by grid cell; then the trees the plan clears",
            "species": counts,
            "sources": {"trees": "Kartverket NHM DOM minus DTM, 1 m (treetops)", "species": "NIBIO SR16 dominant species (16 m), NIBIO AR5 forest type, aerial colour"}}
    (tc.OUT / "trees.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"trees.bin: {len(buf) // 1024} KB, {meta['count']} trees ({meta['kept']} kept, {meta['cleared']} cleared)")


if __name__ == "__main__":
    main()
