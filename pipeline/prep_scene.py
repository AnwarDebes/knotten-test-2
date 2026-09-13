"""Turn the raw OSM dump into local-metre geometry ready for Blender."""
from __future__ import annotations

import json
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent
meta = json.loads((OUT / "area_meta.json").read_text(encoding="utf-8"))
osm = json.loads((OUT / "osm_raw.json").read_text(encoding="utf-8"))

LAT = meta["center"]["lat"]
LON = meta["center"]["lon"]
M_LAT = meta["m_per_deg"]["lat"]
M_LON = meta["m_per_deg"]["lon"]
HALF = meta["size_m"][0] / 2.0
PAD = 60.0  # keep features slightly outside the tile so edges stay populated


def to_m(lat, lon):
    return ((lon - LON) * M_LON, (lat - LAT) * M_LAT)


def geom_m(el):
    return [to_m(p["lat"], p["lon"]) for p in el.get("geometry", [])]


def in_tile(pts, pad=PAD):
    return any(-HALF - pad <= x <= HALF + pad and -HALF - pad <= y <= HALF + pad
               for x, y in pts)


def close_ring(pts):
    if len(pts) > 2 and pts[0] == pts[-1]:
        return pts[:-1]
    return pts


def area2(ring):
    s = 0.0
    for i, (x, y) in enumerate(ring):
        x2, y2 = ring[(i + 1) % len(ring)]
        s += x * y2 - x2 * y
    return s / 2.0


def convex_hull(points):
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def min_area_rect(ring):
    """Rotating-calipers oriented bounding box -> (cx, cy, w, d, angle)."""
    hull = convex_hull(ring)
    if len(hull) < 3:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2,
                max(max(xs) - min(xs), 1.0), max(max(ys) - min(ys), 1.0), 0.0)
    best = None
    for i in range(len(hull)):
        x1, y1 = hull[i]
        x2, y2 = hull[(i + 1) % len(hull)]
        ang = math.atan2(y2 - y1, x2 - x1)
        ca, sa = math.cos(-ang), math.sin(-ang)
        xs = [p[0] * ca - p[1] * sa for p in hull]
        ys = [p[0] * sa + p[1] * ca for p in hull]
        w, d = max(xs) - min(xs), max(ys) - min(ys)
        if best is None or w * d < best[0]:
            cx_r, cy_r = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            ca2, sa2 = math.cos(ang), math.sin(ang)
            best = (w * d, cx_r * ca2 - cy_r * sa2, cx_r * sa2 + cy_r * ca2, w, d, ang)
    _, cx, cy, w, d, ang = best
    if w < d:  # keep the ridge along the long axis
        w, d = d, w
        ang += math.pi / 2
    return (cx, cy, w, d, ang)


HEIGHTS = {"house": 6.4, "detached": 6.4, "residential": 6.8, "barn": 9.0, "farm": 8.0,
           "farm_auxiliary": 5.4, "garage": 3.0, "garages": 3.2, "shed": 2.8,
           "greenhouse": 3.4, "civic": 7.0, "kindergarten": 5.0, "commercial": 7.0,
           "industrial": 8.0, "cabin": 4.2, "hut": 3.0, "service": 3.0, "yes": 6.0,
           "roof": 3.5, "carport": 3.0, "silo": 12.0}
ROOF_PITCH = {"garage": 1.4, "garages": 1.4, "shed": 1.0, "greenhouse": 1.2,
              "carport": 0.6, "roof": 0.6, "silo": 0.0}


def building_height(tags):
    if "height" in tags:
        try:
            return float(str(tags["height"]).split()[0])
        except ValueError:
            pass
    if "building:levels" in tags:
        try:
            return float(tags["building:levels"]) * 3.1 + 0.6
        except ValueError:
            pass
    return HEIGHTS.get(tags.get("building", "yes"), 6.0)


