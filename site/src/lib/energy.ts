/**
 * The living-field model: a transparent, deterministic estimate per plot from the real terrain
 * horizon and the sun. Live meter frames with the same shape can replace it later.
 */
import type { EnergyFrame, Plot } from "./types";
import { solarPosition, knottenTime } from "./solar";
import { BUDGET, PV_KWP_PER_HOME } from "./facts";

const KWP = PV_KWP_PER_HOME;               // per home: 279 kWp for 1 200 m² of roof in the energy budget, 30 m² per home
const BATTERY = BUDGET.battery.per_home_kwh; // kWh per home, the energy budget's chosen input
const HUB = 400;          // kWh shared, provisional

function loadProfile(hour: number, month: number) {
  // kW: morning and evening peaks, winter heating adds a base
  const winter = month <= 2 || month >= 11 ? 1.0 : month <= 4 || month >= 9 ? 0.6 : 0.3;
  const base = 0.35 + 0.9 * winter;
  const morning = Math.exp(-((hour - 7.5) ** 2) / 2.2) * 1.4;
  const evening = Math.exp(-((hour - 18.5) ** 2) / 3.0) * 2.0;
  return base + morning + evening;
}

export function pvForPlot(plot: Plot, date: Date) {
  const { elevation, azimuth } = solarPosition(date);
  if (elevation <= 0) return 0;
  const hz = plot.horizon_deg_by_bearing[Math.round(azimuth) % 360] ?? 0;
  if (elevation < hz + 0.25) return 0;                    // behind the ridge: measured, not guessed
  const facing = plot.house.facing_deg;                   // roof pitch faces downhill
  const cosInc = Math.max(0, Math.sin((elevation * Math.PI) / 180) * Math.cos((35 * Math.PI) / 180)
    + Math.cos((elevation * Math.PI) / 180) * Math.sin((35 * Math.PI) / 180) * Math.cos(((azimuth - facing) * Math.PI) / 180));
  const clearness = 0.75;
  return +(KWP * cosInc * clearness).toFixed(2);
}

export function frameFor(plots: Plot[], month: number, day: number, hourLocal: number, opts?: { outage?: boolean }): EnergyFrame {
  const date = knottenTime(2026, month, day, hourLocal);
  const out: EnergyFrame = { ts: date.toISOString(), plots: {}, field: { import_kw: 0, export_kw: 0, soc: 0, pv_kw: 0, load_kw: 0 }, source: "model" };
  // state of charge: a simple diurnal curve, full late afternoon in summer, low before dawn in winter
  const season = month >= 5 && month <= 8 ? 1 : month <= 2 || month >= 11 ? 0.35 : 0.65;
  const socBase = 0.35 + 0.5 * season * Math.max(0, Math.sin(((hourLocal - 6) / 24) * Math.PI));
  const soc = opts?.outage ? Math.max(0.05, socBase - 0.3) : socBase;
  const surplus: { id: string; kw: number }[] = [];
  const deficit: { id: string; kw: number }[] = [];
  for (const p of plots) {
    const pv = pvForPlot(p, date);
    const load = +loadProfile(hourLocal, month).toFixed(2);
    out.plots[p.id] = { pv_kw: pv, load_kw: load, soc, sharing_to: [] };
    out.field.pv_kw += pv;
    out.field.load_kw += load;
    const net = pv - load;
    if (net > 0.2) surplus.push({ id: p.id, kw: net });
    else if (net < -0.2) deficit.push({ id: p.id, kw: -net });
  }
  // pair surplus homes with deficit homes: this is the "sharing" the overlay animates
  let di = 0;
  for (const s of surplus) {
    let left = s.kw;
    while (left > 0.05 && di < deficit.length) {
      const d = deficit[di];
      const kw = Math.min(left, d.kw);
      out.plots[s.id].sharing_to.push({ plot: d.id, kw: +kw.toFixed(2) });
      left -= kw; d.kw -= kw;
      if (d.kw <= 0.05) di++;
    }
  }
  const net = out.field.pv_kw - out.field.load_kw;
  out.field.soc = soc;
  out.field.import_kw = opts?.outage ? 0 : Math.max(0, -net);
  out.field.export_kw = Math.max(0, net);
  out.field.pv_kw = +out.field.pv_kw.toFixed(1);
  out.field.load_kw = +out.field.load_kw.toFixed(1);
  return out;
}

export const CAPACITY = { KWP, BATTERY, HUB };
