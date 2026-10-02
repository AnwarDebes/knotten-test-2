/**
 * The portal's energy figures, on the same model as the energy simulator (src/lib/sim): each roof's
 * real pitch, direction and horizon, the Perez sky model and the PVGIS module model for the panels,
 * the energy budget's use in the rhythm of real NO2 households, and the heat pumps on the borehole
 * field. The functions keep their old names and shapes, so the portal pages did not change.
 *
 *   pvForPlot   a plot's solar power at an instant under a typical sky (0.75 of a clear sky), kW
 *   loadProfile a home's average use at a local hour in a month (household and heat pump), kW
 *   homeLoad    the same for one particular home (homes differ in size and rhythm), kW
 *   frameFor    one moment of the simulated year, as the 3D overlay and the charts read it
 */
import type { EnergyFrame, Plot } from "./types";
import { solarPosition } from "./solar";
import { PV_KWP_PER_HOME, BUDGET } from "./facts";
import energy from "../../public/twin/energy.json";
import plotsFile from "../../public/data/plots.json";
import { weatherOf, hourOf, localOf, HOURS, type EnergyInputs } from "./sim/inputs";
import { panelSeries, preparePanel, panelHour, sunTable, annualYield } from "./sim/pv";
import { runYear, type YearResult } from "./sim/run";
import { BASE, BUDGET_SCENARIO, homesOf } from "./sim/scenario";

const KWP = PV_KWP_PER_HOME;
const BATTERY = BUDGET.battery.per_home_kwh;
const HUB = 400;
const inputs = energy as unknown as EnergyInputs;
const YEAR = inputs.year;
const D2R = Math.PI / 180;

let calibration: number | null = null;
function pvCalibration() {
  if (calibration === null) {
    const w = weatherOf(inputs);
    const ref = annualYield(panelSeries(w, sunTable(YEAR), { tilt: 35, azimuth: 180 }));
    calibration = inputs.pvgis_kwh_per_kwp["35/0"] / ref;
  }
  return calibration;
}

/** Clear-sky light for a sun position: Haurwitz for the total, Meinel for the direct beam. */
function clearSky(elevation: number, doy: number) {
  if (elevation <= 0) return { ghi: 0, dni: 0, dhi: 0 };
  const cz = Math.sin(elevation * D2R);
  const I0 = 1367 * (1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365));
  const ghi = 1098 * cz * Math.exp(-0.057 / cz);
  const am = 1 / (cz + 0.50572 * Math.pow(elevation + 6.07995, -1.6364));
  const dni = Math.min(I0 * Math.pow(0.7, Math.pow(am, 0.678)), ghi / Math.max(cz, 0.02));
  return { ghi, dni, dhi: Math.max(0, ghi - dni * cz) };
}

const panels = new WeakMap<Plot, ReturnType<typeof preparePanel>>();

/** A plot's solar power (kW) at an instant under a typical sky, 0.75 of a clear sky (as before). */
export function pvForPlot(plot: Plot, date: Date) {
  const { elevation, azimuth } = solarPosition(date);
  if (elevation <= 0) return 0;
  const doy = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1;
  const sky = clearSky(elevation, doy);
  // the plot's own roof and horizon, through the same panel model as the simulator (12 C, light wind)
  let panel = panels.get(plot);
  if (!panel) panels.set(plot, (panel = preparePanel(homesOf([plot])[0])));
  const kw = panelHour(panel, sky.ghi, sky.dni, sky.dhi, (90 - elevation) * D2R, azimuth, elevation, doy, 12, 3).kw;
  return +(KWP * kw * pvCalibration() * 0.75).toFixed(2);
}

// the simulated year (the energy budget's scenario), computed once per server process
let year: { plotsKey: string; r: YearResult } | null = null;
function yearFor(plots: Plot[]) {
  const key = plots.map((p) => p.id).join(",");
  if (!year || year.plotsKey !== key) year = { plotsKey: key, r: runYear(inputs, weatherOf(inputs), homesOf(plots), BUDGET_SCENARIO, BASE) };
  return year.r;
}

