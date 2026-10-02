"""The overhead power lines out to 5 km from NVE's grid map (twin_nve.py): every 22-24 kV distribution
line and 110 kV regional line, mast to mast, with each mast at its recorded point and of its recorded
height (NVE's mastehoyde; 10 m for a distribution pole and 16 m for a regional mast where none is
recorded). The mast types are not in the data: a distribution pole is drawn as the usual wooden pole
with a crossarm for the three phases, a 110 kV mast as the usual wooden H-frame. The wires hang between
the masts with a sag of 1.2 % (22 kV) or 2 % (110 kV) of the span. Low-voltage lines to the houses are
not in NVE's map and are not drawn.

Output: site/public/twin/power.json (scene metres: the inner frame within 1.3 km, the true frame
beyond, bent by the curvature)
Run after twin_nve.py and twin_fetch.py: python pipeline/twin_power.py
"""
from __future__ import annotations

import json

import numpy as np
from scipy.spatial import cKDTree

import twin_common as tc

D = tc.CACHE / "nve"
INNER = 1280.0
DEFAULT_H = {"distribution": 10.0, "regional": 16.0}
SAG = {"distribution": 0.012, "regional": 0.02}


class Ground:
    def __init__(self):
        self.d1, self.d5, self.d20 = tc.UtmRaster.load("dtm1"), tc.UtmRaster.load("dtm5"), tc.UtmRaster.load("dtm20")

    def at(self, e, n):
        x, y = tc.utm_to_local(e, n)
        r = np.maximum(np.abs(x), np.abs(y))
        h = np.where(r < 1250, self.d1.sample_utm(e, n), np.where(r < 5150, self.d5.sample_utm(e, n), self.d20.sample_utm(e, n)))
        return np.where(np.isfinite(h), np.maximum(h, 0.0), 0.0)


def scene(e, n, z):
    """UTM to scene metres: the inner frame within 1.3 km, the true frame (bent) beyond."""
    e, n, z = np.atleast_1d(e).astype(float), np.atleast_1d(n).astype(float), np.atleast_1d(z).astype(float)
    x, y = tc.utm_to_local(e, n)
    x, y = np.array(x), np.array(y)
    out = (np.abs(x) > INNER) | (np.abs(y) > INNER)
    if out.any():
        xt, yt = tc.utm_to_true(e[out], n[out])
        x[out], y[out] = xt, yt
        z = z.copy()
        z[out] -= tc.curvature_drop(xt, yt)
    return x, y, z


def main():
    masts = json.loads((D / "masts.json").read_text(encoding="utf-8"))
    M = np.array([[f["geometry"]["x"], f["geometry"]["y"]] for f in masts])
    H = np.array([f["attributes"].get("mastehoyde_m") or np.nan for f in masts], float)
    tree = cKDTree(M)
    ground = Ground()
    poles, lines = [], []
    seen = set()
    for name in ("distribution", "regional"):
        for f in json.loads((D / f"{name}.json").read_text(encoding="utf-8")):
            a = f["attributes"]
            if a.get("objekttype") != "EL_Luftlinje":
                continue
            for path in f["geometry"]["paths"]:
                P = np.array(path, float)
                # keep the line's own points (each a mast); masts recorded off the line are not used
                d, k = tree.query(P)
                h = np.where((d < 1.0) & np.isfinite(H[k]), H[k], DEFAULT_H[name])
                g = ground.at(P[:, 0], P[:, 1])
                top = g + h
                x, y, zt = scene(P[:, 0], P[:, 1], top - 0.35)
                _, _, zg = scene(P[:, 0], P[:, 1], g)
                lines.append({"kind": name, "kv": a.get("spenning_kv"), "sag": SAG[name],
                              "p": [[round(float(x[i]), 2), round(float(y[i]), 2), round(float(zt[i]), 2)] for i in range(len(P))]})
                for i in range(len(P)):
                    key = (round(P[i, 0], 1), round(P[i, 1], 1))
                    if key in seen:
                        continue
                    seen.add(key)
                    # the crossarm across the line: the mean direction of the spans either side
                    j0, j1 = max(0, i - 1), min(len(P) - 1, i + 1)
                    dx, dy = x[j1] - x[j0], y[j1] - y[j0]
                    ang = float(np.arctan2(dy, dx))
                    poles.append([round(float(x[i]), 2), round(float(y[i]), 2), round(float(zg[i]), 2), round(float(h[i]), 1), 1 if name == "regional" else 0, round(ang, 3)])
    out = {"source": "NVE Nettanlegg 4 (lines, masts and their heights; NLOD); ground Kartverket NHM DTM",
           "note": "poles: x, y, ground z, height, kind (0 distribution pole, 1 regional H-frame), heading of the line (radians from east); "
                   "lines: points at the wire attachment (top less 0.35 m), sag as a share of each span. Mast types and sag are the usual ones, not in NVE's data.",
           "poles": poles, "lines": lines}
    path = tc.OUT / "power.json"
    path.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    kinds = {k: sum(1 for p in poles if p[4] == k) for k in (0, 1)}
    print(f"power.json: {len(lines)} overhead lines, {len(poles)} masts ({kinds[0]} distribution, {kinds[1]} regional), {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
