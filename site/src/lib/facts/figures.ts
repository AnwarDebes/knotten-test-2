import { BUDGET, EED, OFFICES, SHARED_PANELS, STATUS_SOLAR } from "./energy";
import type { SourceId } from "./sources";

/**
 * The headline figures, once, for both designs. Moderne shows them as figure cards (ASSUMPTIONS,
 * `assumption()`), Klassisk as the "Kilder og forutsetninger" table (FIGURES). Both lists read the
 * same values below, so a figure changed here changes in both designs. Checked against
 * knotten-source-informations on 27 September 2026.
 */
export const FACT = {
  plots: 30, // the owner: "rundt 30 tomter"
  rows: 4, // the project group, 27 September 2026; the model's layout v6 (30 September 2026) has the same four rows, A to D
  gnr: 355,
  bnr: 10,
  bnr_extra: 368,
  parcel_bnr10_m2: 39431,
  parcel_m2: 40181, // gnr 355 bnr 10 and bnr 368, the owner's email
  road_grade_pct: 6, // the owner's sketch
  profile_m: 409.5, // the owner's Norgeskart profile, 0 to 60 moh
  knotten_m: 60, // about: the profile ends at Knotten at 60 moh; Kartverket's point for Knotten gives 57.8 m
  lokkeheia_m: 88.5, // label on the owner's maps
  lat: "58.068057", // the project group, 4 September 2026
  lon: "7.278401",
  property_address: "Rødbergsveien 121", // the Norgeskart property card for gnr 355 bnr 10
  postcode: "4520 Lindesnes",
  offices_now: OFFICES.now,
  offices_after: OFFICES.after,
  panels: SHARED_PANELS, // a capacity scenario, not a confirmed solar area
  audna_km: 55,
  fjord_km: 3, // about
  vigeland_pop: 1673, // SSB, 1 January 2026
  vigeland_pop_year: 2026,
  // computed by the website's model for the provisional layout proposal (not a source)
  sea_corridor_deg: 26,
  open_sea_plots: 30,
  trees_detected: 31823,
  trees_cleared: 1028,
};

const nb = (n: number) => n.toLocaleString("nb-NO");
const about = (n: number, step: number) => `ca. ${nb(Math.round(n / step) * step)}`;

/** Moderne's figure cards. */
export type Assumption = {
  key: string;
  value: number;
  unit: string;
  low?: number;
  high?: number;
  source: string;
  date: string;
  provisional?: boolean;
  label: { no: string; en: string };
};

export const ASSUMPTIONS_VERSION = "2026-09-30 (foreløpig)";

const BUDGET_DOC = "Energiregnskapet, energisporet";
const MODEL = "nettsidens modell";

/** Solar per home in the energy budget: 30 m² of roof, 75 % used, 31 % modules, so about 7 kWp. */
export const PV_KWP_PER_HOME = Math.round((BUDGET.pv.roof_per_home_m2 * BUDGET.pv.usable_pct * BUDGET.pv.module_eff_pct) / 10000);

