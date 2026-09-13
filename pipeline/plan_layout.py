"""Provisional Knotten layout + per-plot evidence (sun hours, sea view, grades).

The layout follows the structure of Sigve's sketch - terraced rows along the
contours of the south-facing slope, an access loop from Rødbergsveien, max 6 % road
grade - but it is NOT the georeferenced plan. Every plot is placed on measured
terrain, and every number is computed from the 1 m LiDAR, so the analysis is real
even though the exact house positions are placeholders until the plan file arrives.

Outputs (in ../knotten/data):
  plots.json      one record per plot with position, terrain, sun and view metrics
  road.json       centreline with per-segment grade, flagged where > 6 %
  clearing.json   polygon the development clears (drives the before/after toggle)
"""
from __future__ import annotations

import array
import json
import math
from pathlib import Path

SC = Path(__file__).resolve().parent
OUT = Path(r"C:/Users/anwar/Downloads/knotten/data")
OUT.mkdir(parents=True, exist_ok=True)

meta = json.loads((SC / "area_meta.json").read_text(encoding="utf-8"))
tinfo = json.loads((SC / "kv_terrain.json").read_text(encoding="utf-8"))
sur = json.loads((SC / "surround_elevation.json").read_text(encoding="utf-8"))
hor = json.loads((SC / "horizon_elevation.json").read_text(encoding="utf-8"))
kv = json.loads((SC / "kv_meta.json").read_text(encoding="utf-8"))

LAT, LON = meta["center"]["lat"], meta["center"]["lon"]
M_LAT, M_LON = meta["m_per_deg"]["lat"], meta["m_per_deg"]["lon"]
RES, HALF, STEP = tinfo["res"], tinfo["half_m"], tinfo["step_m"]
DTM = array.array("f")
DTM.fromfile(open(SC / "kv_terrain.f32", "rb"), RES * RES)

# ------------------------------------------------------------- samplers
def grid_sampler(rows, half):
    h, w = len(rows), len(rows[0])
    dx, dy = 2 * half / (w - 1), 2 * half / (h - 1)

    def f(x, y):
        fx, fy = (x + half) / dx, (half - y) / dy
        if fx < 0 or fy < 0 or fx >= w - 1 or fy >= h - 1:
            return None
        i, j = int(fx), int(fy)
        tx, ty = fx - i, fy - j
        a = rows[j][i] + (rows[j][i + 1] - rows[j][i]) * tx
        b = rows[j + 1][i] + (rows[j + 1][i + 1] - rows[j + 1][i]) * tx
        return a + (b - a) * ty
    return f


sample_sur = grid_sampler(sur["rows_north_to_south"], sur["half_m"])
sample_hor = grid_sampler(hor["rows_north_to_south"], hor["half_m"])


def lidar(x, y):
    fx, fy = (x + HALF) / STEP, (HALF - y) / STEP
    if fx < 0 or fy < 0 or fx >= RES - 1 or fy >= RES - 1:
        return None
    i, j = int(fx), int(fy)
    tx, ty = fx - i, fy - j
    r0 = j * RES + i
    v = [max(0.0, DTM[r0]), max(0.0, DTM[r0 + 1]), max(0.0, DTM[r0 + RES]), max(0.0, DTM[r0 + RES + 1])]
    a = v[0] + (v[1] - v[0]) * tx
    b = v[2] + (v[3] - v[2]) * tx
    return a + (b - a) * ty


def elev(x, y):
    for f in (lidar, sample_sur, sample_hor):
        v = f(x, y)
        if v is not None:
            return max(v, 0.0)
    return 0.0


def slope_aspect(x, y, d=2.0):
    zx = (elev(x + d, y) - elev(x - d, y)) / (2 * d)
    zy = (elev(x, y + d) - elev(x, y - d)) / (2 * d)
    slope = math.degrees(math.atan(math.hypot(zx, zy)))
    aspect = (math.degrees(math.atan2(-zx, -zy)) + 360) % 360   # downhill direction, from N
    return slope, aspect


# UTM32 (same affine as prep_kartverket)
A_, F_ = 6378137.0, 1 / 298.257223563
E2 = F_ * (2 - F_)
EP2 = E2 / (1 - E2)


