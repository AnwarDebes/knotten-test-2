"""Open datasets from Kartverket and others through Geonorge's download API (no login), cached in
source/twin/geonorge/<name>/ (git-ignored).

  matrikkel_bygg   Matrikkelen - Bygningspunkt: every registered building, its type code and status
  sjokart          Sjøkart - Dybdedata: the nautical chart's depth areas (0-2 m, 2-5 m, ...), depth contours,
                   soundings, shoals, quays and breakwaters (Lindesnes, and Lyngdal for the fjords in the
                   20 km ring)

Each municipality is ordered once; a code whose file is already in the folder is not ordered again.

Licences: Kartverket open data, CC BY 4.0 (stated in each dataset's metadata on Geonorge).
Run: python pipeline/twin_geonorge.py [name ...]
"""
from __future__ import annotations

import io
import json
import sys
import time
import urllib.request
import zipfile

import twin_common as tc

API = "https://nedlasting.geonorge.no/api"
DATASETS = {
    "matrikkel_bygg": ("24d7e9d1-87f6-45a0-b38e-3447f8d7f9a1", ["4205", "4225"], "kommune", "GML"),
    "sjokart": ("2751aacf-5472-4850-a208-3532a51c529a", ["4205", "4225"], "kommune", "GML"),
}


def get(url):
    req = urllib.request.Request(url, headers={**tc.UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120, context=tc._CTX) as r:
        return json.loads(r.read())


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={**tc.UA, "Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=300, context=tc._CTX) as r:
        return json.loads(r.read())


def options(uuid):
    return get(f"{API}/codelists/area/{uuid}")


def order(name):
    uuid, codes, kind, fmt = DATASETS[name]
    out = tc.CACHE / "geonorge" / name
    out.mkdir(parents=True, exist_ok=True)
    have = [p.name for p in out.iterdir() if p.suffix != ".json"]
    todo = [c for c in codes if not any(f"_{c}_" in h for h in have)]
    if not todo:
        print(f"  {name}: cached ({len(have)} files)")
        return out
    areas = options(uuid)
    pick = [a for a in areas if a["type"] == kind and a["code"] in todo]
    if len(pick) < len(todo):
        raise RuntimeError(f"{name}: not all of {todo} offered")
    lines = []
    for a in pick:
        projs = [p for p in a["projections"] if p["code"] == "25832"] or a["projections"][:1]
        fmts = [f for f in a["formats"] if fmt is None or f["name"] == fmt] or a["formats"][:1]
        lines.append({"metadataUuid": uuid, "areas": [{"code": a["code"], "type": a["type"], "name": a["name"]}],
                      "projections": [{"code": projs[0]["code"], "name": projs[0].get("name", ""), "codespace": projs[0].get("codespace", "")}],
                      "formats": [{"name": fmts[0]["name"]}]})
        print(f"  {name}: ordering {a['type']} {a['code']} {a['name']} as {fmts[0]['name']} in {projs[0]['code']}")
    res = post(f"{API}/order", {"email": "", "orderLines": lines})
    ref = res.get("referenceNumber")
    files = res.get("files", [])
    for _ in range(90):
        if files and all(f.get("status") == "ReadyForDownload" for f in files):
            break
        time.sleep(10)
        files = get(f"{API}/order/{ref}").get("files", [])
    log = out / "_order.json"
    orders = json.loads(log.read_text(encoding="utf-8")) if log.exists() else []
    if isinstance(orders, dict):
        orders = [orders]
    meta = []
    for f in files:
        if f.get("status") != "ReadyForDownload":
            raise RuntimeError(f"{name}: {f.get('name')} {f.get('status')}")
        raw = tc.fetch(f["downloadUrl"], name=f"geonorge/{name}_{f['name']}", timeout=900)
        if raw[:2] == b"PK":
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                z.extractall(out)
        else:
            (out / f["name"]).write_bytes(raw)
        meta.append({"file": f["name"], "url": f["downloadUrl"]})
    orders.append({"dataset": name, "uuid": uuid, "reference": ref, "files": meta})
    log.write_text(json.dumps(orders, indent=1), encoding="utf-8")
    print(f"  {name}: {len(meta)} files -> {out}")
    return out


if __name__ == "__main__":
    names = sys.argv[1:] or list(DATASETS)
    for n in names:
        order(n)