def rings_from_relation(el):
    """Assemble multipolygon outer rings from member ways with geometry."""
    outers = []
    frags = []
    for m in el.get("members", []):
        if m.get("type") != "way" or "geometry" not in m:
            continue
        pts = [to_m(p["lat"], p["lon"]) for p in m["geometry"]]
        if m.get("role") not in ("outer", ""):
            continue
        if len(pts) > 2 and pts[0] == pts[-1]:
            outers.append(pts[:-1])
        else:
            frags.append(pts)
    # stitch open fragments end-to-end
    while frags:
        chain = frags.pop(0)
        changed = True
        while changed and chain[0] != chain[-1]:
            changed = False
            for i, f in enumerate(frags):
                if dist(chain[-1], f[0]) < 0.5:
                    chain += f[1:]; frags.pop(i); changed = True; break
                if dist(chain[-1], f[-1]) < 0.5:
                    chain += list(reversed(f))[1:]; frags.pop(i); changed = True; break
                if dist(chain[0], f[-1]) < 0.5:
                    chain = f[:-1] + chain; frags.pop(i); changed = True; break
                if dist(chain[0], f[0]) < 0.5:
                    chain = list(reversed(f))[:-1] + chain; frags.pop(i); changed = True; break
        if len(chain) > 3:
            outers.append(close_ring(chain))
    return outers


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


buildings, forests, water, wetland, farmland, roads, streams, powerlines = [], [], [], [], [], [], [], []
places = []

for el in osm.get("elements", []):
    tags = el.get("tags", {})
    if not tags:
        continue
    etype = el.get("type")

    if etype == "node":
        x, y = to_m(el["lat"], el["lon"])
        if abs(x) <= HALF + PAD and abs(y) <= HALF + PAD:
            places.append({"name": tags.get("name", ""), "tags": tags, "xy": [x, y]})
        continue

    if etype == "way":
        pts = geom_m(el)
        if not pts or not in_tile(pts):
            continue
        if "building" in tags:
            ring = close_ring(pts)
            if len(ring) < 3:
                continue
            if area2(ring) < 0:
                ring = list(reversed(ring))
            btype = tags.get("building", "yes")
            cx, cy, w, d, ang = min_area_rect(ring)
            buildings.append({
                "type": btype, "name": tags.get("name", ""),
                "ring": ring, "height": building_height(tags),
                "pitch": ROOF_PITCH.get(btype, 2.6),
                "obb": [cx, cy, w, d, ang],
            })
        elif tags.get("natural") in ("wood", "scrub") or tags.get("landuse") == "forest":
            forests.append(close_ring(pts))
        elif tags.get("natural") == "water" or tags.get("landuse") == "reservoir":
            water.append(close_ring(pts))
        elif tags.get("natural") == "wetland":
            wetland.append(close_ring(pts))
        elif tags.get("landuse") in ("farmland", "meadow", "orchard", "grass"):
            farmland.append(close_ring(pts))
        elif "highway" in tags:
            roads.append({"type": tags["highway"], "name": tags.get("name", ""), "pts": pts})
        elif "waterway" in tags:
            streams.append({"type": tags["waterway"], "name": tags.get("name", ""), "pts": pts})
        elif tags.get("power") == "line":
            powerlines.append(pts)
        continue

    if etype == "relation":
        rings = [r for r in rings_from_relation(el) if len(r) > 2 and in_tile(r)]
        if not rings:
            continue
        nat, lu = tags.get("natural"), tags.get("landuse")
        if nat == "water" or lu == "reservoir":
            water.extend(rings)
        elif nat in ("wood", "scrub") or lu == "forest":
            forests.extend(rings)
        elif nat == "wetland":
            wetland.extend(rings)
        elif lu in ("farmland", "meadow", "grass"):
            farmland.extend(rings)

scene = {
    "half_m": HALF,
    "center": {"lat": LAT, "lon": LON},
    "buildings": buildings,
    "forests": forests,
    "water": water,
    "wetland": wetland,
    "farmland": farmland,
    "roads": roads,
    "streams": streams,
    "powerlines": powerlines,
    "places": places,
}
(OUT / "scene_data.json").write_text(json.dumps(scene), encoding="utf-8")

print("buildings", len(buildings))
print("forest rings", len(forests), "water rings", len(water),
      "wetland", len(wetland), "farmland", len(farmland))
print("roads", len(roads), "streams", len(streams), "powerlines", len(powerlines))
print("named nodes", [p["name"] for p in places if p["name"]])
print("water ring sizes", sorted((len(r) for r in water), reverse=True)[:6])
