/**
 * What the field uses, hour by hour, from the energy budget's annual figures and real patterns:
 *
 *   homes      7,000 kWh of electricity a year each (budget), in the hourly shape of NO2's
 *              households in summer 2025 (Elhub), when almost nothing goes to heating; a little more
 *              in the dark months; each home a bit different (size and rhythm)
 *   heat       15,000 kWh of heat a year each (budget): hot water 3,000 kWh in a daily rhythm, rooms
 *              12,000 kWh following the outdoor temperature of the typical year (heating below 15 C)
 *   heat pump  ground source: the efficiency follows the brine temperature of the simulated borehole
 *              field (EED: -0.78 to 8.12 C over the year) and the supply temperature; scaled so the
 *              year comes out at the budget's seasonal factor of 3.6
 *   office     37,500 kWh a year (budget), working hours on weekdays
 *   workshop   22,000 kWh a year (budget), working hours on weekdays
 */
import { HOURS, localOf, type Weather } from "./inputs";

export type LoadSpec = {
  homes: number;
  elPerHome: number;      // kWh/year, household electricity without heating
  heatPerHome: number;    // kWh/year, rooms and hot water
  dhwShare: number;       // part of the heat that is hot water
  scop: number;           // seasonal factor of the heat pump (1 = direct electric)
  officeKwh: number;
  workshopKwh: number;
};

export type Loads = {
  appliance: Float32Array[];   // kW per home
  heat: Float32Array[];        // kW of heat per home (rooms + water)
  hp: Float32Array[];          // kW of electricity for that heat
  office: Float32Array;
  workshop: Float32Array;
  cop: Float32Array;           // the heat pump's efficiency each hour (rooms)
};

