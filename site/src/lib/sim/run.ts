/**
 * The field, hour by hour through a whole year: what each home's roof makes, what each home uses,
 * how the batteries and the neighbours even it out, and what goes to and from the grid.
 *
 * Order each hour: a home uses its own solar power first. With sharing on (the field as one
 * community on the same property), what one home has left covers what another lacks, together with
 * the office's panels, the shared plant and the turbines; what is still left charges the batteries,
 * then goes to the grid. What is still missing comes from the batteries, then from the grid. With
 * sharing off, every home is on its own and the shared plant and turbines sell to the grid.
 */
import { HOURS, type EnergyInputs, type Weather, localOf } from "./inputs";
import { panelSeries, windSeries, sunTable, annualYield, type Sun } from "./pv";
import { buildLoads, type Loads } from "./loads";

export type HomeSpec = { id: string; tilt: number; azimuth: number; horizon: number[] };

export type Scenario = {
  pvPerHomeKwp: number;
  officePvKwp: number;
  parkKwp: number;
  windKw: number;
  windSiteFactor: number;
  batteryKwh: number;
  batteryKw: number;
  reserve: number;          // share of each battery kept back for a power cut (topped up from the grid)
  sharing: boolean;
  prices: "budget" | "spot2025";
  scop: number;
};

export type Prices = { buyFixed: number; sellFixed: number; gridFee: number; co2: number };

export type YearResult = {
  scenario: Scenario;
  homes: number;
  // per home, per hour
  pv: Float32Array[]; load: Float32Array[]; appliance: Float32Array[]; soc: Float32Array[]; share: Float32Array[];
  // field, per hour (kW)
  field: {
    pvRoofs: Float32Array; pvOffice: Float32Array; park: Float32Array; wind: Float32Array;
    homes: Float32Array; heatPumps: Float32Array; office: Float32Array;
    charge: Float32Array; discharge: Float32Array; imp: Float32Array; exp: Float32Array; shared: Float32Array;
    soc: Float32Array; buy: Float32Array; sell: Float32Array; temp: Float32Array; ghi: Float32Array; wind10: Float32Array; cop: Float32Array;
  };
  totals: Totals;
  monthly: { prod: number[]; use: number[]; imp: number[]; exp: number[]; selfUse: number[] };
  yieldPerKwp: { roofsMean: number; best: number; worst: number; office: number; park: number; pvgisSouth35: number; calibration: number };
};

export type Totals = {
  production: number; pvRoofs: number; pvOffice: number; park: number; wind: number;
  demand: number; homesEl: number; heatPumpEl: number; heat: number; office: number;
  imp: number; exp: number; shared: number; batteryOut: number;
  selfSufficiency: number; selfConsumption: number;
  cost: number; refCost: number; saving: number; savingPerHome: number;
  co2Saved: number; refDemand: number;
};

export const BUDGET_PRICES: Prices = { buyFixed: 2.1, sellFixed: 0.75, gridFee: 0.1, co2: 0.2 };

type Cache = { sun: Sun; homes: Float32Array[]; office: Float32Array; park: Float32Array; parkYield: number; officeYield: number; calibration: number; loads: Map<string, Loads> };
const caches = new WeakMap<EnergyInputs, Cache>();

/** Per-kWp series and loads are computed once per input set and reused for every scenario. */
function cacheFor(inputs: EnergyInputs, w: Weather, homes: HomeSpec[]): Cache {
  let c = caches.get(inputs);
  if (c && c.homes.length === homes.length) return c;
  const sun = sunTable(inputs.year);
  // calibrate to PVGIS: the model's 1 kWp due south at 35 degrees, no horizon, against PVGIS's own yield
  // for this spot (long-term average, 14 % losses); every panel series is scaled by the same factor
  const ref = annualYield(panelSeries(w, sun, { tilt: 35, azimuth: 180 }));
  const calibration = inputs.pvgis_kwh_per_kwp["35/0"] / ref;
  const scale = (a: Float32Array) => { for (let i = 0; i < a.length; i++) a[i] *= calibration; return a; };
  const homeSeries = homes.map((h) => scale(panelSeries(w, sun, { tilt: h.tilt, azimuth: h.azimuth, horizon: h.horizon }).kw));
  const office = scale(panelSeries(w, sun, { tilt: inputs.office_roof.tilt, azimuth: inputs.office_roof.azimuth, horizon: inputs.office_roof.horizon }).kw);
  const park = scale(panelSeries(w, sun, { tilt: 30, azimuth: 180, horizon: inputs.park.horizon }).kw);
  c = { sun, homes: homeSeries, office, park, parkYield: annualYield({ kw: park }), officeYield: annualYield({ kw: office }), calibration, loads: new Map() };
  caches.set(inputs, c);
  return c;
}

