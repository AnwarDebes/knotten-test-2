/**
 * Solar power, hour by hour, for any panel on Knotten: the sun's position (NOAA, the same routine as
 * the sun passports), the Perez sky model for light on a tilted plane, the measured terrain horizon
 * for shading, the angle of incidence (Martin and Ruiz), module temperature (Faiman) and the
 * crystalline-silicon module model of Huld et al. that PVGIS itself uses, then 14 % system losses.
 *
 * Check: for 1 kWp facing due south at 35 degrees with no horizon, this model gives about the same
 * yield as PVGIS's own calculator for the spot (pvgis_kwh_per_kwp in energy.json); see check().
 */
import { solarPosition, SITE } from "../solar";
import { HOURS, type Weather } from "./inputs";

export type Sun = { zen: Float32Array; azi: Float32Array; el: Float32Array; doy: Uint16Array };

const D2R = Math.PI / 180;

/** Sun position for every hour (PVGIS's irradiance time stamps are about 11 minutes past the hour). */
export function sunTable(year: number): Sun {
  const zen = new Float32Array(HOURS), azi = new Float32Array(HOURS), el = new Float32Array(HOURS), doy = new Uint16Array(HOURS);
  const t0 = Date.UTC(year, 0, 1);
  for (let h = 0; h < HOURS; h++) {
    const d = new Date(t0 + (h + 0.19) * 3600 * 1000);
    const p = solarPosition(d, SITE.lat, SITE.lon);
    el[h] = p.elevation;
    zen[h] = (90 - p.elevation) * D2R;
    azi[h] = p.azimuth;
    doy[h] = Math.floor(h / 24) + 1;
  }
  return { zen, azi, el, doy };
}

// Perez 1990, all sites composite: F11 F12 F13 F21 F22 F23 for the 8 sky-clearness bins
const PEREZ = [
  [-0.008, 0.588, -0.062, -0.06, 0.072, -0.022],
  [0.13, 0.683, -0.151, -0.019, 0.066, -0.029],
  [0.33, 0.487, -0.221, 0.055, -0.064, -0.026],
  [0.568, 0.187, -0.295, 0.109, -0.152, -0.014],
  [0.873, -0.392, -0.362, 0.226, -0.462, 0.001],
  [1.132, -1.237, -0.412, 0.288, -0.823, 0.056],
  [1.06, -1.6, -0.359, 0.264, -1.127, 0.131],
  [0.678, -0.327, -0.25, 0.156, -1.377, 0.251],
];
const EPS_BINS = [1.065, 1.23, 1.5, 1.95, 2.8, 4.5, 6.2];
// Huld et al. (2011) coefficients for crystalline silicon (k1..k6)
const K = [-0.017237, -0.040465, -0.004702, 0.000149, 0.00017, 0.000005];

export type Panel = { tilt: number; azimuth: number; horizon?: number[] };
export type PvOptions = { albedo?: number; lossPct?: number; gamma?: number };

/** A panel's fixed geometry, prepared once: tilt and direction, and how much sky its horizon hides. */
export function preparePanel(panel: Panel, opts: PvOptions = {}) {
  const b = panel.tilt * D2R;
  const cb = Math.cos(b), sb = Math.sin(b);
  const hz = panel.horizon;
  // share of the sky dome the horizon hides (isotropic diffuse), seen from the tilted plane
  let svf = 1;
  if (hz && hz.length === 360) {
    let s = 0;
    for (let a = 0; a < 360; a++) {
      const e = Math.max(0, hz[a]) * D2R;
      const face = 0.5 + 0.5 * Math.cos((a - panel.azimuth) * D2R) * sb;   // weight what the panel faces
      s += Math.sin(e) ** 2 * face;
    }
    svf = 1 - (s / 360) * 2;
  }
  return {
    cb, sb, ga: panel.azimuth, hz, svf,
    albedo: opts.albedo ?? 0.18,
    loss: 1 - (opts.lossPct ?? 14) / 100,                // as in PVGIS: wiring, inverter, soiling, mismatch, ageing
    gamma: opts.gamma ?? -0.0034,                        // extra temperature coefficient beyond the Huld model's own
  };
}
export type PreparedPanel = ReturnType<typeof preparePanel>;

/**
 * One hour on one panel: plane-of-array light (W/m2) and the AC power per kWp (kW), from the hour's
 * global, direct-normal and diffuse light, the sun's zenith (radians), azimuth and elevation
 * (degrees), the day of the year, the air temperature and the wind at 10 m.
 */
