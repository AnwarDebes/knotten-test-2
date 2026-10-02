"""Power lines and their masts from NVE's grid map (Nettanlegg 4, open data, NLOD), out to 5 km round
the site: cached in source/twin/nve/.

  0 Transmisjonsnett luftledning   transmission lines (overhead)
  1 Regionalnett luftledning       regional lines (overhead)
  2 Distribusjonsnett              distribution lines (high voltage, overhead and cable)
  4 Master og stolper              masts and poles
  5 Transformatorstasjoner         substations

Run: python pipeline/twin_nve.py
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request

import numpy as np

import twin_common as tc

BASE = "https://kart.nve.no/enterprise/rest/services/Nettanlegg4/FeatureServer"
LAYERS = {0: "transmission", 1: "regional", 2: "distribution", 4: "masts", 5: "substations"}
HALF = 5300.0


def envelope():
    s = np.linspace(-HALF, HALF, 21)
    edge = np.concatenate([np.stack([s, np.full_like(s, -HALF)], 1), np.stack([s, np.full_like(s, HALF)], 1),
                           np.stack([np.full_like(s, -HALF), s], 1), np.stack([np.full_like(s, HALF), s], 1)])
    e, n = tc.true_to_utm(edge[:, 0], edge[:, 1])
    return float(e.min()), float(n.min()), float(e.max()), float(n.max())


def query(layer, env):
    out, offset = [], 0
    while True:
        params = {"where": "1=1", "geometry": ",".join(f"{v:.1f}" for v in env), "geometryType": "esriGeometryEnvelope",
                  "inSR": "25832", "outSR": "25832", "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
                  "returnGeometry": "true", "resultOffset": str(offset), "resultRecordCount": "1000", "f": "json"}
        url = f"{BASE}/{layer}/query?" + urllib.parse.urlencode(params)
        for k in range(5):
            try:
                req = urllib.request.Request(url, headers=tc.UA)
                with urllib.request.urlopen(req, timeout=180, context=tc._CTX) as r:
                    js = json.loads(r.read())
                break
            except Exception as exc:
                if k == 4:
                    raise
                print(f"    {exc}; retrying")
                time.sleep(5 * (k + 1))
        if "error" in js:
            raise RuntimeError(js["error"])
        feats = js.get("features", [])
        out.extend(feats)
        if not js.get("exceededTransferLimit") or not feats:
            return out
        offset += len(feats)


def main():
    dst = tc.CACHE / "nve"
    dst.mkdir(parents=True, exist_ok=True)
    env = envelope()
    for layer, name in LAYERS.items():
        p = dst / f"{name}.json"
        if not p.exists():
            p.write_text(json.dumps(query(layer, env), ensure_ascii=False), encoding="utf-8")
        feats = json.loads(p.read_text(encoding="utf-8"))
        keys = sorted({k for f in feats for k in f.get("attributes", {})})
        print(f"  {layer} {name}: {len(feats)} features; fields {keys[:14]}")
    (dst / "_source.json").write_text(json.dumps({"source": "NVE, Nettanlegg 4 (kart.nve.no)", "licence": "NLOD", "envelope_utm32": env, "fetched": time.strftime("%Y-%m-%d")}, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
