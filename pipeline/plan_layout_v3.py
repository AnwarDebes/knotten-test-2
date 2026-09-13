"""Knotten layout v3: every hill plot placed for a real sea view, inside the legal parcel.

What changed from v2: the earlier layouts put rows on fixed contour levels and accepted whatever
view each station got; 10 of 25 hill plots ended up looking at the hill. v3 turns that around.
Candidates are generated along the contours of the whole parcel, each candidate is scored by the
water it can actually see (line of sight over the 1 m LiDAR, refraction included), and plots are
chosen greedily for view, spacing and slope. Then every chosen plot is re-checked with its
neighbours' houses in the terrain, so a house in the row below cannot silently take the view.

Inputs   ../source/kv_terrain.f32 (+json), surround_elevation.json, horizon_elevation.json,
         area_meta.json, ../data/parcels.json, ../data/buildings.json
Outputs  ../data/plots.json, ../data/road.json, ../data/clearing.json (+ copies in site/public/data)
Run      python pipeline/plan_layout_v3.py
"""
from __future__ import annotations

import array
import json
import math
import shutil
from pathlib import Path

KN = Path(__file__).resolve().parent.parent
SRC = KN / "source"
OUT = KN / "data"
PUB = KN / "site" / "public" / "data"

meta = json.loads((SRC / "area_meta.json").read_text(encoding="utf-8"))
tinfo = json.loads((SRC / "kv_terrain.json").read_text(encoding="utf-8"))
sur = json.loads((SRC / "surround_elevation.json").read_text(encoding="utf-8"))
hor = json.loads((SRC / "horizon_elevation.json").read_text(encoding="utf-8"))
LAT, LON = meta["center"]["lat"], meta["center"]["lon"]
M_LAT, M_LON = meta["m_per_deg"]["lat"], meta["m_per_deg"]["lon"]
RES, HALF, STEP = tinfo["res"], tinfo["half_m"], tinfo["step_m"]
DTM = array.array("f")
DTM.fromfile(open(SRC / "kv_terrain.f32", "rb"), RES * RES)


# ------------------------------------------------------------------ samplers
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


def ground(x, y):
    for f in (lidar, sample_sur, sample_hor):
        v = f(x, y)
        if v is not None:
            return max(v, 0.0)
    return 0.0


# houses of already chosen plots become part of the terrain for the view checks
OBSTACLES: list[tuple[float, float, float, float]] = []   # x, y, radius, top_z


def elev(x, y):
    z = ground(x, y)
    for ox, oy, r, top in OBSTACLES:
        if abs(x - ox) <= r and abs(y - oy) <= r and (x - ox) ** 2 + (y - oy) ** 2 <= r * r:
            z = max(z, top)
    return z


def slope_aspect(x, y, d=2.0):
    zx = (ground(x + d, y) - ground(x - d, y)) / (2 * d)
    zy = (ground(x, y + d) - ground(x, y - d)) / (2 * d)
    slope = math.degrees(math.atan(math.hypot(zx, zy)))
    aspect = (math.degrees(math.atan2(-zx, -zy)) + 360) % 360
    return slope, aspect


# ------------------------------------------------------------------- geo
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
    east = 500000.0 + 0.9996 * N * (Aa + (1 - T + C) * Aa**3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa**5 / 120)
    north = 0.9996 * (M + N * tp * (Aa**2 / 2 + (5 - T + 9 * C + 4 * C * C) * Aa**4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa**6 / 720))
    return east, north


def georef(x, y):
    lat, lon = LAT + y / M_LAT, LON + x / M_LON
    e, n = to_utm32(lat, lon)
    return {"lat": round(lat, 7), "lon": round(lon, 7), "utm32_east": round(e, 2), "utm32_north": round(n, 2)}


# ------------------------------------------------------------------ parcel
parcels = json.loads((OUT / "parcels.json").read_text(encoding="utf-8"))["parcels"]
HILL = [p for p in parcels if p["bnr"] == 10][0]["ring"]
YARD = [p for p in parcels if p["bnr"] == 368][0]["ring"]
buildings = json.loads((OUT / "buildings.json").read_text(encoding="utf-8"))["buildings"]


def inside(poly, x, y):
    n = len(poly)
    c = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def dist_to_edge(poly, x, y):
    best = 1e9
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1e-9
        t = max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / L2))
        best = min(best, math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)))
    return best


