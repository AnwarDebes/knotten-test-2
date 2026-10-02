/// <reference lib="webworker" />
/**
 * Runs the year of the energy simulation off the page's main thread and sends the typed arrays
 * back (transferred, not copied).
 */
import { weatherOf, type EnergyInputs, type Weather } from "./inputs";
import { runYear, type HomeSpec, type Scenario } from "./run";

type Job = { id: number; homes: HomeSpec[]; scenario: Scenario; base: { elPerHome: number; heatPerHome: number; officeKwh: number; workshopKwh: number }; origin: string };

let inputs: EnergyInputs | null = null;
let weather: Weather | null = null;

self.onmessage = async (e: MessageEvent<Job>) => {
  const { id, homes, scenario, base, origin } = e.data;
  try {
    if (!inputs) {
      const res = await fetch(new URL("/twin/energy.json", origin));
      inputs = (await res.json()) as EnergyInputs;
      weather = weatherOf(inputs);
    }
    const r = runYear(inputs, weather!, homes, scenario, base);
    const buffers: ArrayBuffer[] = [];
    const take = (a: Float32Array) => { buffers.push(a.buffer as ArrayBuffer); return a; };
    // the per-home and field series are fresh arrays per run; weather series are copied, not moved
    r.pv.forEach(take); r.load.forEach(take); r.soc.forEach(take); r.share.forEach(take);
    const f = r.field;
    [f.pvRoofs, f.pvOffice, f.park, f.homes, f.heatPumps, f.office, f.charge, f.discharge, f.imp, f.exp, f.shared, f.soc, f.buy, f.sell].forEach(take);
    const copy = { ...r, appliance: r.appliance.map((a) => a.slice()), field: { ...f, wind: f.wind.slice(), temp: f.temp.slice(), ghi: f.ghi.slice(), wind10: f.wind10.slice(), cop: f.cop.slice() } };
    (self as unknown as Worker).postMessage({ id, result: copy, inputs: { year: inputs.year, sources: inputs.sources, park: inputs.park, pvgis: inputs.pvgis_kwh_per_kwp, tmy_months: inputs.tmy_months } }, buffers);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
