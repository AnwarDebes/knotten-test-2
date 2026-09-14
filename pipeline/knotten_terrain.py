"""Knotten terrain toolkit: the samplers, parcel, view and sun functions shared by the layout
scripts. Extracted from plan_layout_v3.py on 2026-09-14 so a layout can be designed (v4, along the
project owner's switchback road) without re-running the greedy search. No side effects on import
except loading the LiDAR grid.
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


