"""Place names for the twin's labels (site/public/twin/names.json), from Kartverket's official register
(Sentralt stedsnavnregister: the names within 5 km fetched by twin_fetch.py, the farther ones looked up
here), plus the project's own two buildings. Every name is the register's preferred spelling.

Near views (tier 1), a curated set so the model reads like the owner's own maps: the hills round the
field, the river, the villages and the roads by the field.

Wide views (tier 2):
  the curated far names (the fjord, Snig, Vigeland, Nodøy, Valle kirke);
  every village, hamlet and settlement in the register within 5 km (tettsted, tettbebyggelse, bygdelag,
    grend);
  the fjords within 5 km, and the lakes within 5 km whose water in the twin covers at least 0.1 km²,
    each lake labelled at its open water farthest from the shore (the register's point for a lake is
    often at one end of it);
  the hills within 5 km that rise at least 150 m, the highest first, none within 1.5 km of a higher one
    already taken, eight at most, each labelled on its top;
  farther landmarks in the 20 km ring: Spangereid, Lenefjorden, Mandal and Lindesnes fyr (the register's
    lighthouse station "Lindesnes").
The browser hides a name while the ground stands between it and the camera (TwinLabels.tsx).

Positions are scene metres as the rings have them: the scene frame within the 1.3 km square, the true
frame beyond, bent by the earth's curvature (twin_common.py).
Run after twin_fetch.py, twin_terrain.py and twin_buildings.py: python pipeline/twin_names.py
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

import twin_common as tc

PICK = [  # (official name, register type, label kind, tier: 1 near views, 2 wide views)
    ("Knotten", "Høyde", "hill", 1), ("Løkkeheia", "Høyde", "hill", 1), ("Storhaugen", "Høyde", "hill", 1),
    ("Raudberg", "Bygdelag (bygd)", "place", 1), ("Gjedeland", "Bygdelag (bygd)", "place", 1),
    ("Rødbergsveien", "Adressenavn", "road", 1), ("Gjedelandsveien", "Adressenavn", "road", 1),
    ("Snigsfjorden", "Fjord", "water", 2), ("Snig", "Tettbebyggelse", "place", 2), ("Vigeland", "Tettsted", "place", 2),
    ("Mjåvann", "Vann", "water", 1), ("Nodøy", "Øy i sjø", "place", 2), ("Valle kirke", "Kirke", "place", 2),
]
FAR = [  # looked up by name: (name, register type, label kind, label)
    ("Spangereid", "Bygdelag (bygd)", "place", "Spangereid"), ("Lenefjorden", "Fjord", "water", "Lenefjorden"),
    ("Mandal", "By", "place", "Mandal"), ("Lindesnes", "Fyrstasjon", "place", "Lindesnes fyr"),
]
INNER = 1280.0
REACH = 5120.0
PLACES = {"Tettsted", "Tettbebyggelse", "Bygdelag (bygd)", "Grend"}
HILLS = {"Fjell", "Høyde", "Hei", "Ås", "Topp"}
HILL_MIN, HILL_GAP, HILL_MAX = 150.0, 1500.0, 8
LAKE_MIN_M2 = 0.1e6


def preferred(rec):
    """The register's preferred spelling of a name (the cached records list every approved one)."""
    sp = rec["stedsnavn"]
    best = next((s for s in sp if s.get("skrivemåtestatus") == "godkjent og prioritert"), sp[0])
    return best["skrivemåte"]


class Ground:
    def __init__(self):
        self.d1, self.d5, self.d20 = tc.UtmRaster.load("dtm1"), tc.UtmRaster.load("dtm5"), tc.UtmRaster.load("dtm20")

    def at(self, e, n):
        x, y = tc.utm_to_local(e, n)
        r = np.maximum(np.abs(np.asarray(x)), np.abs(np.asarray(y)))
        h = np.where(r < 1250, self.d1.sample_utm(e, n), np.where(r < 5150, self.d5.sample_utm(e, n), self.d20.sample_utm(e, n)))
        return np.where(np.isfinite(h), np.maximum(h, 0.0), 0.0)


def scene(e, n, z):
    """UTM and height to scene metres: the inner frame within 1.3 km, the true frame (bent) beyond."""
    x, y = (float(np.ravel(v)[0]) for v in tc.utm_to_local(np.array([e], float), np.array([n], float)))
    if abs(x) <= INNER and abs(y) <= INNER:
        return x, y, z
    x, y = (float(np.ravel(v)[0]) for v in tc.utm_to_true(np.array([e], float), np.array([n], float)))
    return x, y, z - float(tc.curvature_drop(x, y))