export function panelHour(P: PreparedPanel, ghi: number, dni: number, dhi: number, zen: number, azi: number, el: number, doy: number, temp: number, wind: number) {
  if (ghi <= 0 || el <= -0.5) return { poa: 0, kw: 0 };
  const z = zen, cz = Math.max(0.0, Math.cos(z));
  const cosAoi = Math.cos(z) * P.cb + Math.sin(z) * P.sb * Math.cos((azi - P.ga) * D2R);
  // terrain: the sun behind the skyline at this bearing gives no direct light
  const blocked = P.hz ? el < (P.hz[Math.round(azi) % 360] ?? 0) + 0.25 : false;
  // Perez
  const I0 = 1367 * (1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365));
  const zdeg = z / D2R;
  const am = zdeg < 89.9 ? 1 / (cz + 0.50572 * Math.pow(96.07995 - zdeg, -1.6364)) : 37;
  const k = 1.041 * z * z * z;
  const eps = dhi > 0 ? ((dhi + dni) / dhi + k) / (1 + k) : 999;
  let bin = 0;
  while (bin < 7 && eps >= EPS_BINS[bin]) bin++;
  const delta = (dhi * am) / I0;
  const F = PEREZ[bin];
  const F1 = Math.max(0, F[0] + F[1] * delta + F[2] * z);
  const F2 = F[3] + F[4] * delta + F[5] * z;
  const a = Math.max(0, cosAoi), bb = Math.max(Math.cos(85 * D2R), cz);
  const isotropic = dhi * (1 - F1) * (1 + P.cb) / 2 * P.svf;
  const circumsolar = blocked ? 0 : dhi * F1 * (a / bb);
  const brightening = dhi * F2 * P.sb;
  const diffuse = Math.max(0, isotropic + circumsolar + brightening);
  const beam = blocked ? 0 : dni * a;
  const ground = ghi * P.albedo * (1 - P.cb) / 2;
  const total = beam + diffuse + ground;
  // reflection at steep angles (Martin and Ruiz, ar = 0.16) on the beam; sky and ground light about 4 % less
  const ar = 0.16;
  const iam = a > 0.01 ? (1 - Math.exp(-a / ar)) / (1 - Math.exp(-1 / ar)) : 0;
  const eff = beam * iam + (diffuse + ground) * 0.955;
  if (eff <= 1) return { poa: total, kw: 0 };
  // module temperature (Faiman, free-standing c-Si as in PVGIS: U0 = 26.9, U1 = 6.2)
  const tm = temp + total / (26.9 + 6.2 * wind);
  // Huld et al. (2011) for crystalline silicon: efficiency against light level and temperature
  const G = eff / 1000, lg = Math.log(G), T = tm - 25;
  const rel = 1 + K[0] * lg + K[1] * lg * lg + K[2] * T + K[3] * T * lg + K[4] * T * lg * lg + K[5] * T * T;
  return { poa: total, kw: Math.max(0, G * rel * P.loss * (1 + (P.gamma + 0.0034) * T)) };
}

/** Plane-of-array light (W/m2) and the AC output per kWp (kW) for every hour of the year. */
export function panelSeries(w: Weather, sun: Sun, panel: Panel, opts: PvOptions = {}) {
  const P = preparePanel(panel, opts);
  const poa = new Float32Array(HOURS), kw = new Float32Array(HOURS);
  for (let h = 0; h < HOURS; h++) {
    if (w.ghi[h] <= 0) continue;
    const r = panelHour(P, w.ghi[h], w.dni[h], w.dhi[h], sun.zen[h], sun.azi[h], sun.el[h], sun.doy[h], w.temp[h], w.wind[h]);
    poa[h] = r.poa;
    kw[h] = r.kw;
  }
  return { poa, kw };
}

/** Annual kWh per kWp for a panel, to compare with PVGIS. */
export function annualYield(series: { kw: Float32Array }) {
  let s = 0;
  for (let h = 0; h < HOURS; h++) s += series.kw[h];
  return s;
}

/** A small turbine: generic power curve, hub-height wind from 10 m with a terrain factor. */
export function windSeries(w: Weather, opts: { kw: number; hub: number; siteFactor: number; availability: number; cutIn?: number; rated?: number; cutOut?: number }) {
  const { kw, hub, siteFactor, availability } = opts;
  const vin = opts.cutIn ?? 3, vr = opts.rated ?? 11, vout = opts.cutOut ?? 25;
  const shear = Math.pow(hub / 10, 0.2);
  const out = new Float32Array(HOURS);
  for (let h = 0; h < HOURS; h++) {
    const v = w.wind[h] * shear * siteFactor;
    let p = 0;
    if (v >= vin && v < vr) p = kw * (v ** 3 - vin ** 3) / (vr ** 3 - vin ** 3);
    else if (v >= vr && v < vout) p = kw;
    out[h] = p * availability;
  }
  return out;
}