def to_utm32(lat_deg, lon_deg):
    phi, lam = math.radians(lat_deg), math.radians(lon_deg)
    sp, cp, tp = math.sin(phi), math.cos(phi), math.tan(phi)
    N = A_ / math.sqrt(1 - E2 * sp * sp)
    T, C = tp * tp, EP2 * cp * cp
    Aa = (lam - math.radians(9.0)) * cp
    M = A_ * ((1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256) * phi
              - (3 * E2 / 8 + 3 * E2**2 / 32 + 45 * E2**3 / 1024) * math.sin(2 * phi)
              + (15 * E2**2 / 256 + 45 * E2**3 / 1024) * math.sin(4 * phi)
              - (35 * E2**3 / 3072) * math.sin(6 * phi))
    east = 500000.0 + 0.9996 * N * (Aa + (1 - T + C) * Aa**3 / 6
                                    + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa**5 / 120)
    north = 0.9996 * (M + N * tp * (Aa**2 / 2 + (5 - T + 9 * C + 4 * C * C) * Aa**4 / 24
                                    + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa**6 / 720))
    return east, north


def georef(x, y):
    lat, lon = LAT + y / M_LAT, LON + x / M_LON
    e, n = to_utm32(lat, lon)
    return {"lat": round(lat, 7), "lon": round(lon, 7),
            "utm32_east": round(e, 2), "utm32_north": round(n, 2)}


