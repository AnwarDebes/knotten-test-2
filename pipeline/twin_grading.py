"""The ground once the field is built: house pads, road benches and the footpath, graded into r0.

For "today" the browser shows the measured terrain; for the cleared, built and lived states it
shows this graded version of the innermost ring. Nothing here is a design: it is the plan's own
numbers (data/plots.json pad heights, data/road.json road and path lines) with the plainest
earthworks a contractor would make, so the houses and roads sit on the ground instead of floating:

  pad      footprint + 2.5 m round the house (+ 4 m on the view side for the terrace) at floor - 0.6 m
  road     5 m wide with 0.75 m shoulders, flat across, at the road line's height along it
  path     1.5 m footpath with steps, following the path line
  slopes   fill at 1:1.5, cut at 1:0.7 (the ground here is shallow soil on rock), back to the terrain

Outputs (site/public/twin): ring_r0b_h.png (graded heights, same encoding as ring_r0_h.png) and
ring_r0b_m.png (2048 px over the r0 texture: R asphalt, G garden and verge, B fresh slope).
Run after twin_terrain.py: python pipeline/twin_grading.py
"""
from __future__ import annotations

import json
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

import twin_common as tc

MAN = json.loads((tc.OUT / "twin.json").read_text(encoding="utf-8"))
R0 = MAN["rings"][0]
N, HALF, POST, STEP, OFF = R0["n"], R0["half"], R0["post_m"], R0["step"], MAN["height"]["offset"]
TEX_HALF, MPX = R0["tex_half"], 2048

FILL, CUT = 1 / 1.5, 1 / 0.7          # rise per metre of horizontal distance


def decode():
    rgb = np.asarray(Image.open(tc.OUT / R0["files"]["height"])).astype(np.float64)
    return (rgb[..., 0] * 256 + rgb[..., 1]) * STEP - OFF


def encode(h, path):
    code = np.clip(np.rint((h + OFF) / STEP), 0, 65535).astype(np.uint32)
    rgb = np.zeros(h.shape + (3,), np.uint8)
    rgb[..., 0] = (code >> 8).astype(np.uint8)
    rgb[..., 1] = (code & 255).astype(np.uint8)
    Image.fromarray(rgb).save(path, optimize=True)


def apply_feature(h, inside, design, base, reach=24.0, fill_in=1.0, fill_out=2.5):
    """Set `design` inside the footprint and grade the ground around it with fill and cut slopes.

    Fill is capped: on this steep ground a contractor builds a retaining wall or a taller foundation
    rather than an embankment running down the hill, so deeper fill is left as a drop.
    """
    if not inside.any():
        return h
    # distance (m) from every post to the footprint, and the design height of the nearest footprint post
    dist, (iy, ix) = ndi.distance_transform_edt(~inside, return_indices=True)
    dist = dist * POST
    target = design[iy, ix]
    near = dist <= reach
    lo = target - FILL * dist        # fill slope going down from the edge
    hi = target + CUT * dist         # cut slope going up from the edge
    inner = np.where(design > h, np.minimum(design, np.maximum(h, base + fill_in)), design)
    outer = np.minimum(np.clip(h, lo, hi), np.maximum(h, base + fill_out))
    graded = np.where(inside, inner, outer)
    return np.where(near, graded, h)


