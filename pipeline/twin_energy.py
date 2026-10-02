"""Inputs for the energy simulation (site/public/twin/energy.json), all hourly on one calendar.

  weather    EU JRC PVGIS 5.3 typical meteorological year for Knotten (SARAH-3 sun, ERA5 temperature
             and wind, 2005-2023): global, direct-normal and diffuse irradiance, air temperature,
             wind at 10 m. Hour i of the file is hour i of a typical year, in UTC.
  prices     NO2 day-ahead spot prices for 2025 (hvakosterstrommen.no), NOK/kWh excluding VAT,
             put on the same UTC hours.
  households Elhub's hourly consumption of all households in NO2 in 2025, per metering point. The
             simulation uses its summer shape (when no one heats) as the shape of household
             electricity other than heating.
  park       the terrain horizon at the scenario site of the shared solar plant (Lokkeheia, the
             highest point behind the field), from Kartverket's terrain model, for its shading.
  pvgis      PVGIS's own yield for 1 kWp on this spot (14 % losses, no horizon), to check the model.

Run after twin_fetch.py: python pipeline/twin_energy.py
"""
from __future__ import annotations

import datetime as dt
import json
import math

import numpy as np

import twin_common as tc

YEAR = 2025


def utc_hour(stamp: str) -> int:
    t = dt.datetime.fromisoformat(stamp).astimezone(dt.timezone.utc)
    return int((t - dt.datetime(YEAR, 1, 1, tzinfo=dt.timezone.utc)).total_seconds() // 3600)


def on_utc(rows, key):
    out = np.full(8760, np.nan)
    for r in rows:
        h = utc_hour(r["start"])
        if 0 <= h < 8760:
            out[h] = r[key]
    # the first hours of 1 January UTC fall on 31 December local: carry the neighbour
    idx = np.arange(8760)
    ok = ~np.isnan(out)
    return np.interp(idx, idx[ok], out[ok])


def horizon(x, y, z_eye, step_deg=1.0):
    """Elevation angle of the skyline per bearing (0 = north), with earth curvature and refraction."""
    rasters = [(tc.UtmRaster.load("dtm1"), 1250.0, 2.0), (tc.UtmRaster.load("dtm5"), 5000.0, 10.0), (tc.UtmRaster.load("dtm20"), 20000.0, 40.0)]
    out = []
    R = 6371000.0 / (1 - 0.13)        # effective radius with standard refraction
    for b in np.arange(0, 360, step_deg):
        r = math.radians(b)
        best = -10.0
        start = 5.0
        for ras, reach, step in rasters:
            d = np.arange(start, reach, step)
            px, py = x + np.sin(r) * d, y + np.cos(r) * d
            h = ras.sample(px, py)
            h = h - d * d / (2 * R)
            ang = np.degrees(np.arctan2(h - z_eye, d))
            best = max(best, float(ang.max()))
            start = reach
        out.append(round(best, 2))
    return out


def main():
    tmy = json.loads(tc.fetch("", name="pvgis_tmy.json", binary=False))
    rows = tmy["outputs"]["tmy_hourly"]
    assert len(rows) == 8760
    ghi = np.array([r["G(h)"] for r in rows]); dni = np.array([r["Gb(n)"] for r in rows]); dhi = np.array([r["Gd(h)"] for r in rows])
    t2m = np.array([r["T2m"] for r in rows]); ws = np.array([r["WS10m"] for r in rows])
    months = [[m["month"], m["year"]] for m in tmy["outputs"]["months_selected"]]

    price = on_utc(json.load(open(tc.CACHE / "prices_no2_2025.json", encoding="utf-8")), "nok")
    hh = json.load(open(tc.CACHE / "elhub_no2_household_2025.json", encoding="utf-8"))
    per_home = on_utc([{"start": r["start"], "v": r["kwh"] / r["n"]} for r in hh], "v")

    # the shared plant: Lokkeheia, the highest point behind the field (scenario site)
    names = json.load(open(tc.CACHE / "ssr_names.json", encoding="utf-8"))
    lk = next(n for n in names if any(s["skrivemåte"] == "Løkkeheia" for s in n["stedsnavn"]))
    lx, ly = tc.utm_to_local(lk["representasjonspunkt"]["øst"], lk["representasjonspunkt"]["nord"])
    dtm = tc.UtmRaster.load("dtm1")
    # the summit: highest ground within 60 m of the name's point
    s = np.arange(-60, 61, 2.0)
    gx, gy = np.meshgrid(lx + s, ly + s)
    hh_ = dtm.sample(gx, gy)
    k = int(np.argmax(hh_))
    px, py, pz = float(gx.ravel()[k]), float(gy.ravel()[k]), float(hh_.ravel()[k])
    park_hz = horizon(px, py, pz + 1.5)
    # the office roof (the existing building: its south-west roof slope can carry panels)
    recs = json.load(open(tc.CACHE / "buildings.json", encoding="utf-8"))
    office = next(r for r in recs if r.get("project") == "bld-office")
    ang = math.radians(office["angle_deg"])          # long side, counter-clockwise from east
    ridge_bearing = (90 - math.degrees(ang)) % 180   # compass bearing of the ridge line
    slope_az = (ridge_bearing + 90) % 360            # one slope faces this way, the other opposite
    if abs(((slope_az - 200) + 180) % 360 - 180) > 90:
        slope_az = (slope_az + 180) % 360            # take the slope facing south-west
    office_hz = horizon(office["x"], office["y"], office["ridge"] - 1.5)

    pvcalc = {}
    for key in ("35_0", "27_0", "35_-45", "35_45", "90_0"):
        j = json.loads(tc.fetch("", name=f"pvgis_pvcalc_{key}.json", binary=False))
        pvcalc[key.replace("_", "/")] = j["outputs"]["totals"]["fixed"]["E_y"]

    out = {
        "version": 1,
        "year": YEAR,
        "note": "Hour i is hour i of the year in UTC. Weather: a typical year (months from different years). Prices and household use: 2025.",
        "sources": {
            "weather": f"EU JRC PVGIS 5.3, typical meteorological year, {tmy['inputs']['meteo_data']['radiation_db']} and {tmy['inputs']['meteo_data']['meteo_db']}, {tmy['inputs']['meteo_data']['year_min']}-{tmy['inputs']['meteo_data']['year_max']}",
            "prices": "NO2 day-ahead spot prices 2025, hvakosterstrommen.no (Nord Pool), NOK/kWh excl. VAT",
            "households": "Elhub, hourly consumption of households in NO2, 2025, per metering point",
            "terrain": "Kartverket NHM DTM (horizon of the shared plant)",
        },
        "tmy_months": months,
        "ghi": [int(round(v)) for v in ghi],
        "dni": [int(round(v)) for v in dni],
        "dhi": [int(round(v)) for v in dhi],
        "t10": [int(round(v * 10)) for v in t2m],
        "ws10": [int(round(v * 10)) for v in ws],
        "price_ore10": [int(round(v * 1000)) for v in price],
        "household_wh": [int(round(v * 1000)) for v in per_home],
        "household_kwh_year": round(float(per_home.sum())),
        "park": {"x": round(px, 1), "y": round(py, 1), "z": round(pz, 1), "horizon": park_hz, "name": "Løkkeheia"},
        "office_roof": {"azimuth": round(slope_az, 1), "tilt": office["pitch_deg"], "horizon": office_hz, "note": "the existing office building's south-west roof slope, from the laser data"},
        "pvgis_kwh_per_kwp": pvcalc,
    }
    path = tc.OUT / "energy.json"
    path.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"energy.json: {path.stat().st_size // 1024} KB")
    print(f"  weather: GHI {ghi.sum() / 1000:.0f} kWh/m2 a year, mean {t2m.mean():.1f} C, min {t2m.min():.1f}, max {t2m.max():.1f}, wind mean {ws.mean():.1f} m/s")
    print(f"  prices: mean {price.mean():.3f} NOK/kWh; households: {per_home.sum():.0f} kWh/yr per metering point")
    print(f"  park at ({px:.0f}, {py:.0f}) {pz:.1f} m; horizon south {park_hz[180]} deg, max {max(park_hz)} deg")
    print(f"  office roof: azimuth {slope_az:.0f}, tilt {office['pitch_deg']}, horizon at 200 deg {office_hz[200]}")
    print(f"  pvgis: {pvcalc}")


if __name__ == "__main__":
    main()