# ------------------------------------------------------ contour tracing
def contour_polyline(level, x0, x1, y0, y1):
    """Longest contour polyline at `level` inside the box, ordered west->east."""
    segs = []
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            c = [(elev(x, y), (x, y)), (elev(x + 1, y), (x + 1, y)),
                 (elev(x + 1, y + 1), (x + 1, y + 1)), (elev(x, y + 1), (x, y + 1))]
            pts = []
            for k in range(4):
                z0, p0 = c[k]
                z1, p1 = c[(k + 1) % 4]
                if (z0 < level) != (z1 < level):
                    t = (level - z0) / (z1 - z0)
                    pts.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t))
            if len(pts) == 2:
                segs.append((pts[0], pts[1]))
    # chain segments
    from collections import defaultdict
    key = lambda p: (round(p[0], 3), round(p[1], 3))
    adj = defaultdict(list)
    for a, b in segs:
        adj[key(a)].append(key(b))
        adj[key(b)].append(key(a))
    seen = set()
    chains = []
    for start in adj:
        if start in seen or len(adj[start]) != 1:
            continue
        chain, cur, prev = [start], start, None
        seen.add(cur)
        while True:
            nxt = [n for n in adj[cur] if n != prev and n not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            seen.add(cur)
            chain.append(cur)
        chains.append(chain)
    if not chains:
        return []
    best = max(chains, key=len)
    if best[0][0] > best[-1][0]:
        best.reverse()
    return [(float(p[0]), float(p[1])) for p in best]


def resample(poly, spacing):
    if len(poly) < 2:
        return poly
    out = [poly[0]]
    acc = 0.0
    for (x0, y0), (x1, y1) in zip(poly, poly[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        while acc + seg >= spacing:
            t = (spacing - acc) / seg
            x0, y0 = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            out.append((x0, y0))
            seg = math.hypot(x1 - x0, y1 - y0)
            acc = 0.0
        acc += seg
    return out


# ----------------------------------------------------- the provisional plan
# Rows on contours of the knoll's south/south-east slope, west of Rødbergsveien.
SITE_X = (-140.0, 120.0)
SITE_Y = (-110.0, 110.0)
ROW_LEVELS = [78.0, 68.0, 58.0, 48.0]          # metres, top row first
HOUSE_SPACING = 22.0
HOUSE = {"w": 11.0, "d": 8.5, "eaves": 3.2, "ridge": 5.6}   # 1.5-storey Norwegian house

plots = []
row_roads = []
for r, level in enumerate(ROW_LEVELS):
    poly = contour_polyline(level, SITE_X[0], SITE_X[1], SITE_Y[0], SITE_Y[1])
    poly = [p for p in poly if SITE_X[0] <= p[0] <= SITE_X[1]]
    if len(poly) < 4:
        continue
    road_pts = resample(poly, 4.0)
    row_roads.append({"row": r + 1, "level": level, "pts": [(round(x, 2), round(y, 2)) for x, y in road_pts]})
    stations = resample(poly, HOUSE_SPACING)
    for k, (x, y) in enumerate(stations[1:-1]):
        # house sits 9 m downhill of the row road, facing downhill (the view)
        slope, aspect = slope_aspect(x, y)
        if slope > 28 or not (SITE_X[0] + 8 <= x <= SITE_X[1] - 8):
            continue
        ar = math.radians(aspect)
        hx, hy = x + 9.0 * math.sin(ar), y + 9.0 * math.cos(ar)
        s2, a2 = slope_aspect(hx, hy)
        plots.append({"row": r + 1, "x": hx, "y": hy, "facing_deg": a2, "slope_deg": s2})

plots = plots[:30]
for i, p in enumerate(plots):
    p["id"] = f"plot-{i + 1:02d}"

# ----------------------------------------------------- horizon + sun + view
EARTH_R = 6371000.0 * 1.17


def horizon_and_water(ox, oy, oz):
    """Per bearing 0..359: terrain horizon angle (deg) and farthest visible water (m)."""
    hz, water = [], []
    for b in range(360):
        br = math.radians(b)
        sx, sy = math.sin(br), math.cos(br)
        best = -math.inf
        far = 0.0
        d = 6.0
        while d <= 15000.0:
            z = elev(ox + sx * d, oy + sy * d)
            ang = math.atan2(z - d * d / (2 * EARTH_R) - oz, d)
            if ang >= best:
                best = ang
                if z <= 0.3 and d > 40:
                    far = d
            d += 6.0 if d < 600 else (25.0 if d < 3000 else 80.0)
        hz.append(round(math.degrees(best), 2))
        water.append(round(far))
    return hz, water


def solar(year, month, day, hour_utc, lat, lon):
    if month <= 2:
        year -= 1
        month += 12
    a = year // 100
    b = 2 - a + a // 4
    jd = math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + b - 1524.5 + hour_utc / 24
    t = (jd - 2451545.0) / 36525.0
    L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
    M = 357.52911 + t * (35999.05029 - 0.0001537 * t)
    e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    Mr = math.radians(M)
    C = (math.sin(Mr) * (1.914602 - t * (0.004817 + 0.000014 * t))
         + math.sin(2 * Mr) * (0.019993 - 0.000101 * t) + math.sin(3 * Mr) * 0.000289)
    omega = 125.04 - 1934.136 * t
    lam = math.radians(L0 + C - 0.00569 - 0.00478 * math.sin(math.radians(omega)))
    eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    eps = math.radians(eps0 + 0.00256 * math.cos(math.radians(omega)))
    decl = math.asin(math.sin(eps) * math.sin(lam))
    y = math.tan(eps / 2) ** 2
    L0r = math.radians(L0)
    eot = 4 * math.degrees(y * math.sin(2 * L0r) - 2 * e * math.sin(Mr)
                           + 4 * e * y * math.sin(Mr) * math.cos(2 * L0r)
                           - 0.5 * y * y * math.sin(4 * L0r) - 1.25 * e * e * math.sin(2 * Mr))
    tst = (hour_utc * 60 + eot + 4 * lon) % 1440
    ha = math.radians(tst / 4 - 180)
    latr = math.radians(lat)
    zen = math.acos(math.sin(latr) * math.sin(decl) + math.cos(latr) * math.cos(decl) * math.cos(ha))
    az = math.degrees(math.atan2(math.sin(ha), math.cos(ha) * math.sin(latr) - math.tan(decl) * math.cos(latr)))
    return 90 - math.degrees(zen), (az + 180.0) % 360.0


def sun_hours(hz, lat, lon, month, day):
    lit = 0
    possible = 0
    first = last = None
    for m in range(0, 1440, 5):
        el, az = solar(2026, month, day, m / 60.0, lat, lon)
        if el <= 0:
            continue
        possible += 5
        if el > hz[int(az) % 360] + 0.25:      # 0.25 deg = half a solar disc margin
            lit += 5
            local = (m / 60.0 + 1.0) % 24        # CET, winter/standard time for reporting
            first = local if first is None else first
            last = local
    return round(lit / 60, 2), round(possible / 60, 2), first, last


DATES = {"dec21": (12, 21), "mar21": (3, 21), "jun21": (6, 21)}
records = []
for p in plots:
    g = elev(p["x"], p["y"])
    floor = g + 0.6
    eye = floor + 1.6
    hz, water = horizon_and_water(p["x"], p["y"], eye)
    geo = georef(p["x"], p["y"])
    sea_bearings = [b for b, w in enumerate(water) if w >= 1500]
    open_sea = [b for b, w in enumerate(water) if w >= 7000]
    sun = {}
    for key, (mo, dd) in DATES.items():
        h, poss, f, l = sun_hours(hz, geo["lat"], geo["lon"], mo, dd)
        sun[key] = {"hours": h, "possible_hours": poss,
                    "first_sun_cet": None if f is None else round(f, 2),
                    "last_sun_cet": None if l is None else round(l, 2)}
    # cut/fill: level pad of house footprint against the natural slope
    s = math.tan(math.radians(p["slope_deg"]))
    cutfill_m3 = round(0.5 * HOUSE["w"] * HOUSE["d"] * (HOUSE["d"] * s) / 2, 1)
    records.append({
        "id": p["id"], "row": p["row"],
        "local": {"x": round(p["x"], 2), "y": round(p["y"], 2), "z_ground": round(g, 2),
                  "z_floor": round(floor, 2)},
        **geo,
        "house": {"width_m": HOUSE["w"], "depth_m": HOUSE["d"], "facing_deg": round(p["facing_deg"], 1),
                  "eaves_m": HOUSE["eaves"], "ridge_m": HOUSE["ridge"]},
        "terrain": {"slope_deg": round(p["slope_deg"], 1), "aspect_deg": round(p["facing_deg"], 1),
                    "level_pad_cutfill_m3": cutfill_m3},
        "view": {"water_visible_deg": len(sea_bearings),
                 "water_bearings": [sea_bearings[0], sea_bearings[-1]] if sea_bearings else None,
                 "open_sea_visible": bool(open_sea),
                 "open_sea_deg": len(open_sea),
                 "farthest_water_m": max(water)},
        "sun": sun,
        "horizon_deg_by_bearing": hz,
        "status": "provisional",
    })

(OUT / "plots.json").write_text(json.dumps({
    "crs_note": "local: metres, x=east, y=north, z=height above sea level (NN2000-ish via Kartverket DTM); "
                "origin = 58.068057N 7.278401E. UTM zone 32N (EPSG:25832) also given.",
    "assumptions": {
        "layout": "Provisional - rows on contours 78/68/58/48 m of the south-facing slope, "
                  "22 m spacing, houses 9 m below each row road. Replace with the georeferenced plan.",
        "sun": "Terrain shading only (field cleared of trees, no shading between houses). "
               "Eye height = floor +1.6 m, floor = ground +0.6 m. 0.25 deg solar-disc margin. Times in CET.",
        "view": "Water counted where the line of sight reaches a sea-level cell; 'open sea' = water beyond 7 km. "
                "Refraction included (k=1.17).",
        "cutfill": "Order-of-magnitude for a level pad under the footprint only.",
    },
    "plots": records,
}, indent=1), encoding="utf-8")

# --------------------------------------------------------------- the road
# access from Rødbergsveien in the south-east, then serpentine up between rows.
def road_profile(pts):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 0.5:
            continue
        z0, z1 = elev(x0, y0), elev(x1, y1)
        grade = (z1 - z0) / L * 100
        out.append({"from": [round(x0, 1), round(y0, 1), round(z0, 1)],
                    "to": [round(x1, 1), round(y1, 1), round(z1, 1)],
                    "length_m": round(L, 1), "grade_pct": round(grade, 1),
                    "ok_6pct": abs(grade) <= 6.0})
    return out


ENTRANCE = (188.0, -70.0)          # on Rødbergsveien


def climb_ramp(start, goal_level, toward, max_grade=0.06, step=5.0, limit=400):
    """Walk the terrain from `start` gaining height at <= max_grade until reaching
    goal_level, biased toward point `toward`. Returns the path. This is how a road
    engineer lays a ramp on a slope: traverse, do not attack the hill head-on."""
    pts = [start]
    x, y = start
    z = elev(x, y)
    heading = math.atan2(toward[0] - x, toward[1] - y)
    for _ in range(limit):
        if z >= goal_level - 0.3:
            break
        want = min(max_grade * step, goal_level - z)
        best = None
        for dh in range(-90, 91, 10):
            h = heading + math.radians(dh)
            nx, ny = x + step * math.sin(h), y + step * math.cos(h)
            if not (SITE_X[0] - 40 <= nx <= 200 and SITE_Y[0] - 40 <= ny <= SITE_Y[1] + 30):
                continue
            nz = elev(nx, ny)
            gain = nz - z
            # cost: miss the wanted gain, plus turning, plus not progressing toward the goal
            prog = ((toward[0] - nx) ** 2 + (toward[1] - ny) ** 2) ** 0.5
            cost = abs(gain - want) * 6 + abs(dh) / 90 * 0.6 + prog / 400
            if gain > max_grade * step + 0.05:
                cost += 5
            if best is None or cost < best[0]:
                best = (cost, nx, ny, nz, h)
        _, x, y, z, heading = best
        pts.append((x, y))
    return pts


road = {"entrance": ENTRANCE, "rows": row_roads, "ramps": [], "segments": []}
prev_end = ENTRANCE
for rr in row_roads[::-1]:          # climb from the lowest row upward
    pts = rr["pts"]
    east_end, west_end = pts[-1], pts[0]
    d_e = math.hypot(east_end[0] - prev_end[0], east_end[1] - prev_end[1])
    d_w = math.hypot(west_end[0] - prev_end[0], west_end[1] - prev_end[1])
    tgt = east_end if d_e < d_w else west_end
    # straight placeholder ramp, with the honest feasibility number next to it
    ramp = resample([prev_end, tgt], 5.0) + [tgt]
    dz = abs(elev(*tgt) - elev(*prev_end))
    straight = math.hypot(tgt[0] - prev_end[0], tgt[1] - prev_end[1])
    road["ramps"].append({"to_row": rr["row"], "pts": [(round(x, 2), round(y, 2)) for x, y in ramp],
                          "climb_m": round(dz, 1), "straight_length_m": round(straight, 1),
                          "length_needed_at_6pct_m": round(dz / 0.06, 1),
                          "feasible_straight": straight >= dz / 0.06})
    road["segments"] += road_profile(ramp)
    road["segments"] += road_profile(pts)
    prev_end = west_end if tgt == east_end else east_end

bad = [s for s in road["segments"] if not s["ok_6pct"]]
road["summary"] = {
    "total_length_m": round(sum(s["length_m"] for s in road["segments"]), 1),
    "segments_over_6pct": len(bad),
    "worst_grade_pct": round(max((abs(s["grade_pct"]) for s in road["segments"]), default=0), 1),
    "note": "Row roads follow contours and are level. Ramps between rows are straight placeholders; "
            "each ramp record states the climb and the length a 6 % road needs, so the real plan can "
            "size hairpins. Flagged segments are the ones a straight ramp cannot satisfy.",
}
(OUT / "road.json").write_text(json.dumps(road, indent=1), encoding="utf-8")

# ------------------------------------------------------------ clearing
xs = [p["x"] for p in plots] + [x for rr in row_roads for x, _ in rr["pts"]]
ys = [p["y"] for p in plots] + [y for rr in row_roads for _, y in rr["pts"]]
clearing = [(min(xs) - 15, min(ys) - 20), (max(xs) + 15, min(ys) - 20),
            (max(xs) + 15, max(ys) + 15), (min(xs) - 15, max(ys) + 15)]
(OUT / "clearing.json").write_text(json.dumps({
    "polygon_local": [(round(x, 1), round(y, 1)) for x, y in clearing],
    "note": "Provisional clearing extent = bounding box of rows + 15 m. Trees inside are flagged "
            "cleared=true in trees.json so the website can toggle before/after.",
}, indent=1), encoding="utf-8")

# ------------------------------------------------------------- summary
sea = [r for r in records if r["view"]["open_sea_visible"]]
print(f"plots: {len(records)}  rows: {[rr['row'] for rr in row_roads]}")
print(f"open sea visible from {len(sea)}/{len(records)} plots; "
      f"water >=1.5 km from {sum(1 for r in records if r['view']['water_visible_deg'] > 0)}")
for r in records[:6]:
    print(f"  {r['id']} row{r['row']} z={r['local']['z_ground']} slope={r['terrain']['slope_deg']}"
          f" sun dec21={r['sun']['dec21']['hours']}h jun21={r['sun']['jun21']['hours']}h"
          f" water={r['view']['water_visible_deg']}deg open_sea={r['view']['open_sea_visible']}")
print("road:", road["summary"])
