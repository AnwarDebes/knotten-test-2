"""The road network and its furniture from Statens vegvesen's national road database (NVDB, API Les v4,
open data under NLOD 2.0), for the twin out to 5 km: cached in source/twin/nvdb/.

  vegnett.json   road links (segments) with their geometry (3D), type (road, footpath, pavement,
                 roundabout, ferry), detail level and road number (E39, Fv460, Kv..., private)
  583.json       Vegbredde (paved and carriageway width)
  241.json       Vegdekke (surface: asphalt types, gravel)
  836.json       Vegoppmerking, langsgaende (centre and edge lines)
  5.json         Rekkverk (guardrails)
  87.json        Belysningspunkt (street lights)
  60.json        Bru (bridges)
  67.json        Tunnellop (tunnels)

Run: python pipeline/twin_nvdb.py
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request

import numpy as np

import twin_common as tc

BASE = "https://nvdbapiles.atlas.vegvesen.no"
HEADERS = {**tc.UA, "X-Client": "knotten-twin", "Accept": "application/json"}
HALF = 5300.0
TYPES = {583: "Vegbredde", 241: "Vegdekke", 836: "Vegoppmerking, langsgaende", 5: "Rekkverk", 87: "Belysningspunkt", 60: "Bru", 67: "Tunnellop"}


def bbox():
    s = np.linspace(-HALF, HALF, 21)
    edge = np.concatenate([np.stack([s, np.full_like(s, -HALF)], 1), np.stack([s, np.full_like(s, HALF)], 1),
                           np.stack([np.full_like(s, -HALF), s], 1), np.stack([np.full_like(s, HALF), s], 1)])
    lat, lon = tc.true_to_geo(edge[:, 0], edge[:, 1])
    return f"{lon.min():.6f},{lat.min():.6f},{lon.max():.6f},{lat.max():.6f}"


def get(url):
    for k in range(5):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=180, context=tc._CTX) as r:
                return json.loads(r.read())
        except Exception as exc:
            if k == 4:
                raise
            print(f"    {exc}; retrying")
            time.sleep(5 * (k + 1))


def paged(path, **params):
    out, url = [], BASE + path + "?" + urllib.parse.urlencode(params)
    while url:
        js = get(url)
        objs = js.get("objekter", [])
        out.extend(objs)
        meta = js.get("metadata", {})
        nxt = (meta.get("neste") or {}).get("href")
        if not objs or meta.get("returnert", len(objs)) < int(params.get("antall", 1000)) or not nxt:
            break
        url = nxt
    return out


def main():
    dst = tc.CACHE / "nvdb"
    dst.mkdir(parents=True, exist_ok=True)
    bb = bbox()
    print(f"NVDB bbox (lon/lat): {bb}")
    path = dst / "vegnett.json"
    if not path.exists():
        segs = paged("/vegnett/api/v4/veglenkesekvenser/segmentert", kartutsnitt=bb, srid=4326, antall=1000)
        path.write_text(json.dumps(segs, ensure_ascii=False), encoding="utf-8")
    segs = json.loads(path.read_text(encoding="utf-8"))
    print(f"  vegnett: {len(segs)} segments")
    for t, name in TYPES.items():
        p = dst / f"{t}.json"
        if not p.exists():
            objs = paged(f"/vegobjekter/api/v4/vegobjekter/{t}", kartutsnitt=bb, srid=4326, antall=1000, inkluder="alle")
            p.write_text(json.dumps(objs, ensure_ascii=False), encoding="utf-8")
        objs = json.loads(p.read_text(encoding="utf-8"))
        print(f"  {t} {name}: {len(objs)} objects")
    (dst / "_source.json").write_text(json.dumps({"source": "Statens vegvesen, Nasjonal vegdatabank (NVDB), API Les v4", "licence": "NLOD 2.0", "bbox": bb, "fetched": time.strftime("%Y-%m-%d")}, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