def main():
    h0 = decode()
    s = np.linspace(-HALF, HALF, N)
    gx, gy = np.meshgrid(s, -s)
    h = h0.copy()

    plots = json.load(open(tc.DATA / "plots.json", encoding="utf-8"))["plots"]
    road = json.load(open(tc.DATA / "road.json", encoding="utf-8"))

    # mask canvases in post coordinates (heights) and texture coordinates (look)
    def post_xy(x, y):
        return ((x + HALF) / POST, (HALF - y) / POST)

    def tex_xy(x, y):
        return ((x + TEX_HALF) / (2 * TEX_HALF) * MPX, (TEX_HALF - y) / (2 * TEX_HALF) * MPX)

    look = {k: Image.new("L", (MPX, MPX), 0) for k in ("asphalt", "garden", "slope")}
    draw = {k: ImageDraw.Draw(v) for k, v in look.items()}

    # ---------------- roads (rows, hairpins and the access), flat across at the line's height
    lines = [r["pts"] for r in road["rows"]] + [r["pts"] for r in road["ramps"]]
    seg_z = {}
    for sgm in road["segments"]:
        seg_z[(round(sgm["from"][0], 1), round(sgm["from"][1], 1))] = sgm["from"][2]
        seg_z[(round(sgm["to"][0], 1), round(sgm["to"][1], 1))] = sgm["to"][2]
    for pts in lines:
        pts = np.array(pts, np.float64)
        zs = np.array([seg_z.get((round(p[0], 1), round(p[1], 1)), np.nan) for p in pts])
        if np.isnan(zs).all():
            continue
        idx = np.arange(len(zs))
        ok = ~np.isnan(zs)
        zs = np.interp(idx, idx[ok], zs[ok])
        # rasterise the 6.5 m corridor and its design height (nearest point on the line)
        corridor = Image.new("L", (N, N), 0)
        dc = ImageDraw.Draw(corridor)
        dc.line([post_xy(*p) for p in pts], fill=255, width=max(1, int(round(6.5 / POST))), joint="curve")
        inside = np.asarray(corridor) > 0
        # design height: from the nearest line vertex (vertices every ~3 m)
        line_mask = np.zeros((N, N), bool)
        zgrid = np.zeros((N, N))
        for (x, y), z in zip(pts, zs):
            c, r = post_xy(x, y)
            ci, ri = int(round(c)), int(round(r))
            if 0 <= ri < N and 0 <= ci < N:
                line_mask[ri, ci] = True
                zgrid[ri, ci] = z
        _, (iy, ix) = ndi.distance_transform_edt(~line_mask, return_indices=True)
        design = zgrid[iy, ix]
        h = apply_feature(h, inside, design, h0, fill_in=2.5, fill_out=2.5)
        draw["asphalt"].line([tex_xy(*p) for p in pts], fill=255, width=int(round(5.0 / (2 * TEX_HALF) * MPX)), joint="curve")
        draw["garden"].line([tex_xy(*p) for p in pts], fill=200, width=int(round(7.0 / (2 * TEX_HALF) * MPX)), joint="curve")

    # ---------------- house pads at floor - 0.6 m, with the terrace and garden on the view side
    for p in plots:
        x, y = p["local"]["x"], p["local"]["y"]
        hs = p["house"]
        pad = p["local"]["z_floor"] - 0.6
        f = math.radians(hs["facing_deg"])
        ca, sa = math.cos(f), math.sin(f)
        hw, hd = hs["width_m"] / 2 + 2.5, hs["depth_m"] / 2
        corners_uv = [(-hw, -hd - 2.5), (hw, -hd - 2.5), (hw, hd + 6.5), (-hw, hd + 6.5)]
        corners = [(x + u * ca + v * sa, y - u * sa + v * ca) for u, v in corners_uv]
        m = Image.new("L", (N, N), 0)
        ImageDraw.Draw(m).polygon([post_xy(*c) for c in corners], fill=255)
        inside = np.asarray(m) > 0
        h = apply_feature(h, inside, np.full((N, N), pad), h0, fill_in=1.0, fill_out=1.0)
        draw["garden"].polygon([tex_xy(*c) for c in corners], fill=255)

    # ---------------- the footpath (no earthworks to speak of: steps follow the ground)
    for path in road["paths"]:
        draw["garden"].line([tex_xy(*q) for q in path["pts"]], fill=255, width=int(round(1.6 / (2 * TEX_HALF) * MPX)), joint="curve")
        draw["slope"].line([tex_xy(*q) for q in path["pts"]], fill=140, width=int(round(1.5 / (2 * TEX_HALF) * MPX)), joint="curve")

    # ---------------- fresh slopes: where the ground moved by more than 0.3 m outside pads and roads
    moved = np.abs(h - h0) > 0.3
    sl = Image.fromarray((moved * 255).astype(np.uint8)).resize((MPX, MPX), Image.BILINEAR)
    sl_arr = np.asarray(sl).astype(np.float32)
    # the slope mask covers the r0 square, the texture covers +-TEX_HALF: place it
    canvas = Image.new("L", (MPX, MPX), 0)
    k = HALF / TEX_HALF
    size = int(round(MPX * k))
    off = (MPX - size) // 2
    canvas.paste(Image.fromarray(sl_arr.astype(np.uint8)).resize((size, size), Image.BILINEAR), (off, off))
    slope = np.maximum(np.asarray(look["slope"]), np.asarray(canvas))

    out = np.stack([np.asarray(look["asphalt"]), np.asarray(look["garden"]), slope], -1).astype(np.uint8)
    Image.fromarray(out).filter(ImageFilter.GaussianBlur(0.7)).save(tc.OUT / "ring_r0b_m.png", optimize=True)
    encode(h, tc.OUT / "ring_r0b_h.png")
    d = h - h0
    print(f"graded r0: moved {np.mean(np.abs(d) > 0.05) * 100:.1f} % of posts, cut up to {-d.min():.1f} m, fill up to {d.max():.1f} m")
    print(f"  files: ring_r0b_h.png {(tc.OUT / 'ring_r0b_h.png').stat().st_size // 1024} KB, ring_r0b_m.png {(tc.OUT / 'ring_r0b_m.png').stat().st_size // 1024} KB")
    MAN["graded"] = {"ring": "r0", "height": "ring_r0b_h.png", "mask": "ring_r0b_m.png",
                     "note": "the plan's pads, roads and footpath graded with fill 1:1.5 and cut 1:0.7 (pipeline/twin_grading.py); illustrative earthworks, not a design"}
    (tc.OUT / "twin.json").write_text(json.dumps(MAN, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