def t2u(x, y):
    e, n = tc.true_to_utm(np.array([x], float), np.array([y], float))
    return float(np.ravel(e)[0]), float(np.ravel(n)[0])


def top_near(ground, e, n, radius=80.0, step=5.0):
    """The highest ground within `radius` of a point: where a hill's name belongs."""
    s = np.arange(-radius, radius + step, step)
    de, dn = np.meshgrid(s, s)
    keep = de ** 2 + dn ** 2 <= radius ** 2
    E, N = e + de[keep], n + dn[keep]
    h = ground.at(E, N)
    i = int(np.argmax(h))
    return float(E[i]), float(N[i]), float(h[i])


class Water:
    """The twin's own water out to 5 km (the 5 km ring's mask, true frame): lakes, their size and middle."""
    def __init__(self, man):
        self.desc = next(r for r in man["rings"] if r["name"] == "r2")
        m = np.asarray(Image.open(tc.OUT / self.desc["files"]["mask"]).convert("RGB").getchannel("R")) > 127
        self.px = m.shape[0]
        self.texel = 2 * self.desc["tex_half"] / self.px
        self.lab, _ = ndi.label(m)
        self.inside = ndi.distance_transform_edt(m) * self.texel
        self.size = np.bincount(self.lab.ravel())

    def texel_of(self, x, y):
        th = self.desc["tex_half"]
        return int((th - y) / self.texel), int((x + th) / self.texel)

    def lake(self, x, y, snap=150.0):
        """The water body at (true-frame) x, y or the nearest within `snap` m: its area and its middle."""
        r, c = self.texel_of(x, y)
        k = int(snap / self.texel)
        win = self.lab[max(r - k, 0):r + k + 1, max(c - k, 0):c + k + 1]
        if not win.any():
            return None
        rr, cc = np.nonzero(win)
        j = int(np.argmin((rr + max(r - k, 0) - r) ** 2 + (cc + max(c - k, 0) - c) ** 2))
        comp = win[rr[j], cc[j]]
        area = float(self.size[comp]) * self.texel ** 2
        d = np.where(self.lab == comp, self.inside, -1.0)
        mr, mc = np.unravel_index(int(np.argmax(d)), d.shape)
        th = self.desc["tex_half"]
        return area, (mc + 0.5) * self.texel - th, th - (mr + 0.5) * self.texel, rr[j] + max(r - k, 0), cc[j] + max(c - k, 0)


def lookup(name, typ):
    """A name beyond the cached 5 km, from the register's search (in Lindesnes)."""
    url = "https://ws.geonorge.no/stedsnavn/v1/navn?" + urllib.parse.urlencode({"sok": name, "fuzzy": "false", "utkoordsys": "25832", "treffPerSide": "30", "side": "1"})
    js = json.loads(tc.fetch(url, name=f"ssr/navn_{name}.json", binary=False))
    for n in js.get("navn", []):
        if n.get("navneobjekttype") == typ and any(k.get("kommunenavn") == "Lindesnes" for k in n.get("kommuner", [])):
            rp = n["representasjonspunkt"]
            return n.get("skrivemåte"), rp["øst"], rp["nord"]
    return None