export const ASSUMPTIONS: Assumption[] = [
  { key: "homes", value: BUDGET.homes, unit: "boliger", source: `${BUDGET_DOC}; prosjekteier: rundt 30`, date: "2026-09", label: { no: "Antall boliger", en: "Homes" } },
  { key: "plots_modelled", value: FACT.plots, unit: "tomter", source: `Foreløpig utlegg v6, ${MODEL}`, date: "2026-09-30", provisional: true, label: { no: "Tomter i modellen", en: "Plots in the model" } },
  { key: "open_sea_plots", value: FACT.open_sea_plots, unit: "tomter", source: `Siktanalyse per tomt med nabohusene stående, ${MODEL}`, date: "2026-09-30", provisional: true, label: { no: "Tomter med åpent hav i sikt, i modellen", en: "Plots with open sea in view, in the model" } },
  { key: "sea_view_plots", value: FACT.plots, unit: "tomter", source: `Siktanalyse per tomt, ${MODEL}`, date: "2026-09-30", provisional: true, label: { no: "Tomter med sjøutsikt i modellen", en: "Plots with a sea view in the model" } },
  { key: "lokkeheia", value: FACT.lokkeheia_m, unit: "moh.", source: "Kart fra prosjekteier (Norkart)", date: "2026-09", label: { no: "Løkkeheia bak feltet", en: "Løkkeheia behind the field" } },
  { key: "trees_measured", value: FACT.trees_detected, unit: "trær", source: `Tretoppdeteksjon i laserdata, ${MODEL}`, date: "2026-09-05", provisional: true, label: { no: "Trær funnet i laserdata på 1 km²", en: "Trees found in laser data on 1 km²" } },
  { key: "trees_cleared", value: FACT.trees_cleared, unit: "trær", source: `14 m rundt husene, 6,5 m langs veien, 2,5 m langs gangstien og trærne i siktlinjen fra hver stue mot sjøen, ${MODEL}`, date: "2026-09-30", provisional: true, label: { no: "Trær som ryddes i modellens forslag", en: "Trees cleared in the model's proposal" } },
  { key: "sea_corridor_deg", value: FACT.sea_corridor_deg, unit: "°", source: `Fra det høyeste punktet, 164 til 189 grader, ${MODEL}`, date: "2026-09-05", provisional: true, label: { no: "Siktkorridor mot åpent hav", en: "Corridor to open sea" } },
  { key: "parcel_m2", value: FACT.parcel_m2, unit: "m²", source: "Norgeskart og prosjekteier, gnr 355 bnr 10 og 368", date: "2026-09", label: { no: "Eiendommenes areal", en: "Area of the properties" } },
  { key: "saving_per_home", value: BUDGET.results.saving_per_home_nok, unit: "kr/år", source: `${BUDGET_DOC}, mot direkte elektrisk oppvarming`, date: "2026-09", provisional: true, label: { no: "Besparelse per bolig", en: "Saving per home" } },
  { key: "pv_kwp_per_home", value: PV_KWP_PER_HOME, unit: "kWp", source: `${BUDGET_DOC}: ${BUDGET.pv.installed_kwp} kWp på ${nb(BUDGET.pv.roof_total_m2)} m² tak, ${BUDGET.pv.roof_per_home_m2} m² per bolig`, date: "2026-09", provisional: true, label: { no: "Solceller per bolig", en: "PV per home" } },
  { key: "battery_kwh_per_home", value: BUDGET.battery.per_home_kwh, unit: "kWh", source: BUDGET_DOC, date: "2026-09", provisional: true, label: { no: "Batteri per bolig", en: "Battery per home" } },
  { key: "hub_storage_kwh", value: 400, unit: "kWh", source: "Plassholder", date: "2026-09-05", provisional: true, label: { no: "Felles energilager", en: "Shared storage" } },
  { key: "islanding_hours_winter", value: 18, unit: "timer", source: "Plassholder", date: "2026-09-05", provisional: true, label: { no: "Drift uten nett, januar", en: "Islanding, January" } },
  { key: "self_sufficiency_pct", value: BUDGET.results.self_sufficiency_pct, unit: "%", source: `${BUDGET_DOC}, sol satt for høyt i arket`, date: "2026-09", provisional: true, label: { no: "Selvforsyning strøm", en: "Self-sufficiency, power" } },
  { key: "co2_saved", value: BUDGET.results.co2_saved_kg, unit: "kg/år", source: `${BUDGET_DOC}, 0,2 kg CO₂/kWh`, date: "2026-09", provisional: true, label: { no: "Spart CO₂, hele feltet", en: "CO₂ saved, whole field" } },
];

export function assumption(key: string): Assumption {
  const a = ASSUMPTIONS.find((x) => x.key === key);
  if (!a) throw new Error(`missing assumption ${key}`);
  return a;
}