// average use by month and local hour, per home and for the average home (kW)
let loads: { perHome: number[][][]; mean: number[][] } | null = null;
function loadTables(plots?: Plot[]) {
  if (loads) return loads;
  const r = yearFor(plots ?? defaultPlots());
  const n = r.homes;
  const sum = Array.from({ length: n }, () => Array.from({ length: 12 }, () => new Array(24).fill(0)));
  const cnt = Array.from({ length: 12 }, () => new Array(24).fill(0));
  for (let h = 0; h < HOURS; h++) {
    const l = localOf(YEAR, h);
    cnt[l.month - 1][l.hour]++;
    for (let k = 0; k < n; k++) sum[k][l.month - 1][l.hour] += r.load[k][h];
  }
  const perHome = sum.map((m) => m.map((row, mi) => row.map((v, hi) => v / Math.max(1, cnt[mi][hi]))));
  const mean = Array.from({ length: 12 }, (_, mi) => Array.from({ length: 24 }, (_, hi) => perHome.reduce((a, p) => a + p[mi][hi], 0) / n));
  loads = { perHome, mean };
  return loads;
}

// the plots file, for callers that pass none (loadProfile)
function defaultPlots() { return (plotsFile as unknown as { plots: Plot[] }).plots; }

/** A home's average use (kW) at a local hour in a month: household electricity and the heat pump. */
export function loadProfile(hour: number, month: number) {
  return loadTables().mean[Math.min(12, Math.max(1, month)) - 1][Math.min(23, Math.max(0, Math.floor(hour)))];
}

/** The same for one particular home: homes differ in size, habits and rhythm, as households do. */
export function homeLoad(hour: number, month: number, home: number) {
  const t = loadTables();
  const k = ((home % t.perHome.length) + t.perHome.length) % t.perHome.length;
  return t.perHome[k][Math.min(12, Math.max(1, month)) - 1][Math.min(23, Math.max(0, Math.floor(hour)))];
}

/** One moment of the simulated year (the 21st of the month at a local hour, by default). */
export function frameFor(plots: Plot[], month: number, day: number, hourLocal: number, opts?: { outage?: boolean }): EnergyFrame {
  const r = yearFor(plots);
  const h = hourOf(YEAR, month, day, Math.floor(hourLocal));
  const out: EnergyFrame = { ts: new Date(Date.UTC(YEAR, 0, 1) + h * 3600e3).toISOString(), plots: {}, field: { import_kw: 0, export_kw: 0, soc: r.field.soc[h], pv_kw: 0, load_kw: 0 }, source: "model" };
  const givers: { id: string; kw: number }[] = [], takers: { id: string; kw: number }[] = [];
  plots.forEach((p, k) => {
    out.plots[p.id] = { pv_kw: +r.pv[k][h].toFixed(2), load_kw: +r.load[k][h].toFixed(2), soc: r.soc[k][h], sharing_to: [] };
    if (r.share[k][h] < -0.05) givers.push({ id: p.id, kw: -r.share[k][h] });
    if (r.share[k][h] > 0.05) takers.push({ id: p.id, kw: r.share[k][h] });
  });
  let ti = 0;
  for (const g of givers) {
    let left = g.kw;
    while (left > 0.05 && ti < takers.length) {
      const t = takers[ti];
      const kw = Math.min(left, t.kw);
      out.plots[g.id].sharing_to.push({ plot: t.id, kw: +kw.toFixed(2) });
      left -= kw; t.kw -= kw;
      if (t.kw <= 0.05) ti++;
    }
  }
  const F = r.field;
  out.field.pv_kw = +(F.pvRoofs[h] + F.pvOffice[h] + F.park[h] + F.wind[h]).toFixed(1);
  out.field.load_kw = +(F.homes[h] + F.heatPumps[h] + F.office[h]).toFixed(1);
  out.field.import_kw = opts?.outage ? 0 : +F.imp[h].toFixed(1);
  out.field.export_kw = +F.exp[h].toFixed(1);
  return out;
}

export const CAPACITY = { KWP, BATTERY, HUB };