const hash = (i: number, k: number) => { const x = Math.sin((i + 1) * 12.9898 * k + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const DHW_SHAPE = [0.2, 0.1, 0.1, 0.1, 0.2, 0.6, 1.6, 2.0, 1.4, 0.8, 0.6, 0.6, 0.7, 0.6, 0.5, 0.6, 0.9, 1.3, 1.6, 1.5, 1.3, 1.0, 0.6, 0.4];

export function buildLoads(year: number, w: Weather, spec: LoadSpec): Loads {
  const loc = Array.from({ length: HOURS }, (_, h) => localOf(year, h));
  const doy = (h: number) => Math.floor(h / 24) + 1;

  // household rhythm: NO2 households in June to August 2025, by day type and local hour
  const sum = [new Float64Array(24), new Float64Array(24), new Float64Array(24)], n = [new Float64Array(24), new Float64Array(24), new Float64Array(24)];
  for (let h = 0; h < HOURS; h++) {
    const l = loc[h];
    if (l.month < 6 || l.month > 8) continue;
    const t = l.weekday < 5 ? 0 : l.weekday === 5 ? 1 : 2;
    sum[t][l.hour] += w.household[h];
    n[t][l.hour]++;
  }
  const shape = sum.map((s, t) => Array.from(s, (v, i) => v / Math.max(1, n[t][i])));
  const mean = shape.flat().reduce((a, b) => a + b, 0) / 72;
  const rhythm = (h: number, shift: number) => {
    const l = loc[(h + shift + HOURS) % HOURS];
    const t = l.weekday < 5 ? 0 : l.weekday === 5 ? 1 : 2;
    const season = 1 + 0.15 * Math.cos((2 * Math.PI * (doy(h) - 10)) / 365);
    return (shape[t][l.hour] / mean) * season;
  };

  // heat: rooms by heating degree hours on a slowly following indoor balance, water by the clock
  const tEff = new Float32Array(HOURS);
  let acc = w.temp[0];
  for (let h = 0; h < HOURS; h++) { acc += (w.temp[h] - acc) / 12; tEff[h] = acc; }
  let dh = 0;
  for (let h = 0; h < HOURS; h++) dh += Math.max(0, 15 - tEff[h]);
  const roomsPerDegH = (spec.heatPerHome * (1 - spec.dhwShare)) / dh;
  const dhwSum = DHW_SHAPE.reduce((a, b) => a + b, 0);

  // heat pump: Carnot shape with heat-exchanger approach temperatures, scaled to the seasonal factor
  const brine = (h: number) => 3.67 + 4.45 * Math.cos((2 * Math.PI * (doy(h) - 230)) / 365);
  const copRaw = new Float32Array(HOURS), copDhwRaw = new Float32Array(HOURS);
  for (let h = 0; h < HOURS; h++) {
    const supply = 25 + 10 * Math.min(1, Math.max(0, (15 - w.temp[h]) / 25));
    const src = brine(h) - 3;
    copRaw[h] = (supply + 5 + 273.15) / (supply + 5 - src);
    copDhwRaw[h] = (55 + 5 + 273.15) / (55 + 5 - src);
  }

  const appliance: Float32Array[] = [], heat: Float32Array[] = [], hp: Float32Array[] = [];
  let heatAll = 0, elRaw = 0;
  const rooms = new Float32Array(HOURS), water = new Float32Array(HOURS);
  for (let h = 0; h < HOURS; h++) {
    rooms[h] = roomsPerDegH * Math.max(0, 15 - tEff[h]);
    water[h] = (spec.heatPerHome * spec.dhwShare / 365) * DHW_SHAPE[loc[h].hour] / dhwSum;
  }
  for (let k = 0; k < spec.homes; k++) {
    const size = 0.8 + 0.4 * hash(k, 3);            // household size and habits
    const shift = Math.round((hash(k, 5) - 0.5) * 2.4);
    const insul = 0.9 + 0.2 * hash(k, 7);            // exposure and room temperature
    const a = new Float32Array(HOURS), q = new Float32Array(HOURS);
    let s = 0;
    for (let h = 0; h < HOURS; h++) { a[h] = rhythm(h, shift); s += a[h]; }
    const scale = (spec.elPerHome * size) / s;
    for (let h = 0; h < HOURS; h++) {
      a[h] *= scale;
      q[h] = rooms[h] * insul + water[(h + shift + HOURS) % HOURS] * size;
      heatAll += q[h];
      elRaw += rooms[h] * insul / copRaw[h] + water[(h + shift + HOURS) % HOURS] * size / copDhwRaw[h];
    }
    appliance.push(a);
    heat.push(q);
  }
  // one efficiency factor for the whole field, so heat / electricity over the year = the budget's SCOP
  const eta = spec.scop > 1 ? (spec.scop * elRaw) / heatAll : 0;
  const cop = new Float32Array(HOURS);
  for (let h = 0; h < HOURS; h++) cop[h] = spec.scop > 1 ? eta * copRaw[h] : 1;
  for (let k = 0; k < spec.homes; k++) {
    const e = new Float32Array(HOURS);
    const shift = Math.round((hash(k, 5) - 0.5) * 2.4);
    const size = 0.8 + 0.4 * hash(k, 3), insul = 0.9 + 0.2 * hash(k, 7);
    for (let h = 0; h < HOURS; h++) {
      if (spec.scop <= 1) { e[h] = heat[k][h]; continue; }
      e[h] = rooms[h] * insul / (eta * copRaw[h]) + water[(h + shift + HOURS) % HOURS] * size / (eta * copDhwRaw[h]);
    }
    hp.push(e);
  }

  // office and workshop: working hours on weekdays, a base load otherwise, more in the dark months
  const work = (kwh: number, open: [number, number], base: number, wkend: number, winter: number) => {
    const out = new Float32Array(HOURS);
    let s = 0;
    for (let h = 0; h < HOURS; h++) {
      const l = loc[h];
      const weekday = l.weekday < 5;
      const v = weekday ? (l.hour >= open[0] && l.hour < open[1] ? 1 : l.hour === open[0] - 1 || l.hour === open[1] ? 0.6 : base) : wkend;
      out[h] = v * (1 + winter * Math.cos((2 * Math.PI * (doy(h) - 15)) / 365));
      s += out[h];
    }
    for (let h = 0; h < HOURS; h++) out[h] *= kwh / s;
    return out;
  };
  return {
    appliance, heat, hp, cop,
    office: work(spec.officeKwh, [7, 17], 0.32, 0.3, 0.22),
    workshop: work(spec.workshopKwh, [7, 16], 0.22, 0.2, 0.3),
  };
}
