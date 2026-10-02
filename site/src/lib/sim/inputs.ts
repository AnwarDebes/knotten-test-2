/**
 * The energy simulation's inputs (public/twin/energy.json, built by pipeline/twin_energy.py): a
 * typical weather year for Knotten, NO2 spot prices and Elhub household use for 2025, all on the
 * same 8760 UTC hours, plus horizons for the shared plant and the office roof.
 */
export type EnergyInputs = {
  version: number;
  year: number;
  sources: Record<string, string>;
  tmy_months: [number, number][];
  ghi: number[]; dni: number[]; dhi: number[];
  t10: number[]; ws10: number[];
  price_ore10: number[];
  household_wh: number[];
  household_kwh_year: number;
  park: { x: number; y: number; z: number; horizon: number[]; name: string };
  office_roof: { azimuth: number; tilt: number; horizon: number[]; note: string };
  pvgis_kwh_per_kwp: Record<string, number>;
};

/** Typed views of the hourly series. */
export type Weather = {
  ghi: Float32Array; dni: Float32Array; dhi: Float32Array; temp: Float32Array; wind: Float32Array;
  price: Float32Array;        // NOK/kWh excl. VAT
  household: Float32Array;    // kWh per NO2 household metering point
};

export const HOURS = 8760;

export function weatherOf(j: EnergyInputs): Weather {
  const f = (a: number[], k = 1) => Float32Array.from(a, (v) => v * k);
  return {
    ghi: f(j.ghi), dni: f(j.dni), dhi: f(j.dhi),
    temp: f(j.t10, 0.1), wind: f(j.ws10, 0.1),
    price: f(j.price_ore10, 0.001), household: f(j.household_wh, 0.001),
  };
}

let cached: Promise<EnergyInputs> | null = null;
export function loadInputs(): Promise<EnergyInputs> {
  if (!cached) cached = fetch("/twin/energy.json").then((r) => { if (!r.ok) throw new Error(`energy.json ${r.status}`); return r.json(); }).catch((e) => { cached = null; throw e; });
  return cached;
}

/** UTC hour of the year (0..8759) to a Date in the simulation year. */
export function hourDate(year: number, h: number) {
  return new Date(Date.UTC(year, 0, 1) + h * 3600 * 1000);
}

/** Local (Norwegian) wall-clock hour of the year for a UTC hour: +1 in winter, +2 in summer time. */
export function localOf(year: number, h: number) {
  const d = hourDate(year, h);
  const offset = isSummerTime(d) ? 2 : 1;
  const local = new Date(d.getTime() + offset * 3600 * 1000);
  return { month: local.getUTCMonth() + 1, day: local.getUTCDate(), hour: local.getUTCHours(), weekday: (local.getUTCDay() + 6) % 7, date: local, offset };
}

/** EU summer time: last Sunday of March 01:00 UTC to last Sunday of October 01:00 UTC. */
export function isSummerTime(d: Date) {
  const y = d.getUTCFullYear();
  const lastSunday = (m: number) => { const t = new Date(Date.UTC(y, m + 1, 0, 1)); t.setUTCDate(t.getUTCDate() - t.getUTCDay()); return t; };
  return d >= lastSunday(2) && d < lastSunday(9);
}

/** UTC hour of the year for a local date and hour. */
export function hourOf(year: number, month: number, day: number, hourLocal: number) {
  const guess = new Date(Date.UTC(year, month - 1, day, hourLocal) - 3600 * 1000);
  const offset = isSummerTime(guess) ? 2 : 1;
  const t = Date.UTC(year, month - 1, day, 0) + (hourLocal - offset) * 3600 * 1000;
  return Math.max(0, Math.min(HOURS - 1, Math.floor((t - Date.UTC(year, 0, 1)) / 3600000)));
}