export function runYear(inputs: EnergyInputs, w: Weather, homes: HomeSpec[], sc: Scenario, base: { elPerHome: number; heatPerHome: number; officeKwh: number; workshopKwh: number }, prices = BUDGET_PRICES): YearResult {
  const n = homes.length;
  const c = cacheFor(inputs, w, homes);
  const lkey = `${sc.scop}|${n}`;
  let L = c.loads.get(lkey);
  if (!L) {
    L = buildLoads(inputs.year, w, { homes: n, elPerHome: base.elPerHome, heatPerHome: base.heatPerHome, dhwShare: 0.2, scop: sc.scop, officeKwh: base.officeKwh, workshopKwh: base.workshopKwh });
    c.loads.set(lkey, L);
  }
  const wind = sc.windKw > 0 ? windSeries(w, { kw: sc.windKw, hub: 18, siteFactor: sc.windSiteFactor, availability: 0.8 }) : new Float32Array(HOURS);

  const cap = sc.batteryKwh, pmax = sc.batteryKw, socMax = 0.95 * cap;
  const keep = Math.max(0.05, Math.min(0.9, sc.reserve)) * cap;  // the outage reserve is not used day to day
  const socMin = keep;
  const ec = Math.sqrt(0.9), ed = Math.sqrt(0.9);   // 90 % round trip, as in the budget
  const soc = new Float32Array(n).fill(Math.max(keep, cap * 0.5));
  const pv = homes.map(() => new Float32Array(HOURS)), load = homes.map(() => new Float32Array(HOURS));
  const socS = homes.map(() => new Float32Array(HOURS)), share = homes.map(() => new Float32Array(HOURS));
  const F = {
    pvRoofs: new Float32Array(HOURS), pvOffice: new Float32Array(HOURS), park: new Float32Array(HOURS), wind,
    homes: new Float32Array(HOURS), heatPumps: new Float32Array(HOURS), office: new Float32Array(HOURS),
    charge: new Float32Array(HOURS), discharge: new Float32Array(HOURS), imp: new Float32Array(HOURS), exp: new Float32Array(HOURS), shared: new Float32Array(HOURS),
    soc: new Float32Array(HOURS), buy: new Float32Array(HOURS), sell: new Float32Array(HOURS),
    temp: w.temp, ghi: w.ghi, wind10: w.wind, cop: L.cop,
  };
  const surplus = new Float64Array(n), deficit = new Float64Array(n);
  let cost = 0, refCost = 0, refDemand = 0;
  const monthly = { prod: Array(12).fill(0), use: Array(12).fill(0), imp: Array(12).fill(0), exp: Array(12).fill(0), selfUse: Array(12).fill(0) };

  for (let h = 0; h < HOURS; h++) {
    const buy = sc.prices === "budget" ? prices.buyFixed : w.price[h] + prices.gridFee;
    const sell = sc.prices === "budget" ? prices.sellFixed : Math.max(0, w.price[h]);
    F.buy[h] = buy; F.sell[h] = sell;
    let S = 0, D = 0;
    for (let k = 0; k < n; k++) {
      const g = c.homes[k][h] * sc.pvPerHomeKwp;
      const l = L.appliance[k][h] + L.hp[k][h];
      pv[k][h] = g; load[k][h] = l;
      const own = Math.min(g, l);
      surplus[k] = g - own; deficit[k] = l - own;
      S += surplus[k]; D += deficit[k];
      F.pvRoofs[h] += g; F.homes[h] += L.appliance[k][h]; F.heatPumps[h] += L.hp[k][h];
      refDemand += L.appliance[k][h] + L.heat[k][h];
      refCost += (L.appliance[k][h] + L.heat[k][h]) * buy;
    }
    const og = c.office[h] * sc.officePvKwp, ol = L.office[h] + L.workshop[h];
    const parkG = c.park[h] * sc.parkKwp;
    F.pvOffice[h] = og; F.park[h] = parkG; F.office[h] = ol;
    refDemand += ol; refCost += ol * buy;
    const oOwn = Math.min(og, ol);
    let oSur = og - oOwn, oDef = ol - oOwn;
    let community = parkG + wind[h];
    let imp = 0, exp = 0, shared = 0, chg = 0, dis = 0;

    if (sc.sharing) {
      // 1) neighbours: every surplus in the field meets every need in the field
      const supply = S + oSur + community, need = D + oDef;
      shared = Math.min(supply, need);
      const fs = supply > 0 ? shared / supply : 0, fn = need > 0 ? shared / need : 0;
      for (let k = 0; k < n; k++) { share[k][h] = deficit[k] * fn - surplus[k] * fs; surplus[k] *= 1 - fs; deficit[k] *= 1 - fn; }
      oSur *= 1 - fs; oDef *= 1 - fn; community *= 1 - fs;
      // 2) what is left charges the batteries, pooled
      let left = S * (1 - fs) + oSur + community;
      if (left > 0 && cap > 0) {
        let room = 0;
        for (let k = 0; k < n; k++) room += Math.min(pmax, (socMax - soc[k]) / ec);
        const take = Math.min(left, room);
        if (room > 0) for (let k = 0; k < n; k++) { const r = Math.min(pmax, (socMax - soc[k]) / ec); const x = take * (r / room); soc[k] += x * ec; }
        chg = take; left -= take;
      }
      exp = left;
      // 3) what is still missing comes from the batteries, pooled, then the grid
      let miss = D * (1 - fn) + oDef;
      if (miss > 0 && cap > 0) {
        let avail = 0;
        for (let k = 0; k < n; k++) avail += Math.min(pmax, (soc[k] - socMin) * ed);
        const give = Math.min(miss, avail);
        if (avail > 0) for (let k = 0; k < n; k++) { const a = Math.min(pmax, (soc[k] - socMin) * ed); const x = give * (a / avail); soc[k] -= x / ed; }
        dis = give; miss -= give;
      }
      imp = miss;
    } else {
      for (let k = 0; k < n; k++) {
        let s = surplus[k], d = deficit[k];
        if (s > 0 && cap > 0) { const x = Math.min(s, pmax, (socMax - soc[k]) / ec); soc[k] += x * ec; chg += x; s -= x; }
        if (d > 0 && cap > 0) { const x = Math.min(d, pmax, (soc[k] - socMin) * ed); soc[k] -= x / ed; dis += x; d -= x; }
        exp += s; imp += d;
      }
      exp += oSur + community; imp += oDef;
    }
    // keep the outage reserve topped up from the grid (after a power cut, or if the year starts low)
    if (cap > 0) for (let k = 0; k < n; k++) {
      if (soc[k] < keep - 1e-6) { const x = Math.min(pmax, (keep - soc[k]) / ec); soc[k] += x * ec; imp += x; }
    }
    let socSum = 0;
    for (let k = 0; k < n; k++) { socS[k][h] = cap > 0 ? soc[k] / cap : 0; socSum += socS[k][h]; }
    F.soc[h] = n ? socSum / n : 0;
    F.imp[h] = imp; F.exp[h] = exp; F.shared[h] = shared; F.charge[h] = chg; F.discharge[h] = dis;
    cost += imp * buy - exp * sell;
    const m = localOf(inputs.year, h).month - 1;
    const prod = F.pvRoofs[h] + og + parkG + wind[h];
    const use = F.homes[h] + F.heatPumps[h] + ol;
    monthly.prod[m] += prod; monthly.use[m] += use; monthly.imp[m] += imp; monthly.exp[m] += exp; monthly.selfUse[m] += prod - exp;
  }

  const sum = (a: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
  const pvRoofs = sum(F.pvRoofs), pvOffice = sum(F.pvOffice), park = sum(F.park), windE = sum(wind);
  const production = pvRoofs + pvOffice + park + windE;
  const homesEl = sum(F.homes), heatPumpEl = sum(F.heatPumps), office = sum(F.office);
  const demand = homesEl + heatPumpEl + office;
  const imp = sum(F.imp), exp = sum(F.exp);
  let heat = 0;
  for (let k = 0; k < n; k++) heat += sum(L.heat[k]);
  const yields = c.homes.map((s) => annualYield({ kw: s }));
  const totals: Totals = {
    production, pvRoofs, pvOffice, park, wind: windE,
    demand, homesEl, heatPumpEl, heat, office,
    imp, exp, shared: sum(F.shared), batteryOut: sum(F.discharge),
    selfSufficiency: demand > 0 ? 1 - imp / demand : 0,
    selfConsumption: production > 0 ? 1 - exp / production : 0,
    cost, refCost, saving: refCost - cost, savingPerHome: n ? (refCost - cost) / n : 0,
    co2Saved: Math.max(0, refDemand - imp) * prices.co2, refDemand,
  };
  return {
    scenario: sc, homes: n, pv, load, appliance: L.appliance, soc: socS, share, field: F, totals, monthly,
    yieldPerKwp: {
      roofsMean: yields.reduce((a, b) => a + b, 0) / Math.max(1, yields.length),
      best: Math.max(...yields), worst: Math.min(...yields),
      office: c.officeYield, park: c.parkYield, pvgisSouth35: inputs.pvgis_kwh_per_kwp["35/0"], calibration: c.calibration,
    },
  };
}

/**
 * A power cut from hour `start`, `hours` long: the field on its own panels and batteries. With
 * `essential` on, homes cut to what matters (heat pump at half, a third of the rest). Returns, per
 * hour, which homes still have power, their state of charge, and what could not be supplied.
 */
export function outage(y: YearResult, start: number, hours: number, essential: boolean, emergencyKwh = 0) {
  const n = y.homes, sc = y.scenario;
  let reserve = emergencyKwh * 0.95;           // the shared emergency battery, kept full for this
  const cap = sc.batteryKwh, pmax = sc.batteryKw, socMin = 0.05 * cap;
  const ed = Math.sqrt(0.9), ec = Math.sqrt(0.9);
  const soc = Array.from({ length: n }, (_, k) => y.soc[k][Math.max(0, start - 1)] * cap);
  const on: Uint8Array[] = [], socOut: Float32Array[] = [];
  let unserved = 0, firstDark = -1;
  for (let t = 0; t < hours; t++) {
    const h = (start + t) % HOURS;
    const row = new Uint8Array(n), srow = new Float32Array(n);
    const g = y.pv.map((p) => p[h]);
    const l = y.load.map((x, k) => {
      if (!essential) return x[h];
      // essential: the heat pump at half, a third of everything else (light, fridge, router, cooking)
      const app = y.appliance[k][h];
      return 0.5 * Math.max(0, x[h] - app) + 0.33 * app;
    });
    const extra = (y.field.park[h] + y.field.wind[h] + y.field.pvOffice[h]) * (sc.sharing ? 1 : 0);
    let pool = sc.sharing ? extra : 0;
    // own panels first
    const need = new Float64Array(n), left = new Float64Array(n);
    for (let k = 0; k < n; k++) { const own = Math.min(g[k], l[k]); need[k] = l[k] - own; left[k] = g[k] - own; }
    if (sc.sharing) {
      for (let k = 0; k < n; k++) pool += left[k];
      for (let k = 0; k < n; k++) { const x = Math.min(need[k], pool); need[k] -= x; pool -= x; }
      // spare power charges batteries
      for (let k = 0; k < n && pool > 0; k++) { const x = Math.min(pool, pmax, (0.95 * cap - soc[k]) / ec); soc[k] += x * ec; pool -= x; }
      // batteries cover what is missing, shared across the field
      for (let k = 0; k < n; k++) {
        let d = need[k];
        for (let j = 0; j < n && d > 0; j++) {
          const j2 = (k + j) % n;
          const x = Math.min(d, pmax, (soc[j2] - socMin) * ed);
          if (x > 0) { soc[j2] -= x / ed; d -= x; }
        }
        // the shared emergency battery, last
        if (d > 0 && reserve > 0) { const x = Math.min(d, reserve * ed); reserve -= x / ed; d -= x; }
        need[k] = d;
      }
    } else {
      for (let k = 0; k < n; k++) {
        if (left[k] > 0) { const x = Math.min(left[k], pmax, (0.95 * cap - soc[k]) / ec); soc[k] += x * ec; }
        const x = Math.min(need[k], pmax, (soc[k] - socMin) * ed);
        soc[k] -= Math.max(0, x) / ed;
        need[k] -= Math.max(0, x);
      }
    }
    for (let k = 0; k < n; k++) {
      row[k] = need[k] > 0.05 ? 0 : 1;
      unserved += Math.max(0, need[k]);
      srow[k] = cap > 0 ? soc[k] / cap : 0;
    }
    if (firstDark < 0 && row.some((v) => v === 0)) firstDark = t;
    on.push(row); socOut.push(srow);
  }
  const litAtEnd = on.length ? on[on.length - 1].reduce((a, b) => a + b, 0) : n;
  return { on, soc: socOut, unserved, firstDark, litAtEnd, emergencyLeft: reserve };
}