/** Klassisk's "Kilder og forutsetninger" table: one row per number, same rows as before. */
export const FIGURES: {
  what: string;
  value: string;
  unit: string;
  src: SourceId;
  status: "Fastsatt" | "Foreløpig" | "Beregnet" | "Verifisert";
  owner: string;
}[] = [
  { what: "Antall tomter", value: `rundt ${FACT.plots}`, unit: "tomter", src: "sigve30", status: "Foreløpig", owner: "Prosjekteier" },
  { what: "Samlet areal for eiendommene", value: nb(FACT.parcel_m2), unit: "m²", src: "areal", status: "Fastsatt", owner: "Kartverket og prosjekteier" },
  { what: "Maks stigning på vei", value: nb(FACT.road_grade_pct), unit: "%", src: "vei", status: "Foreløpig", owner: "Prosjekteier" },
  { what: "Terrengprofil, lengde", value: nb(FACT.profile_m), unit: "m", src: "profil", status: "Fastsatt", owner: "Norgeskart" },
  { what: "Terrengprofil, høyde", value: `0 til ${FACT.knotten_m}`, unit: "moh", src: "profil", status: "Fastsatt", owner: "Norgeskart" },
  { what: "Kontorer ferdig i dag", value: nb(FACT.offices_now), unit: "kontorer", src: "kontor", status: "Fastsatt", owner: "Prosjekteier" },
  { what: "Kontorer etter utvidelse", value: nb(FACT.offices_after), unit: "kontorer", src: "kontor", status: "Fastsatt", owner: "Prosjekteier" },
  { what: "Felles solanlegg, scenario", value: `ca. ${FACT.panels}`, unit: "paneler", src: "paneler", status: "Foreløpig", owner: "Prosjekteier" },
  { what: "Samlet energibehov", value: `${about(BUDGET.demand_total_kwh, 10000)} ±${BUDGET.demand_range_pct} %`, unit: "kWh/år", src: "budsjett", status: "Foreløpig", owner: "Energisporet" },
  { what: "Selvforsyning strøm", value: nb(BUDGET.results.self_sufficiency_pct), unit: "%", src: "selvforsyning", status: "Foreløpig", owner: "Energisporet" },
  { what: "Solstrøm fra 1 350 m²", value: about(STATUS_SOLAR.annual_kwh, 1000), unit: "kWh/år", src: "sol", status: "Foreløpig", owner: "Energisporet" },
  { what: "Energibrønner", value: `${EED.boreholes} x ${Math.round(EED.depth_m)}`, unit: "stk x m", src: "eed", status: "Beregnet", owner: "Energisporet" },
  { what: "Besparelse per bolig", value: about(BUDGET.results.saving_per_home_nok, 1000), unit: "kr/år", src: "besparelse", status: "Foreløpig", owner: "Energisporet" },
  { what: "Solstrøm i energiregnskapet", value: nb(BUDGET.pv.annual_kwh), unit: "kWh/år", src: "sol", status: "Foreløpig", owner: "Energisporet" },
  { what: "Batterikapasitet samlet", value: nb(BUDGET.battery.total_kwh), unit: "kWh", src: "budsjett", status: "Foreløpig", owner: "Energisporet" },
  { what: "CO₂ spart per år", value: about(BUDGET.results.co2_saved_kg, 1000), unit: "kg", src: "co2", status: "Foreløpig", owner: "Energisporet" },
  { what: "Løkkeheia, høyde", value: nb(FACT.lokkeheia_m), unit: "moh", src: "hoyder", status: "Fastsatt", owner: "Norkart" },
  { what: "Audna, lengde", value: nb(FACT.audna_km), unit: "km", src: "audna", status: "Verifisert", owner: "Store norske leksikon" },
  { what: "Vigeland, innbyggere 2026", value: nb(FACT.vigeland_pop), unit: "personer", src: "vigeland", status: "Verifisert", owner: "SSB" },
];
