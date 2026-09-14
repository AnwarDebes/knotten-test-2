/**
 * Versioned assumptions with provenance. In production these live in the `assumption` table and
 * are published by the energy team / admin. Nothing in the UI hard-codes a figure.
 */
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

export const ASSUMPTIONS_VERSION = "2026-09-D (foreløpig)";

export const ASSUMPTIONS: Assumption[] = [
  { key: "homes", value: 30, unit: "boliger", source: "Sigve Simonsen AS, prosjektbeskrivelse", date: "2026-09-05", label: { no: "Antall boliger", en: "Homes" } },
  { key: "plots_modelled", value: 30, unit: "tomter", source: "Foreløpig utlegg v5: terrasser, en rekke på hvert nivå rett under den over, pipeline/plan_layout_v5.py", date: "2026-09-14", provisional: true, label: { no: "Tomter i modellen", en: "Plots in the model" } },
  { key: "open_sea_plots", value: 28, unit: "tomter", source: "Siktanalyse per tomt, Kartverket DTM 1 m og 30 km horisont, med nabohusene stående", date: "2026-09-14", provisional: true, label: { no: "Tomter med åpent hav i sikt", en: "Plots with open sea in view" } },
  { key: "sea_view_plots", value: 30, unit: "tomter", source: "Siktanalyse per tomt, alle 30 tomter, med nabohusene stående", date: "2026-09-14", provisional: true, label: { no: "Tomter med sjøutsikt", en: "Plots with a sea view" } },
  { key: "knoll_top", value: 87.4, unit: "moh.", source: "Kartverket NHM DTM 1 m", date: "2026-09-05", label: { no: "Toppen av Knotten", en: "Top of Knotten" } },
  { key: "trees_measured", value: 31823, unit: "trær", source: "Kartverket DOM minus DTM, tretoppdeteksjon", date: "2026-09-05", label: { no: "Trær målt på 1 km²", en: "Trees measured on 1 km²" } },
  { key: "trees_cleared", value: 1049, unit: "trær", source: "Ryddet 14 m rundt husene, 6,5 m langs veiene og siktlinjen mot vannet fra hver stue, resten av skogen står, foreløpig", date: "2026-09-14", provisional: true, label: { no: "Trær som ryddes", en: "Trees cleared" } },
  { key: "sea_corridor_deg", value: 26, unit: "°", source: "Siktanalyse fra toppen, 164 til 189 grader", date: "2026-09-05", label: { no: "Siktkorridor mot åpent hav", en: "Corridor to open sea" } },
  { key: "parcel_m2", value: 40181, unit: "m²", source: "Kartverket Matrikkelen, gnr 355 bnr 10 og 368", date: "2026-09-08", label: { no: "Eiendommens areal", en: "Parcel area" } },
  { key: "energy_saving_pct", value: 55, unit: "%", low: 45, high: 70, source: "Plassholder inntil energigruppen leverer (kontrakt v1)", date: "2026-09-05", provisional: true, label: { no: "Energibesparelse mot TEK17", en: "Energy saving vs TEK17" } },
  { key: "pv_kwp_per_home", value: 8, unit: "kWp", source: "Plassholder", date: "2026-09-05", provisional: true, label: { no: "Solceller per bolig", en: "PV per home" } },
  { key: "battery_kwh_per_home", value: 10, unit: "kWh", source: "Plassholder", date: "2026-09-05", provisional: true, label: { no: "Batteri per bolig", en: "Battery per home" } },
  { key: "hub_storage_kwh", value: 400, unit: "kWh", source: "Plassholder", date: "2026-09-05", provisional: true, label: { no: "Felles energilager", en: "Shared storage" } },
  { key: "islanding_hours_winter", value: 18, unit: "timer", source: "Plassholder", date: "2026-09-05", provisional: true, label: { no: "Drift uten nett, januar", en: "Islanding, January" } },
  { key: "opex_saving_nok", value: 14000, unit: "kr/år", low: 9000, high: 21000, source: "Plassholder", date: "2026-09-05", provisional: true, label: { no: "Sparte driftskostnader per bolig", en: "Operating saving per home" } },
  { key: "co2_avoided_t", value: 42, unit: "t CO₂/år", source: "Plassholder", date: "2026-09-05", provisional: true, label: { no: "Unngått CO₂, hele feltet", en: "CO₂ avoided, whole field" } },
];

export function assumption(key: string): Assumption {
  const a = ASSUMPTIONS.find((x) => x.key === key);
  if (!a) throw new Error(`missing assumption ${key}`);
  return a;
}
