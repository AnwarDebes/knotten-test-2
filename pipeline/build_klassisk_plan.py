"""The Klassisk site plan, drawn from the model: writes site/src/lib/klassisk/siteplan.ts.

North up, in the 820 x 520 frame the Klassisk SitePlan uses: parcel 355/10 and the yard 355/368 from the
cadastre, 5 m contours from the 1 m LiDAR, the forest where the laser found trees, Rødbergsveien from
OpenStreetMap, the office and the house with the two planned buildings, and from layout v6 the road, the
footpath and the 30 plots in rows A to D, each turned the way its house faces. Both designs then show the
same plots in the same places with the same numbers.

Run after plan_layout_v6.py:  python pipeline/build_klassisk_plan.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
import knotten_terrain as kt  # noqa: E402

KN = Path(__file__).resolve().parent.parent
OUT_TS = KN / "site" / "src" / "lib" / "klassisk" / "siteplan.ts"

W, H = 820, 520
X0, X1, Y0, Y1 = -72.0, 232.0, -168.0, 100.0          # the frame in local metres
S = H / (Y1 - Y0)                                      # px per metre
U0 = (W - (X1 - X0) * S) / 2


XA, XB = X0 - U0 / S, X1 + U0 / S                     # the ground drawn edge to edge, left and right of the frame


def uv(x, y):
    return (U0 + (x - X0) * S, (Y1 - y) * S)


def simplify(pts, tol):
    """Douglas-Peucker on a list of (u, v)."""
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a
    L = np.hypot(*ab)
    P = np.array(pts)
    if L == 0:
        d = np.hypot(*(P - a).T)
    else:
        d = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / L
    i = int(np.argmax(d))
    if d[i] > tol:
        return simplify(pts[:i + 1], tol)[:-1] + simplify(pts[i:], tol)
    return [pts[0], pts[-1]]


def d_of(pts, closed=False, tol=0.35):
    q = simplify([tuple(p) for p in pts], tol)
    s = "M" + " L".join(f"{u:.1f} {v:.1f}" for u, v in q)
    return s + ("Z" if closed else "")


def inside_frame(u, v, pad=0.0):
    return -pad <= u <= W + pad and -pad <= v <= H + pad


# ------------------------------------------------------------ terrain: contours
RES, HALF, STEP = kt.RES, kt.HALF, kt.STEP
dtm = np.maximum(np.frombuffer(kt.DTM.tobytes(), dtype=np.float32).reshape(RES, RES).astype(float), 0.0)
i0, i1 = int((XA - 5 + HALF) / STEP), int((XB + 5 + HALF) / STEP) + 1
j0, j1 = int((HALF - Y1 - 5) / STEP), int((HALF - Y0 + 5) / STEP) + 1
Z = ndimage.gaussian_filter(dtm, 1.5)[j0:j1, i0:i1]
xs = -HALF + np.arange(i0, i1) * STEP
ys = HALF - np.arange(j0, j1) * STEP

import matplotlib  # noqa: E402
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

contours = []
fig, ax = plt.subplots()
levels = list(range(5, 100, 5))
cs = ax.contour(xs, ys, Z, levels=levels)
for lev, segs in zip(levels, cs.allsegs):
    parts = []
    for seg in segs:
        pts = [uv(x, y) for x, y in seg]
        run = []
        for p in pts:
            if inside_frame(*p, 2):
                run.append(p)
            else:
                if len(run) > 3:
                    parts.append(d_of(run, tol=0.5))
                run = []
        if len(run) > 3:
            parts.append(d_of(run, tol=0.5))
    if parts:
        contours.append({"z": lev, "major": lev % 25 == 0, "d": " ".join(parts)})
plt.close(fig)

# ------------------------------------------------------------ forest, from the trees the laser found
trees = json.loads((KN / "data" / "trees.json").read_text(encoding="utf-8"))["trees"]
G = 3.0
gx = np.arange(XA - 10, XB + 10, G)
gy = np.arange(Y0 - 10, Y1 + 10, G)
dens = np.zeros((len(gy), len(gx)))
for t in trees:
    i = int((t["x"] - gx[0]) / G)
    j = int((t["y"] - gy[0]) / G)
    if 0 <= i < len(gx) and 0 <= j < len(gy):
        dens[j, i] += 1
dens = ndimage.gaussian_filter(dens, 2.0)
dens[:2, :] = dens[-2:, :] = 0.0          # an empty ring round the grid, so every outline closes (off the frame)
dens[:, :2] = dens[:, -2:] = 0.0
forest_loops = []
fig, ax = plt.subplots()
cs = ax.contour(gx, gy, dens, levels=[0.12])
for seg in cs.allsegs[0]:
    pts = [uv(x, y) for x, y in seg]
    pts = [(min(max(u, -4), W + 4), min(max(v, -4), H + 4)) for u, v in pts]
    if len(pts) > 6:
        forest_loops.append(d_of(pts, closed=True, tol=0.8))
plt.close(fig)
forest = " ".join(forest_loops)            # one path, filled even-odd: the clearings inside the forest are holes
# a thin sample of the trees themselves, as dots
in_frame = [t for t in trees if inside_frame(*uv(t["x"], t["y"]), -3)]
keep_every = max(1, len(in_frame) // 360)
dots = []
for k, t in enumerate(in_frame):
    if (k * 2654435761) % keep_every:
        continue
    u, v = uv(t["x"], t["y"])
    dots.append([round(u, 1), round(v, 1), 1 if t.get("cleared") else 0])

# ------------------------------------------------------------ parcels, buildings, roads outside
parcel = d_of([uv(x, y) for x, y in kt.HILL], closed=True, tol=0.2)
yard = d_of([uv(x, y) for x, y in kt.YARD], closed=True, tol=0.2)
buildings = []
for b in kt.buildings:
    ring = [uv(x, y) for x, y in b["ring_local"]]
    edges = [(ring[i], ring[(i + 1) % len(ring)]) for i in range(len(ring))]
    (ua, va), (ub, vb) = max(edges, key=lambda e: math.dist(*e))
    ang = math.degrees(math.atan2(vb - va, ub - ua))
    ang = ang - 180 if ang > 90 else ang + 180 if ang < -90 else ang        # keep the text upright
    buildings.append({"id": b["id"], "status": b["status"], "name": b["name"]["no"], "d": d_of(ring, closed=True, tol=0.1),
                      "c": [round(v, 1) for v in uv(sum(p[0] for p in b["ring_local"]) / len(b["ring_local"]), sum(p[1] for p in b["ring_local"]) / len(b["ring_local"]))],
                      "angle": round(ang, 1)})
osm = json.loads((KN / "source" / "osm_raw.json").read_text(encoding="utf-8"))
els = osm["elements"] if isinstance(osm, dict) else osm
meta = json.loads((KN / "source" / "area_meta.json").read_text(encoding="utf-8"))
LAT, LON = meta["center"]["lat"], meta["center"]["lon"]
M_LAT, M_LON = meta["m_per_deg"]["lat"], meta["m_per_deg"]["lon"]
street = []
for e in els:
    t = e.get("tags", {})
    if e.get("type") == "way" and t.get("name") == "Rødbergsveien" and t.get("highway") in ("unclassified", "residential", "tertiary") and "geometry" in e:
        pts = [uv((g["lon"] - LON) * M_LON, (g["lat"] - LAT) * M_LAT) for g in e["geometry"]]
        run = []
        for p in pts:
            if inside_frame(*p, 30):
                run.append(p)
            elif run:
                if len(run) > 1:
                    street.append(d_of(run, tol=0.3))
                run = []
        if len(run) > 1:
            street.append(d_of(run, tol=0.3))

# ------------------------------------------------------------ the layout: road, footpath, plots
road = json.loads((KN / "data" / "road.json").read_text(encoding="utf-8"))
line = [s["from"][:2] for s in road["segments"]] + [road["segments"][-1]["to"][:2]]
road_d = d_of([uv(x, y) for x, y in line], tol=0.3)
path = road["paths"][0]["pts"]
path_d = d_of([uv(x, y) for x, y in path], tol=0.3)
plots = json.loads((KN / "data" / "plots.json").read_text(encoding="utf-8"))["plots"]
out_plots = []
for p in plots:
    u, v = uv(p["local"]["x"], p["local"]["y"])
    out_plots.append({"n": int(p["id"].split("-")[1]), "id": p["id"], "row": p["row_label"], "x": round(u, 1), "y": round(v, 1),
                      "rot": round(p["house"]["facing_deg"] - 180.0, 1), "terrain": p["terrain"]["note"]["no"]})
assert [q["n"] for q in out_plots] == list(range(1, 31))
first = {}
for q in out_plots:
    first.setdefault(q["row"], q)
counts = {r: sum(1 for q in out_plots if q["row"] == r) for r in "ABCD"}
# the pills sit left of each row's first plot; rows that start at the west boundary get theirs in the margin,
# clear of the hairpins there
row_info = {r: {"count": counts[r], "x": 34.0 if first[r]["x"] < 200 else round(first[r]["x"] - 113, 1), "y": first[r]["y"]} for r in "ABCD"}

# where the labels go
lbl = {
    "lokkeheia": [round(v, 1) for v in uv(-24, 94.5)],
    "knotten": [round(v, 1) for v in uv(40, -44)],
    "gangsti": [round(v, 1) for v in uv(33, -22)],
    "parcel": [round(v, 1) for v in uv(-55, 73.5)],
}
# Rødbergsveien label: where the street runs nearly north-south, near the right edge of the frame
st_pts = []
for e in els:
    t = e.get("tags", {})
    if e.get("type") == "way" and t.get("name") == "Rødbergsveien" and t.get("highway") in ("unclassified", "residential", "tertiary") and "geometry" in e:
        st_pts += [((g["lon"] - LON) * M_LON, (g["lat"] - LAT) * M_LAT) for g in e["geometry"]]
cand = sorted((p for p in st_pts if -150 <= p[1] <= -40 and 185 < p[0] < X1), key=lambda p: p[1])
lo, hi = cand[0], cand[-1]
ua, va = uv(*lo)
ub, vb = uv(*hi)
street_angle = math.degrees(math.atan2(vb - va, ub - ua))       # along the street, pointing north
mid = cand[len(cand) // 2]
lbl["street"] = [round(v, 1) for v in uv(mid[0] + 9, mid[1] - 18)] + [round(street_angle, 1)]
scale_px = round(50 * S, 1)

data = {
    "frame": {"w": W, "h": H, "px_per_m": round(S, 4), "x0": X0, "y1": Y1, "u0": round(U0, 2)},
    "contours": contours, "forest": forest, "trees": dots, "parcel": parcel, "yard": yard, "buildings": buildings, "street": street,
    "road": road_d, "path": path_d, "plots": out_plots, "rows": row_info, "labels": lbl, "scale_50m_px": scale_px,
}
ts = [
    "/**",
    " * The Klassisk site plan, drawn from the model. Generated by pipeline/build_klassisk_plan.py from",
    " * data/plots.json and road.json (layout v6), the cadastre, the 1 m LiDAR, the laser-found trees and",
    " * OpenStreetMap. Do not edit by hand; rerun the script after the layout changes.",
    " * North up; SVG frame 820 x 520; px = u0 + (x - x0) * px_per_m, py = (y1 - y) * px_per_m.",
    " */",
    "export const SITEPLAN = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + " as const;",
    "",
]
OUT_TS.write_text("\n".join(ts), encoding="utf-8")
print(f"wrote {OUT_TS.relative_to(KN)}: {OUT_TS.stat().st_size // 1024} KB, {len(contours)} contour levels, {len(forest_loops)} forest outlines, {len(dots)} trees, {len(street)} street parts, rows {counts}, scale {S:.3f} px/m")
