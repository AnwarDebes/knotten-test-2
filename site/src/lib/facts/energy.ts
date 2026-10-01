import { fmt, fmtRound } from "./core";

/**
 * The energy concept as it stands in the project material (September 2026): the direction set by
 * the project owner on 4 September, the working energy budget from the energy track, and the
 * measures comparison. Every figure here is a working basis, not a promise, and the site says so.
 * Shared by both designs (src/lib/facts); checked against knotten-source-informations 27 September 2026.
 */

/** Working energy budget, whole field. Blue cells in the spreadsheet are inputs, the rest computed. */
export const BUDGET = {
  homes: 30,
  el_per_home_kwh: 7000,
  heat_per_home_kwh: 15000,
  office_kwh: 37500,
  storage_kwh: 22000,
  office_storage_range_pct: 30, // "±30 % – ikke prosjektert" for both the office and the storage building
  demand_total_kwh: 719500,
  demand_range_pct: 25, // "realistisk spenn ca. ±25 %"
  pv: { roof_per_home_m2: 30, roof_office_storage_m2: 300, roof_total_m2: 1200, usable_pct: 75, module_area_m2: 900, module_eff_pct: 31, installed_kwp: 279, yield_kwh_per_kwp: 970, system_eff_pct: 90, annual_kwh: 243567 },
  wind: { turbines: 3, kw_each: 8, installed_kw: 24, capacity_factor_pct: 25, availability_pct: 80, annual_kwh: 42048 },
  bedrock: { extracted_kwh: 325000, scop: 3.6, delivered_kwh: 499846, regen_kwh: 20000, regen_factor: 3.0 },
  battery: { per_home_kwh: 14, total_kwh: 420, round_trip_pct: 90 },
  prices: { spot_nok: 2.0, grid_nok: 0.1, buy_nok: 2.1, sell_nok: 0.75, co2_kg_per_kwh: 0.2 },
  /** "NØKKELTALL FOR ÅRET" in the sheet. */
  results: { own_production_kwh: 285615, self_sufficiency_pct: 52.5, saving_per_home_nok: 39229, co2_saved_kg: 104190 },
  /** From the monthly sheet: power to the heat pump, and peak heat covered by direct power. */
  heat_pump_el_kwh: 123600,
  peak_heat_el_kwh: 5040,
  notes: {
    no: "Modulvirkningsgraden på 31 % er satt for høyt i regnearket; standardmoduler ligger på 20 til 23 %, så solproduksjonen bør nedjusteres rundt 30 % før tallet brukes videre. Vindtallet krever vindmåling på tomta.",
    en: "The 31 % module efficiency in the spreadsheet is set too high; standard modules sit at 20 to 23 %, so the solar figure should come down about 30 % before it is used further. The wind figure needs a wind measurement on site.",
  },
};

/** The status summary's solar estimate: 235,254.78 kWh a year from 1,350 m² (differs from the budget, 00a section 14 item 4). */
export const STATUS_SOLAR = { area_m2: 1350, annual_kwh: 235255 };

/** The office building: 19 offices completed today, 28 after the extension (the owner's direction, point 5). */
export const OFFICES = { now: 19, after: 28 };

/** The first scenario for the shared solar plant: about 600 panels, a capacity scenario (direction, point 6). */
export const SHARED_PANELS = 600;

/** The energy track's notes: supplying 30 homes with wind takes 1 to 3 turbines of 50 to 250 kW. */
export const WIND_SCALE = { turbines: [1, 3], kw: [50, 250] };

/** The borehole field as simulated in Earth Energy Designer (EED), 35-year simulation; temperatures are for the last year. */
export const EED = {
  boreholes: 28,
  config: "4 x 12, open rectangle",
  grid: "4 x 12",
  depth_m: 105.83,
  spacing_m: 15,
  diameter_mm: 110,
  type: "Double-U",
  base_heat_mwh: 325,
  base_cool_mwh: 90,
  dhw_mwh: 80,
  dhw_spf: 3.0,
  ground_net_mwh: 288.33,
  fluid_min_c: -0.78,
  fluid_max_c: 8.12,
  years: 35,
};

export type Measure = {
  id: string;
  category: "storage" | "production" | "efficiency" | "control";
  name: { no: string; en: string };
  what: { no: string; en: string };
  verdict: "yes" | "maybe" | "no";
  /** The verdict in a few words, as the Klassisk table shows it. */
  short: string;
  why: { no: string; en: string };
  robustness: number | null;     // 0..10, operation during a power outage
  /** The energy track scored it "av seg selv" (on its own). */
  alone?: boolean;
};

