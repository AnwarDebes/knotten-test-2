/**
 * The energy budget's scenario and inputs, and the homes' roof planes, shared by the page-side
 * simulator (useSim) and the server-side portal figures (src/lib/energy.ts).
 */
import type { Plot } from "../types";
import { BUDGET } from "../facts";
import type { HomeSpec, Scenario } from "./run";

/** The budget's own inputs: homes, heat, office and workshop use (src/lib/facts). */
export const BASE = { elPerHome: BUDGET.el_per_home_kwh, heatPerHome: BUDGET.heat_per_home_kwh, officeKwh: BUDGET.office_kwh, workshopKwh: BUDGET.storage_kwh };

const PV_PER_HOME = (BUDGET.pv.roof_per_home_m2 * BUDGET.pv.usable_pct * BUDGET.pv.module_eff_pct) / 10000;

/** The energy budget's scenario: its panels, turbines, batteries and prices; sharing in the field. */
export const BUDGET_SCENARIO: Scenario = {
  pvPerHomeKwp: PV_PER_HOME,
  officePvKwp: BUDGET.pv.installed_kwp - BUDGET.homes * PV_PER_HOME,
  parkKwp: 0,
  windKw: BUDGET.wind.installed_kw,
  windSiteFactor: 1,
  batteryKwh: BUDGET.battery.per_home_kwh,
  batteryKw: 5,
  reserve: 0.3,
  sharing: true,
  prices: "budget",
  scop: BUDGET.bedrock.scop,
};

/** Roof planes of the homes, from plots.json: the slope that faces the view carries the panels. */
export function homesOf(plots: Plot[]): HomeSpec[] {
  return plots.map((p) => ({
    id: p.id,
    tilt: (Math.atan((p.house.ridge_m - p.house.eaves_m) / (p.house.depth_m / 2)) * 180) / Math.PI,
    azimuth: p.house.facing_deg,
    horizon: p.horizon_deg_by_bearing,
  }));
}
