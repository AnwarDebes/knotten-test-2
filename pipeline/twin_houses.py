"""Which houses get a lower floor: the example house of the model fitted to each plot's ground.

Every house in data/plots.json is the same box (11 x 8.5 m, the view side to the south), on a pad at
the ground under its centre. The ground at Knotten falls in every direction, often across the house
rather than towards the view, so one house type cannot sit the same way on all 30 plots. A builder
would do what this script does: where the ground in front of the house lies low enough, the house
gets a lower floor under its view side, opening onto a patio dug or filled to that floor's level;
elsewhere it stays on one floor on a foundation that follows the rock.

The rule (site/src/lib/house/houseType.json, "lower_rule"): measured along the front wall on today's
terrain (Kartverket DTM, ring r0), the ground may on average stand at most 1.2 m above the lower
floor and nowhere more than 2.6 m (so the patio is never dug deeper than that).

Output: site/public/twin/houses.json, read by the browser (the house model) and by twin_grading.py
(the patios). Run after twin_terrain.py and before twin_grading.py:
    python pipeline/twin_houses.py
"""
from __future__ import annotations

import json
import math

import numpy as np
from PIL import Image

import twin_common as tc

TYPE = json.loads((tc.KN / "site" / "src" / "lib" / "house" / "houseType.json").read_text(encoding="utf-8"))
MAN = json.loads((tc.OUT / "twin.json").read_text(encoding="utf-8"))
R0 = MAN["rings"][0]
N, HALF, POST, STEP, OFF = R0["n"], R0["half"], R0["post_m"], R0["step"], MAN["height"]["offset"]


def decode(name):
    rgb = np.asarray(Image.open(tc.OUT / name)).astype(np.float64)
    return (rgb[..., 0] * 256 + rgb[..., 1]) * STEP - OFF


def height_at(h, x, y):
    """Bilinear ground height at local metres (x east, y north)."""
    fx, fy = (x + HALF) / POST, (HALF - y) / POST
    i, j = int(math.floor(fx)), int(math.floor(fy))
    tx, ty = fx - i, fy - j
    a = h[j, i] * (1 - tx) + h[j, i + 1] * tx
    b = h[j + 1, i] * (1 - tx) + h[j + 1, i + 1] * tx
    return a * (1 - ty) + b * ty


def main():
    h0 = decode(R0["files"]["height"])
    plots = json.load(open(tc.DATA / "plots.json", encoding="utf-8"))["plots"]
    rule = TYPE["lower_rule"]
    out = []
    for i, p in enumerate(plots):
        hs = p["house"]
        f = math.radians(hs["facing_deg"])
        ca, sa = math.cos(f), math.sin(f)
        x, y, floor = p["local"]["x"], p["local"]["y"], p["local"]["z_floor"]
        hw, hd = hs["width_m"] / 2, hs["depth_m"] / 2
        lower_z = floor - TYPE["lower_depth"]

        def at(u, v):
            return height_at(h0, x + u * ca + v * sa, y - u * sa + v * ca)

        front = np.array([at(u, hd) for u in np.arange(-hw, hw + 0.01, 0.5)])
        rel = front - lower_z
        lower = bool(rel.mean() <= rule["front_mean_max"] and rel.max() <= rule["front_max_max"])
        n = int(p["id"].split("-")[1])
        out.append({
            "id": p["id"],
            # every other house is drawn mirrored, as builders vary a row of one house type
            "mirror": n % 2 == 0,
            "lower": lower,
            "floor_z": round(floor, 2),
            "lower_z": round(lower_z, 2) if lower else None,
            "patio_z": round(lower_z - TYPE["patio"]["below_floor"], 2) if lower else None,
            "front_ground_rel_lower": [round(float(rel.min()), 2), round(float(rel.mean()), 2), round(float(rel.max()), 2)],
        })
        print(f"  {p['id']} lower floor {'yes' if lower else 'no '}  front ground above that floor: "
              f"mean {rel.mean():+.2f}  min {rel.min():+.2f}  max {rel.max():+.2f}", flush=True)

    doc = {
        "version": 1,
        "built": "2026-10-02",
        "note": "The model's example house on each plot: whether it has a lower floor under its view side (pipeline/twin_houses.py, rule in src/lib/house/houseType.json). An illustration of how one house type adapts to the ground, not a design.",
        "houses": out,
    }
    (tc.OUT / "houses.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"houses.json: {sum(h['lower'] for h in out)} of {len(out)} houses with a lower floor")


if __name__ == "__main__":
    main()