/**
 * Verdicts are the energy track's comparison of 28 August 2026, with two later decisions from the project
 * group on 27 September 2026: the sand battery is dropped (no), and small wind stays under evaluation as a
 * supplement (maybe) although the energy track said no.
 */
export const MEASURES: Measure[] = [
  { id: "solar_roof", category: "production", name: { no: "Solceller på tak", en: "Rooftop solar" }, what: { no: "Paneler på sørvendte tak med 15 til 40 graders helning, vekselretter og egen produksjonsmåler. Overskudd til batteri.", en: "Panels on south-facing roofs at 15 to 40 degrees, an inverter and a production meter. Surplus to the battery." }, verdict: "yes", short: "Ja, kan dekke store deler av behovet", why: { no: `Kan dekke store deler av energibehovet. Energisporets tabell anslår rundt ${fmtRound(STATUS_SOLAR.annual_kwh, 1000)} kWh i året på ${fmt(STATUS_SOLAR.area_m2)} m² tak.`, en: `Can cover a large share of the demand. The energy track's table estimates about ${fmtRound(STATUS_SOLAR.annual_kwh, 1000, "en")} kWh a year on ${fmt(STATUS_SOLAR.area_m2, "en")} m² of roof.` }, robustness: 10 },
  { id: "shared_solar", category: "production", name: { no: "Felles solcelleanlegg", en: "Shared solar plant" }, what: { no: `Et større anlegg på det høyeste punktet i bakkant av feltet, første scenario rundt ${SHARED_PANELS} paneler.`, en: `A larger plant at the highest point behind the field, first scenario around ${SHARED_PANELS} panels.` }, verdict: "maybe", short: "Retning fra prosjekteier, tallet må regnes", why: { no: "Retning fra prosjekteier. Areal, helning, skygge og systemtap må regnes før tallet brukes.", en: "Direction from the project owner. Area, slope, shading and system losses must be computed before the figure is used." }, robustness: null },
  { id: "bedrock", category: "storage", name: { no: "Bergvarme", en: "Bedrock heat" }, what: { no: `Energibrønner spredt med minst ${EED.spacing_m} m avstand, varmepumpe med årsvarmefaktor rundt ${fmt(BUDGET.bedrock.scop)}.`, en: `Boreholes at least ${EED.spacing_m} m apart, heat pump with a seasonal performance factor around ${fmt(BUDGET.bedrock.scop, "en")}.` }, verdict: "maybe", short: "Ja eller kanskje, lagring eller fangst avklares", why: { no: "Ja eller kanskje: det er ikke avklart om brønnene skal brukes til lagring eller uttak av varme. Høy virkningsgrad, stabil uansett utetemperatur, lave driftskostnader, kan gi gratis kjøling om sommeren.", en: "Yes or maybe: whether the boreholes are used for storage or for extracting heat is not settled. High efficiency, stable in any outdoor temperature, low running cost, free cooling in summer." }, robustness: 0, alone: true },
  { id: "btes", category: "storage", name: { no: "Sesonglager i berg (BTES)", en: "Seasonal borehole storage (BTES)" }, what: { no: "Brønner tett i rutenett, 3 til 6 m, for å lagre sommervarme og hente den tilbake om vinteren.", en: "Boreholes in a tight grid, 3 to 6 m, to store summer heat and take it back in winter." }, verdict: "maybe", short: "Ja eller kanskje", why: { no: "Løser sesongmismatch. Usikkert om lagring eller uttak av bergvarme er best for Knotten.", en: "Solves the seasonal mismatch. Unclear whether storage or plain extraction is best for Knotten." }, robustness: 0, alone: true },
  { id: "battery_home", category: "storage", name: { no: "Batteri i hver bolig", en: "Battery in every home" }, what: { no: `Hjemmebatteri med lokal energistyring. Energiregnskapet regner med ${BUDGET.battery.per_home_kwh} kWh per bolig.`, en: `A home battery with local energy management. The energy budget counts ${BUDGET.battery.per_home_kwh} kWh per home.` }, verdict: "yes", short: "Ja, kan bli dyrt over tid", why: { no: "Beboeren styrer selv når batteriet lades og brukes, og i en krise kan det gi lys. Kan bli dyrt: et vanlig 10 kWh hjemmebatteri koster 60 000 til 100 000 kr installert.", en: "The resident decides when to charge and use it, and in a crisis it can give light. Can be expensive: a typical 10 kWh home battery costs 60,000 to 100,000 kr installed." }, robustness: 9 },
  { id: "emergency_battery", category: "storage", name: { no: "Felles beredskapsbatteri", en: "Shared emergency battery" }, what: { no: "Et mellomstort felles batteri som bare brukes i krise.", en: "A medium shared battery used only in a crisis." }, verdict: "maybe", short: "Ja eller kanskje", why: { no: "Full robusthet ved strømbrudd, ingen tap i daglig drift. Rundt 18 m² plass.", en: "Full robustness in an outage, no daily losses. About 18 m² of space." }, robustness: 10 },
  { id: "large_battery", category: "storage", name: { no: "Stort delt batteri", en: "Large shared battery" }, what: { no: "Ett stort batteri med infrastruktur ut til alle husene.", en: "One large battery with infrastructure out to every house." }, verdict: "no", short: "Nei, juridisk krevende", why: { no: "Kan bli juridisk krevende, og gir tap i daglig drift.", en: "Can be legally demanding, and loses energy in daily operation." }, robustness: 5 },
  { id: "sand", category: "storage", name: { no: "Sandbatteri", en: "Sand battery" }, what: { no: "Termisk lager i sand ved høy temperatur, 2 MW og inntil 200 MWh, 15 x 12 m.", en: "High-temperature thermal storage in sand, 2 MW and up to 200 MWh, 15 x 12 m." }, verdict: "no", short: "Nei, lagt bort", why: { no: "Lagt bort. Energisporet vurderte det som nei, fordi bergvarme krever mindre plass.", en: "Dropped. The energy track rated it no, because bedrock heat needs less space." }, robustness: 0, alone: true },
  { id: "wind", category: "production", name: { no: "Småskala vind", en: "Small wind" }, what: { no: `Liten vindturbin på mast. Skal dekke ${BUDGET.homes} boliger trengs ${WIND_SCALE.turbines[0]} til ${WIND_SCALE.turbines[1]} turbiner på ${WIND_SCALE.kw[0]} til ${WIND_SCALE.kw[1]} kW.`, en: `A small turbine on a mast. Supplying ${BUDGET.homes} homes takes ${WIND_SCALE.turbines[0]} to ${WIND_SCALE.turbines[1]} turbines of ${WIND_SCALE.kw[0]} to ${WIND_SCALE.kw[1]} kW.` }, verdict: "maybe", short: "Energisporet: nei. Prosjekteier: vurderes som supplement", why: { no: "Energisporet: nei, krevende søknader og mye plass. Prosjekteier: vind vurderes som supplement, basert på lokale målinger.", en: "Energy track: no, demanding permits and a lot of space. Project owner: wind is evaluated as a supplement, based on local measurements." }, robustness: 7 },
  { id: "heat_recovery", category: "efficiency", name: { no: "Varmegjenvinning i ventilasjon", en: "Heat recovery ventilation" }, what: { no: "Varmeveksler som flytter varmen fra brukt luft til frisk luft.", en: "A heat exchanger moving heat from used air to fresh air." }, verdict: "yes", short: "Ja, sparer mye varmetap", why: { no: "80 til 90 % av varmen i avtrekksluften gjenvinnes. Krav i byggeforskriften uansett.", en: "80 to 90 % of the heat in exhaust air is recovered. Required by the building code anyway." }, robustness: 2 },
  { id: "air_sealing", category: "efficiency", name: { no: "Lufttetting av bygningskroppen", en: "Air sealing" }, what: { no: "Tetting av vegger, tak, gulv og gjennomføringer, dokumentert med trykktest.", en: "Sealing walls, roof, floor and penetrations, documented with a pressure test." }, verdict: "yes", short: "Ja, men nytten avhenger av strømprisen", why: { no: "Mindre trekk og varmetap. Nytten avhenger av strømprisen.", en: "Less draught and heat loss. The benefit depends on the power price." }, robustness: 10 },
  { id: "greywater", category: "efficiency", name: { no: "Varmegjenvinning fra gråvann", en: "Greywater heat recovery" }, what: { no: "Henter varmen fra dusjvannet før det går i avløpet og forvarmer kaldtvannet.", en: "Takes the heat from shower water before it drains and preheats the cold water." }, verdict: "yes", short: "Ja, sparer en del energi", why: { no: "Rimelig når det gjøres under bygging, og Enova-støtte kan være mulig.", en: "Affordable when done during construction, and Enova support may be available." }, robustness: 8 },
  { id: "smart_control", category: "control", name: { no: "Smart laststyring", en: "Smart load management" }, what: { no: "Automatisk styring av varmtvann, varmepumpe og lading etter pris, effekt og sol.", en: "Automatic control of hot water, heat pump and charging by price, power and sun." }, verdict: "yes", short: "Ja", why: { no: "Modent marked i Norge. Unngår dyre effekttrinn og gjør solstrømmen mer nyttig.", en: "A mature market in Norway. Avoids expensive power tariffs and makes solar more useful." }, robustness: 0 },
  { id: "energy_display", category: "control", name: { no: "Energivisning for beboerne", en: "Energy display for residents" }, what: { no: "Sanntidsvisning av forbruk, produksjon og pris via HAN-porten på strømmåleren.", en: "Real-time consumption, production and price through the meter's HAN port." }, verdict: "yes", short: "Ja", why: { no: "Billigste tiltaket på lista, under 1 000 kr, ingen elektriker.", en: "The cheapest measure on the list, under 1,000 kr, no electrician." }, robustness: 0 },
  { id: "microgrid", category: "control", name: { no: "Lokalt mikronett", en: "Local microgrid" }, what: { no: "Eget nett for feltet som kan kobles fra det offentlige nettet ved utfall.", en: "The field's own grid that can disconnect from the public grid in an outage." }, verdict: "maybe", short: "Vanskelig, må utredes videre", why: { no: "Regulatorisk krevende. Deling av felles produksjon på samme eiendom er trolig den farbare veien. Prosjekteier: undersøkes på et begrenset nivå, men er ingen forutsetning.", en: "Regulatorily demanding. Sharing joint production on the same property is probably the practical route. Project owner: investigated at a limited level, but not a prerequisite." }, robustness: 8 },
  { id: "v2h", category: "control", name: { no: "Elbil som lager (V2H)", en: "Car battery as storage (V2H)" }, what: { no: "Toveis lader som lar bilen forsyne huset.", en: "A bidirectional charger letting the car supply the house." }, verdict: "no", short: "Nei, liten nytte mot kostnad", why: { no: "Teknologien er ikke moden i større systemer ennå. Lite nytte mot kostnad i dag.", en: "The technology is not mature in larger systems yet. Little benefit against cost today." }, robustness: 10 },
  { id: "three_phase", category: "control", name: { no: "Trefase til boligene", en: "Three-phase supply" }, what: { no: "400 V inntak for raskere hjemmelading.", en: "400 V supply for faster home charging." }, verdict: "no", short: "Nei, ikke nødvendig", why: { no: "Ikke nødvendig for konseptet.", en: "Not needed for the concept." }, robustness: 0 },
];