def main():
    names = json.load(open(tc.CACHE / "ssr_names.json", encoding="utf-8"))
    man = json.loads((tc.OUT / "twin.json").read_text(encoding="utf-8"))
    ground = Ground()
    water = Water(man)
    out, taken = [], set()

    def add(label, kind, tier, e, n, z=None, **extra):
        if z is None:
            z = float(ground.at(np.array([e]), np.array([n]))[0])
        x, y, zz = scene(e, n, z)
        out.append({"name": label, "kind": kind, "tier": tier, "x": round(x, 1), "y": round(y, 1), "z": round(zz, 1), **extra})
        taken.add(label)

    for nm, typ, kind, tier in PICK:
        hit = next((n for n in names if n["navneobjekttype"] == typ and any(s["skrivemåte"] == nm for s in n["stedsnavn"])), None)
        if not hit:
            print("  not found:", nm, typ)
            continue
        rp = hit["representasjonspunkt"]
        add(nm, kind, tier, rp["øst"], rp["nord"])
    # the river: the wide water right by the field is Mjaavann in the register; the label "Audna" goes on
    # the river itself, upstream to the north-east, at the nearest water to a point on its course
    dtm = ground.d1
    s = np.arange(500, 1250, 5.0)
    gx, gy = np.meshgrid(s, np.arange(400, 1250, 5.0))
    h = dtm.sample(gx, gy)
    wet = np.argwhere(h <= 0.003)
    if len(wet):
        d = (gx[wet[:, 0], wet[:, 1]] - 900) ** 2 + (gy[wet[:, 0], wet[:, 1]] - 800) ** 2
        i = int(np.argmin(d))
        out.append({"name": "Audna", "kind": "water", "tier": 1, "x": float(gx[tuple(wet[i])]), "y": float(gy[tuple(wet[i])]), "z": 0.0})
        taken.add("Audna")

    # the wide views: settlements, fjords and lakes, and the highest hills within 5 km
    cand = []
    for rec in names:
        typ = rec["navneobjekttype"]
        nm = preferred(rec)
        if nm in taken or " - " in nm:
            continue
        rp = rec["representasjonspunkt"]
        x, y = (float(np.ravel(v)[0]) for v in tc.utm_to_true(np.array([rp["øst"]], float), np.array([rp["nord"]], float)))
        if max(abs(x), abs(y)) > REACH - 30:
            continue
        cand.append((typ, nm, rp["øst"], rp["nord"], x, y))
    report = {"places": [], "fjords": [], "lakes": [], "hills": [], "far": []}
    for typ, nm, e, n, x, y in cand:
        if typ in PLACES:
            add(nm, "place", 2, e, n)
            report["places"].append(nm)
        elif typ == "Fjord":
            # on the water: the register's point, or the nearest water to it
            lk = water.lake(x, y, snap=400.0)
            if lk:
                r_, c_ = lk[3], lk[4]
                th = water.desc["tex_half"]
                ex, ny = (c_ + 0.5) * water.texel - th, th - (r_ + 0.5) * water.texel
                e, n = t2u(ex, ny)
            add(nm, "water", 2, e, n, z=0.0)
            report["fjords"].append(nm)
    lakes = []
    for typ, nm, e, n, x, y in cand:
        if typ == "Vann":
            lk = water.lake(x, y)
            if lk and lk[0] >= LAKE_MIN_M2:
                lakes.append((lk[0], nm, lk[1], lk[2]))
    seen_mid = set()
    for area, nm, mx, my in sorted(lakes, reverse=True):
        key = (round(mx), round(my))
        if key in seen_mid:          # two names for one water body: the larger name's entry wins
            continue
        seen_mid.add(key)
        e, n = t2u(mx, my)
        z = float(ground.at(np.array([e]), np.array([n]))[0])
        add(nm, "water", 2, e, n, z=z)
        report["lakes"].append(f"{nm} {area / 1e6:.2f} km2")
    hills = []
    for typ, nm, e, n, x, y in cand:
        if typ in HILLS:
            te, tn, th = top_near(ground, e, n)
            if th >= HILL_MIN:
                hills.append((th, nm, te, tn))
    kept = []
    for th, nm, te, tn in sorted(hills, reverse=True):
        if len(kept) >= HILL_MAX:
            break
        if any(np.hypot(te - k[2], tn - k[3]) < HILL_GAP for k in kept):
            continue
        kept.append((th, nm, te, tn))
        add(nm, "hill", 2, te, tn, z=th)
        report["hills"].append(f"{nm} {th:.0f} m")
    for nm, typ, kind, label in FAR:
        hit = lookup(nm, typ)
        if not hit:
            print("  not found:", nm, typ)
            continue
        _, e, n = hit
        z = 0.0 if kind == "water" else None
        add(label, kind, 2, e, n, z=z)
        report["far"].append(label)

    # the project's own buildings
    recs = json.load(open(tc.CACHE / "buildings.json", encoding="utf-8"))
    for pid, label in (("bld-office", "Kontorbygget"), ("bld-house", "Boligen")):
        r = next((q for q in recs if q.get("project") == pid), None)
        if r:
            out.append({"name": label, "kind": "project", "tier": 1, "x": r["x"], "y": r["y"], "z": round(r["ridge"], 1), "project": pid})
    (tc.OUT / "names.json").write_text(json.dumps({"source": "Kartverket, Sentralt stedsnavnregister (SSR); the project's buildings from the laser data",
                                                   "names": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"names.json: {len(out)} labels ({sum(1 for o in out if o['tier'] == 1)} near, {sum(1 for o in out if o['tier'] == 2)} wide)")
    for k, v in report.items():
        print(f"  {k}: {', '.join(v)}")


if __name__ == "__main__":
    main()