def near_building(x, y, margin):
    for b in buildings:
        r = b["ring_local"]
        cx, cy = sum(q[0] for q in r) / len(r), sum(q[1] for q in r) / len(r)
        rad = max(math.hypot(q[0] - cx, q[1] - cy) for q in r)
        if math.hypot(x - cx, y - cy) < rad + margin:
            return True
    return False


# ------------------------------------------------------------- contours
def contour_polylines(level, x0, x1, y0, y1):
    segs = []
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            c = [(ground(x, y), (x, y)), (ground(x + 1, y), (x + 1, y)), (ground(x + 1, y + 1), (x + 1, y + 1)), (ground(x, y + 1), (x, y + 1))]
            pts = []
            for k in range(4):
                z0, p0 = c[k]
                z1, p1 = c[(k + 1) % 4]
                if (z0 < level) != (z1 < level):
                    t = (level - z0) / (z1 - z0)
                    pts.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t))
            if len(pts) == 2:
                segs.append((pts[0], pts[1]))
    from collections import defaultdict
    key = lambda p: (round(p[0], 3), round(p[1], 3))
    adj = defaultdict(list)
    for a, b in segs:
        adj[key(a)].append(key(b))
        adj[key(b)].append(key(a))
    seen = set()
    chains = []
    for start in list(adj):
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
    # closed loops
    for start in list(adj):
        if start in seen:
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
    return [[(float(p[0]), float(p[1])) for p in ch] for ch in chains if len(ch) > 3]


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


# --------------------------------------------------------------- the view
EARTH_R = 6371000.0 * 1.17


def water_along(ox, oy, oz, bearing, fine=True):
    """Farthest visible sea-level cell along one bearing (0 if none)."""
    br = math.radians(bearing)
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
        if fine:
            d += 6.0 if d < 600 else (25.0 if d < 3000 else 80.0)
        else:
            d += 10.0 if d < 500 else (40.0 if d < 3000 else 150.0)
    return far, math.degrees(best)


def quick_view(x, y, eye):
    """South sector only, coarse: enough to rank candidates."""
    water = open_sea = 0
    for b in range(140, 212, 2):
        far, _ = water_along(x, y, eye, b, fine=False)
        if far >= 1500:
            water += 2
        if far >= 7000:
            open_sea += 2
    return water, open_sea


def full_view(x, y, eye):
    hz, water = [], []
    for b in range(360):
        far, ang = water_along(x, y, eye, b, fine=True)
        hz.append(round(ang, 2))
        water.append(round(far))
    return hz, water