/** One measure by id; throws if the id is unknown, so a typo fails the build instead of showing nothing. */
export function measure(id: string): Measure {
  const m = MEASURES.find((x) => x.id === id);
  if (!m) throw new Error(`missing measure ${id}`);
  return m;
}

/** The project owner's direction of 4 September 2026, in eight points. The sand battery was dropped later (27 September). */
export const DIRECTION = {
  no: [
    "Hver bolig bør ha eget batteri og energistyring, med mulig tilgang til felles lagringskapasitet.",
    "Mikronett bør undersøkes på et begrenset nivå, men skal ikke være en forutsetning for prosjektet.",
    "Sandbatteri beholdes som et alternativ, men vi bør ikke bruke store ressurser før helheten er bedre definert. Sandbatteriet er senere lagt bort.",
    "Verksted og lager kan foreløpig dimensjoneres som én bolig, tydelig merket som en arbeidsforutsetning.",
    `Kontorbygget beregnes ut fra faktisk forbruk for de ${OFFICES.now} ferdige kontorene, med et justert anslag for ${OFFICES.after} kontorer.`,
    `Solenergikonseptet bør kombinere optimaliserte flater på boligene med et fellesanlegg, i første omgang modellert med cirka ${SHARED_PANELS} paneler.`,
    "Vindkraft bør vurderes som en supplerende energikilde, basert på lokale målinger.",
    "Målet er et robust, fleksibelt og fremtidsrettet energisystem, ikke et felt bygget rundt én enkelt teknologi.",
  ],
  en: [
    "Each home should have its own battery and energy management, with possible access to shared storage.",
    "A microgrid should be investigated at a limited level, but it should not be a prerequisite for the project.",
    "The sand battery should remain an option, but no major resources should be committed until the overall system is better defined. The sand battery has since been dropped.",
    "The workshop and storage building may provisionally be dimensioned as one home, clearly marked as an assumption.",
    `The office building should be estimated from actual consumption for the ${OFFICES.now} completed offices, with an adjusted projection for ${OFFICES.after} offices.`,
    `The solar concept should combine optimised house surfaces with a shared installation, initially modelled at around ${SHARED_PANELS} panels.`,
    "Wind energy should be evaluated as a complementary source, based on local measurements.",
    "The aim is a robust, flexible and future-ready energy system, not a field built around a single technology.",
  ],
};
