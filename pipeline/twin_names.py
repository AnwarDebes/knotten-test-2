"""Place names for the twin's labels (site/public/twin/names.json), from Kartverket's official register
(Sentralt stedsnavnregister, fetched by twin_fetch.py), plus the project's own two buildings.

A curated set, nearest and best known first, so the model reads like the owner's own maps: the hills
round the field, the river, the fjord, the villages and the roads by the field.
Run after twin_fetch.py and twin_buildings.py: python pipeline/twin_names.py
"""
from __future__ import annotations

import json

import numpy as np

import twin_common as tc

PICK = [  # (official name, register type, label kind, tier: 1 near views, 2 wide views)
    ("Knotten", "Høyde", "hill", 1), ("Løkkeheia", "Høyde", "hill", 1), ("Storhaugen", "Høyde", "hill", 1),
    ("Raudberg", "Bygdelag (bygd)", "place", 1), ("Gjedeland", "Bygdelag (bygd)", "place", 1),
    ("Rødbergsveien", "Adressenavn", "road", 1), ("Gjedelandsveien", "Adressenavn", "road", 1),
    ("Snigsfjorden", "Fjord", "water", 2), ("Snig", "Tettbebyggelse", "place", 2), ("Vigeland", "Tettsted", "place", 2),
    ("Mjåvann", "Vann", "water", 1), ("Nodøy", "Øy i sjø", "place", 2), ("Valle kirke", "Kirke", "place", 2),
]


def main():
    names = json.load(open(tc.CACHE / "ssr_names.json", encoding="utf-8"))
    dtm = tc.UtmRaster.load("dtm1")
    dtm5 = tc.UtmRaster.load("dtm5")
    out = []
    for nm, typ, kind, tier in PICK:
        hit = next((n for n in names if n["navneobjekttype"] == typ and any(s["skrivemåte"] == nm for s in n["stedsnavn"])), None)
        if not hit:
            print("  not found:", nm, typ)
            continue
        rp = hit["representasjonspunkt"]
        x, y = tc.utm_to_local(rp["øst"], rp["nord"])
        x, y = float(x), float(y)
        ras = dtm if abs(x) < 1250 and abs(y) < 1250 else dtm5
        out.append({"name": nm, "kind": kind, "tier": tier, "x": round(x, 1), "y": round(y, 1), "z": round(float(ras.sample(x, y)), 1)})
    # the river: the wide water right by the field is Mjaavann in the register; the label "Audna" goes on
    # the river itself, upstream to the north-east, at the nearest water to a point on its course
    s = np.arange(500, 1250, 5.0)
    gx, gy = np.meshgrid(s, np.arange(400, 1250, 5.0))
    h = dtm.sample(gx, gy)
    wet = np.argwhere(h <= 0.003)
    if len(wet):
        d = (gx[wet[:, 0], wet[:, 1]] - 900) ** 2 + (gy[wet[:, 0], wet[:, 1]] - 800) ** 2
        i = int(np.argmin(d))
        out.append({"name": "Audna", "kind": "water", "tier": 1, "x": float(gx[tuple(wet[i])]), "y": float(gy[tuple(wet[i])]), "z": 0.0})
    # the project's own buildings
    recs = json.load(open(tc.CACHE / "buildings.json", encoding="utf-8"))
    for pid, label in (("bld-office", "Kontorbygget"), ("bld-house", "Boligen")):
        r = next((q for q in recs if q.get("project") == pid), None)
        if r:
            out.append({"name": label, "kind": "project", "tier": 1, "x": r["x"], "y": r["y"], "z": round(r["ridge"], 1), "project": pid})
    (tc.OUT / "names.json").write_text(json.dumps({"source": "Kartverket, Sentralt stedsnavnregister (SSR); the project's buildings from the laser data", "names": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"names.json: {len(out)} labels:", ", ".join(f"{o['name']} ({o['x']:.0f}, {o['y']:.0f})" for o in out))


if __name__ == "__main__":
    main()
