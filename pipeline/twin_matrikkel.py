"""Every registered building near the site from Matrikkelen - Bygningspunkt (Kartverket, open data):
its position, NS 3457 building type, status and heritage flags, in scene coordinates.

Output: source/twin/matrikkel_buildings.json (used by twin_world_buildings.py and twin_names.py)
Run after twin_geonorge.py: python pipeline/twin_matrikkel.py
"""
from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from collections import Counter

import numpy as np

import twin_common as tc

NS = {"gml": "http://www.opengis.net/gml/3.2", "app": "http://skjema.geonorge.no/SOSI/produktspesifikasjon/Matrikkelen-Bygningspunkt/20211101"}
HALF = 12000.0

# NS 3457-3 building types (the groups the twin draws differently); the full code is kept as well
GROUPS = [
    ((111, 113), "house"), ((121, 136), "house"), ((141, 159), "house"), ((161, 163), "cabin"),
    ((171, 172), "house"), ((181, 182), "garage"), ((183, 183), "boathouse"), ((193, 199), "garage"),
    ((211, 219), "industry"), ((221, 229), "industry"), ((231, 239), "industry"), ((241, 249), "farm"),
    ((311, 329), "commercial"), ((330, 349), "commercial"), ((411, 449), "transport"), ((511, 529), "commercial"),
    ((611, 619), "school"), ((621, 629), "commercial"), ((641, 649), "commercial"), ((651, 659), "commercial"),
    ((661, 669), "commercial"), ((671, 679), "church"), ((719, 739), "health"), ((811, 830), "civic"), ((840, 840), "commercial"),
]
STATUS = {"TB": "in use", "MB": "completed (ferdigattest)", "FA": "completed (ferdigattest)", "MT": "temporary use permit",
          "IG": "start permit", "RA": "framework permit", "GR": "demolished", "BF": "removed", "BR": "burnt", "BU": "removed (other)",
          "IP": "planned", "MF": "notified"}


def group(code):
    for (a, b), g in GROUPS:
        if a <= code <= b:
            return g
    return "other"


def parse(path):
    out = []
    for _, el in ET.iterparse(path, events=("end",)):
        if el.tag != f"{{{NS['app']}}}Bygning":
            continue
        pos = el.find("app:representasjonspunkt/gml:Point/gml:pos", NS)
        if pos is None:
            el.clear()
            continue
        e, n = map(float, pos.text.split()[:2])
        code = int(el.findtext("app:bygningstype", "0", NS) or 0)
        out.append({
            "nr": el.findtext("app:bygningsnummer", "", NS),
            "e": e, "n": n, "type": code, "group": group(code),
            "status": el.findtext("app:bygningsstatus", "", NS),
            "kulturminne": el.findtext("app:harKulturminne", "false", NS) == "true",
            "sefrak": el.findtext("app:harSefrakminne", "false", NS) == "true",
            "verified": el.findtext("app:stedfestingVerifisert", "false", NS) == "true",
            "units": len(el.findall("app:bruksenhet", NS)),
        })
        el.clear()
    return out


def main():
    rows = []
    for f in sorted((tc.CACHE / "geonorge" / "matrikkel_bygg").glob("*.gml")):
        part = parse(f)
        print(f"  {f.name}: {len(part)} buildings")
        rows += part
    e = np.array([r["e"] for r in rows])
    n = np.array([r["n"] for r in rows])
    x, y = tc.utm_to_local(e, n)
    keep = []
    for r, xx, yy in zip(rows, x, y):
        if abs(xx) <= HALF and abs(yy) <= HALF and r["status"] not in ("GR", "BF", "BR", "BU"):
            r["x"], r["y"] = round(float(xx), 2), round(float(yy), 2)
            keep.append(r)
    keep.sort(key=lambda r: r["x"] ** 2 + r["y"] ** 2)
    print(f"within +-{HALF / 1000:.0f} km: {len(keep)} standing or planned buildings")
    print("  groups:", Counter(r["group"] for r in keep).most_common())
    print("  status:", Counter(r["status"] for r in keep).most_common())
    print("  heritage: kulturminne", sum(r["kulturminne"] for r in keep), "sefrak", sum(r["sefrak"] for r in keep))
    for ring in (1280, 5120, 12000):
        print(f"  within +-{ring} m: {sum(abs(r['x']) <= ring and abs(r['y']) <= ring for r in keep)}")
    churches = [r for r in keep if r["group"] == "church"]
    print("  churches:", [(r["type"], r["x"], r["y"], r["status"]) for r in churches])
    (tc.CACHE / "matrikkel_buildings.json").write_text(json.dumps({"source": "Kartverket, Matrikkelen - Bygningspunkt (open data, CC BY 4.0)", "buildings": keep}, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