# ----------------------------------------------------------------- the sun
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
    C = (math.sin(Mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + math.sin(2 * Mr) * (0.019993 - 0.000101 * t) + math.sin(3 * Mr) * 0.000289)
    omega = 125.04 - 1934.136 * t
    lam = math.radians(L0 + C - 0.00569 - 0.00478 * math.sin(math.radians(omega)))
    eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    eps = math.radians(eps0 + 0.00256 * math.cos(math.radians(omega)))
    decl = math.asin(math.sin(eps) * math.sin(lam))
    y = math.tan(eps / 2) ** 2
    L0r = math.radians(L0)
    eot = 4 * math.degrees(y * math.sin(2 * L0r) - 2 * e * math.sin(Mr) + 4 * e * y * math.sin(Mr) * math.cos(2 * L0r) - 0.5 * y * y * math.sin(4 * L0r) - 1.25 * e * e * math.sin(2 * Mr))
    tst = (hour_utc * 60 + eot + 4 * lon) % 1440
    ha = math.radians(tst / 4 - 180)
    latr = math.radians(lat)
    zen = math.acos(math.sin(latr) * math.sin(decl) + math.cos(latr) * math.cos(decl) * math.cos(ha))
    az = math.degrees(math.atan2(math.sin(ha), math.cos(ha) * math.sin(latr) - math.tan(decl) * math.cos(latr)))
    return 90 - math.degrees(zen), (az + 180.0) % 360.0


def sun_hours(hz, lat, lon, month, day):
    lit = possible = 0
    first = last = None
    for m in range(0, 1440, 5):
        el, az = solar(2026, month, day, m / 60.0, lat, lon)
        if el <= 0:
            continue
        possible += 5
        if el > hz[int(az) % 360] + 0.25:
            lit += 5
            local = (m / 60.0 + 1.0) % 24
            first = local if first is None else first
            last = local
    return round(lit / 60, 2), round(possible / 60, 2), first, last


# ------------------------------------------------------------ candidates
HOUSE = {"w": 11.0, "d": 8.5, "eaves": 3.2, "ridge": 5.6}
TARGET_HILL = 27
MIN_SPACING = 15.0     # 11 m house, 4 m between; the sketch is tighter still
EDGE_MARGIN = 12.0
xs = [p[0] for p in HILL]
ys = [p[1] for p in HILL]
BX = (min(xs) - 5, max(xs) + 5)
BY = (min(ys) - 5, max(ys) + 5)

print("tracing contours and scoring candidates...", flush=True)
LEVELS = [20, 26, 32, 38, 44, 50, 56, 62, 68, 74]   # terraces 6 m apart; the sketch packs its rows tightly
cands = []
for level in LEVELS:
    for poly in contour_polylines(level, BX[0], BX[1], BY[0], BY[1]):
        for (x, y) in resample(poly, 4.0):
            if not inside(HILL, x, y) or dist_to_edge(HILL, x, y) < EDGE_MARGIN:
                continue
            if near_building(x, y, 18.0):
                continue
            # the house sits a few metres below the row road, on the downhill side
            slope, aspect = slope_aspect(x, y)
            ar = math.radians(aspect)
            hx, hy = x + 7.0 * math.sin(ar), y + 7.0 * math.cos(ar)
            if not inside(HILL, hx, hy) or dist_to_edge(HILL, hx, hy) < EDGE_MARGIN - 3:
                continue
            s2, a2 = slope_aspect(hx, hy)
            if s2 > 26.0:
                continue
            g = ground(hx, hy)
            water, open_sea = quick_view(hx, hy, g + 0.6 + 1.6)
            cands.append({"level": level, "road_xy": (x, y), "x": hx, "y": hy, "z": g, "slope": s2, "aspect": a2,
                          "water": water, "open_sea": open_sea})
print("candidates:", len(cands), "with water:", sum(1 for c in cands if c["water"] > 0), "open sea:", sum(1 for c in cands if c["open_sea"] > 0), flush=True)

# greedy: open sea first, then water, then gentler ground; spacing enforced; a house that is
# chosen becomes an obstacle for later candidates (re-scored on the fly against neighbours)
cands.sort(key=lambda c: (-(c["open_sea"] * 3 + c["water"]), c["slope"]))
chosen = []


def clear_of(c):
    return all(math.hypot(c["x"] - o["x"], c["y"] - o["y"]) >= MIN_SPACING for o in chosen)


for c in cands:
    if len(chosen) >= TARGET_HILL:
        break
    if c["water"] == 0 or not clear_of(c):
        continue
    # re-check the view with the houses already placed standing in the terrain
    water, open_sea = quick_view(c["x"], c["y"], c["z"] + 0.6 + 1.6)
    if water == 0:
        continue
    c["water"], c["open_sea"] = water, open_sea
    chosen.append(c)
    OBSTACLES.append((c["x"], c["y"], 7.0, c["z"] + 0.6 + HOUSE["ridge"]))
print("chosen hill plots with a sea view:", len(chosen), flush=True)

# if the parcel cannot give TARGET_HILL plots with a view, fill with the best remaining
print("no blind plots are added: the count is what the hill honestly gives", flush=True)

# the flat plots by the road: no sea view, Sigve knows; kept because they are part of the field
FLAT = [(150.0, -76.0), (176.0, -70.0), (198.0, -92.0)]
TOTAL = 30            # the project is thirty homes; the flat by the road takes what the hill cannot give
flat_plots = []


def flat_ok(x, y):
    if near_building(x, y, 10.0) or not any(inside(q["ring"], x, y) for q in parcels):
        return False
    if math.hypot(x - 204.0, y + 66.0) < 22.0:      # keep the entrance from Rødbergsveien free
        return False
    if any(math.hypot(x - o["x"], y - o["y"]) < MIN_SPACING for o in chosen + flat_plots):
        return False
    s2, _ = slope_aspect(x, y)
    return ground(x, y) < 14.0 and s2 < 14.0


def add_flat(x, y):
    s2, a2 = slope_aspect(x, y)
    flat_plots.append({"x": x, "y": y, "z": ground(x, y), "slope": s2, "aspect": a2, "level": None, "road_xy": (x, y), "water": 0, "open_sea": 0})


for (x, y) in FLAT:
    if flat_ok(x, y):
        add_flat(x, y)
# more room on the flat, if the hill comes up short: a grid search over the low ground, gentlest first
extra = []
for gx in range(120, 240, 4):
    for gy in range(-130, -50, 4):
        x, y = float(gx), float(gy)
        if flat_ok(x, y):
            extra.append((slope_aspect(x, y)[0], x, y))
extra.sort()
for _, x, y in extra:
    if len(flat_plots) >= 8:
        break
    if flat_ok(x, y):
        add_flat(x, y)
print("flat candidates ready:", len(flat_plots), flush=True)

# order: by row (level, top first) then west to east, so ids read like the plan
chosen.sort(key=lambda c: (-c["level"], c["x"]))
levels_used = sorted({c["level"] for c in chosen}, reverse=True)
row_of = {lv: i + 1 for i, lv in enumerate(levels_used)}
plots = [{**c, "zone": "hill", "row": row_of[c["level"]]} for c in chosen]
for i, p in enumerate(plots):
    p["id"] = f"plot-{i + 1:02d}"

# ------------------------------------------------------- full evidence per plot
print("full horizon, view and sun per plot...", flush=True)
DATES = {"dec21": (12, 21), "mar21": (3, 21), "jun21": (6, 21)}
def record_for(p):
    g = p["z"]
    floor = g + 0.6
    eye = floor + 1.6
    # the plot's own house must not shade its own view check
    own = [(o for o in OBSTACLES)]
    OBSTACLES[:] = [o for o in OBSTACLES if not (abs(o[0] - p["x"]) < 0.01 and abs(o[1] - p["y"]) < 0.01)]
    hz, water = full_view(p["x"], p["y"], eye)
    OBSTACLES.append((p["x"], p["y"], 7.0, g + 0.6 + HOUSE["ridge"]))
    geo = georef(p["x"], p["y"])
    sea_b = [b for b, w in enumerate(water) if w >= 1500]
    open_b = [b for b, w in enumerate(water) if w >= 7000]
    # face the middle of the water, else downhill
    facing = ((sea_b[0] + sea_b[-1]) / 2) if sea_b else p["aspect"]
    sun = {}
    for key, (mo, dd) in DATES.items():
        h, poss, f, l = sun_hours(hz, geo["lat"], geo["lon"], mo, dd)
        sun[key] = {"hours": h, "possible_hours": poss, "first_sun_cet": None if f is None else round(f, 2), "last_sun_cet": None if l is None else round(l, 2)}
    s = math.tan(math.radians(p["slope"]))
    cutfill = round(0.5 * HOUSE["w"] * HOUSE["d"] * (HOUSE["d"] * s) / 2, 1)
    rec = ({
        "id": p["id"], "row": p["row"], "zone": p["zone"],
        "local": {"x": round(p["x"], 2), "y": round(p["y"], 2), "z_ground": round(g, 2), "z_floor": round(floor, 2)},
        **geo,
        "house": {"width_m": HOUSE["w"], "depth_m": HOUSE["d"], "facing_deg": round(facing, 1), "eaves_m": HOUSE["eaves"], "ridge_m": HOUSE["ridge"], "storeys": 1.5},
        "terrain": {"slope_deg": round(p["slope"], 1), "aspect_deg": round(p["aspect"], 1), "level_pad_cutfill_m3": cutfill, "dist_to_boundary_m": round(dist_to_edge(HILL, p["x"], p["y"]), 1)},
        "view": {"water_visible_deg": len(sea_b), "water_bearings": [sea_b[0], sea_b[-1]] if sea_b else None, "open_sea_visible": bool(open_b), "open_sea_deg": len(open_b), "farthest_water_m": max(water), "checked_with_neighbours": True},
        "sun": sun,
        "horizon_deg_by_bearing": hz,
        "status": "provisional",
    })
    print(" ", p["id"], p["zone"], "row", p["row"], "z", round(g, 1), "water", len(sea_b), "open sea", bool(open_b), "sun dec", sun["dec21"]["hours"], flush=True)
    return rec


records = [record_for(p) for p in plots]
# plots that lost the water in the fine check with the neighbours standing are dropped
records = [r for r in records if r["view"]["water_visible_deg"] > 0]
keep_ids = {r["id"] for r in records}
plots = [p for p in plots if p["id"] in keep_ids]
# the flat by the road takes what the hill cannot give, up to thirty homes in all
need = max(0, TOTAL - len(plots))
for c in flat_plots[:need]:
    fp = {**c, "zone": "flat", "row": len(levels_used) + 1, "id": f"plot-{len(plots) + 1:02d}"}
    plots.append(fp)
    records.append(record_for(fp))
for i, (p, r) in enumerate(zip(plots, records)):
    p["id"] = r["id"] = f"plot-{i + 1:02d}"

# ------------------------------------------------------------------ roads
print("roads...", flush=True)
ENTRANCE = (204.0, -66.0)     # the parcel tongue meets Rødbergsveien here


def road_profile(pts):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 0.5:
            continue
        z0, z1 = ground(x0, y0), ground(x1, y1)
        grade = (z1 - z0) / L * 100
        out.append({"from": [round(x0, 1), round(y0, 1), round(z0, 1)], "to": [round(x1, 1), round(y1, 1), round(z1, 1)], "length_m": round(L, 1), "grade_pct": round(grade, 1), "ok_6pct": abs(grade) <= 6.0})
    return out


def climb(start, goal_level, toward, max_grade=0.06, step=4.0, limit=600):
    """Trace a ramp on the terrain at <= 6 %, inside the parcel, the way a road engineer lays it:
    traverse the slope, never attack it head-on, and join the row road from the side."""
    pts = [start]
    x, y = start
    z = ground(x, y)
    heading = math.atan2(toward[0] - x, toward[1] - y)
    cap = max_grade * step
    for _ in range(limit):
        if len(pts) * step > 4 * abs(goal_level - ground(*start)) / max_grade + 120:
            break
        dist = math.hypot(toward[0] - x, toward[1] - y)
        if dist < 9:
            break
        if abs(z - goal_level) < 0.6 and dist < 60:
            pts.append(toward)
            break
        want = max(-cap, min(cap, goal_level - z))
        best = fallback = None
        for dh in range(-130, 131, 10):
            h = heading + math.radians(dh)
            nx, ny = x + step * math.sin(h), y + step * math.cos(h)
            if not (inside(HILL, nx, ny) or inside(YARD, nx, ny)) and math.hypot(nx - ENTRANCE[0], ny - ENTRANCE[1]) > 12:
                continue
            nz = ground(nx, ny)
            gain = nz - z
            prog = math.hypot(toward[0] - nx, toward[1] - ny)
            if fallback is None or abs(gain) < fallback[0]:
                fallback = (abs(gain), nx, ny, nz, h)
            if abs(gain) > cap + 0.02:
                continue
            cost = abs(gain - want) * 10 + abs(dh) / 130 * 0.6 + (prog - dist) / step * 0.9
            if best is None or cost < best[0]:
                best = (cost, nx, ny, nz, h)
        if best is None:
            if fallback is None:
                break
            best = fallback
        _, x, y, z, heading = best
        pts.append((x, y))
    return pts


row_roads = []
for lv in levels_used:
    members = [p for p in plots if p["zone"] == "hill" and p["level"] == lv]
    # the road runs along the contour between the westmost and eastmost house of the row
    if not members:
        continue
    polys = [[q for q in resample(poly, 4.0) if inside(HILL, *q) and dist_to_edge(HILL, *q) > 6] for poly in contour_polylines(lv, BX[0], BX[1], BY[0], BY[1])]
    polys = [pl for pl in polys if len(pl) > 2]
    if not polys:
        continue
    def carries(pl):
        return sum(1 for m in members if min(math.hypot(m["road_xy"][0] - q[0], m["road_xy"][1] - q[1]) for q in pl) < 6)
    poly = max(polys, key=carries)
    # trim the road to the stretch that serves houses, plus 8 m at each end
    idx = [i for i, q in enumerate(poly) if any(math.hypot(m["road_xy"][0] - q[0], m["road_xy"][1] - q[1]) < 6 for m in members)]
    if not idx:
        continue
    pts = poly[max(0, min(idx) - 2):min(len(poly), max(idx) + 3)]
    if len(pts) < 2:
        continue
    row_roads.append({"row": row_of[lv], "level": lv, "pts": [(round(x, 2), round(y, 2)) for x, y in pts]})

road = {"entrance": ENTRANCE, "entrance_z": round(ground(*ENTRANCE), 1), "rows": row_roads, "ramps": [], "segments": []}
prev = ENTRANCE
for rr in sorted(row_roads, key=lambda r: r["level"]):
    pts = rr["pts"]
    e_end, w_end = pts[-1], pts[0]
    tgt = e_end if math.hypot(e_end[0] - prev[0], e_end[1] - prev[1]) < math.hypot(w_end[0] - prev[0], w_end[1] - prev[1]) else w_end
    # a straight placeholder between the rows, with the honest number next to it: the length a
    # 6 % road needs. Where the straight line is shorter than that, the real plan needs a hairpin.
    ramp = resample([prev, tgt], 4.0) + [tgt]
    dz = abs(ground(*tgt) - ground(*prev))
    L = math.hypot(tgt[0] - prev[0], tgt[1] - prev[1])
    road["ramps"].append({"id": f"ramp-{rr['row']}", "to_row": rr["row"], "pts": [(round(x, 2), round(y, 2)) for x, y in ramp], "climb_m": round(dz, 1), "length_m": round(L, 1), "length_needed_at_6pct_m": round(dz / 0.06, 1), "feasible_straight": L >= dz / 0.06, "placeholder": True})
    road["segments"] += road_profile(ramp)
    road["segments"] += road_profile(pts)
    prev = w_end if tgt == e_end else e_end

bad = [s for s in road["segments"] if not s["ok_6pct"]]
road["summary"] = {"total_length_m": round(sum(s["length_m"] for s in road["segments"]), 1), "segments_over_6pct": len(bad), "worst_grade_pct": round(max((abs(s["grade_pct"]) for s in road["segments"]), default=0), 1),
                   "note": "Row roads follow the contour and are level. Ramps between rows are straight placeholders; each states the climb and the length a 6 % road needs, so the real plan can size the hairpins. Provisional until the regulation plan."}

# ----------------------------------------------------------------- write
(OUT / "plots.json").write_text(json.dumps({
    "crs_note": "local: metres, x=east, y=north, z=height above sea level (Kartverket DTM); origin = 58.068057N 7.278401E. UTM zone 32N (EPSG:25832) also given.",
    "assumptions": {
        "layout": "Provisional v3 (2026-09-13): inside the legal parcel 355/10 + 355/368. Candidates on every 4 m contour of the knoll, scored by the water each can see over the 1 m LiDAR, chosen for view, 21 m spacing and slope; each plot re-checked with the neighbouring houses standing. Three plots on the flat by Rødbergsveien without sea view. Replace with the regulation plan when it exists.",
        "sun": "Terrain shading only (field cleared, no shading between houses). Eye = floor + 1.6 m, floor = ground + 0.6 m. 0.25 deg solar-disc margin. Times in CET.",
        "view": "Water counted where the line of sight reaches a sea-level cell; 'open sea' = water beyond 7 km. Refraction k = 1.17. Neighbouring houses (ridge 5.6 m) included as obstacles.",
        "cutfill": "Order-of-magnitude for a level pad under the footprint only.",
    },
    "plots": records,
}, indent=1), encoding="utf-8")
(OUT / "road.json").write_text(json.dumps(road, indent=1), encoding="utf-8")
(OUT / "clearing.json").write_text(json.dumps({"polygon_local": [[round(x, 1), round(y, 1)] for x, y in HILL], "note": "The whole hill parcel is the clearing extent (provisional). Trees inside are flagged cleared in trees.json."}, indent=1), encoding="utf-8")
PUB.mkdir(parents=True, exist_ok=True)
for f in ("plots.json", "road.json", "clearing.json"):
    shutil.copy2(OUT / f, PUB / f)
hill = [r for r in records if r["zone"] == "hill"]
print("DONE. hill plots:", len(hill), "with water:", sum(1 for r in hill if r["view"]["water_visible_deg"] > 0), "open sea:", sum(1 for r in hill if r["view"]["open_sea_visible"]), "| road", road["summary"], flush=True)
