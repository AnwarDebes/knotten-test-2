/**
 * The energy concept as it stands in the project material (September 2026): the direction set by
 * the project owner on 4 September, the working energy budget from the energy group, and the
 * measures comparison. Every figure here is a working basis, not a promise, and the site says so.
 */
export const ENERGY_PLAN_DATE = "2026-09-04";

/** Working energy budget, whole field. Blue cells in the spreadsheet are inputs, the rest computed. */
export const BUDGET = {
  homes: 30,
  el_per_home_kwh: 7000,
  heat_per_home_kwh: 15000,
  office_kwh: 37500,
  storage_kwh: 22000,
  demand_total_kwh: 719500,
  pv: { roof_per_home_m2: 30, roof_office_storage_m2: 300, roof_total_m2: 1200, usable_pct: 75, module_area_m2: 900, module_eff_pct: 31, installed_kwp: 279, yield_kwh_per_kwp: 970, system_eff_pct: 90, annual_kwh: 243567 },
  wind: { turbines: 3, kw_each: 8, installed_kw: 24, capacity_factor_pct: 25, availability_pct: 80, annual_kwh: 42048 },
  bedrock: { extracted_kwh: 325000, scop: 3.6, delivered_kwh: 499846, regen_kwh: 20000, regen_factor: 3.0 },
  battery: { per_home_kwh: 14, total_kwh: 420, round_trip_pct: 90 },
  prices: { spot_nok: 2.0, grid_nok: 0.1, buy_nok: 2.1, sell_nok: 0.75, co2_kg_per_kwh: 0.2 },
  notes: {
    no: "Modulvirkningsgraden på 31 % er satt for høyt i regnearket; standardmoduler ligger på 20 til 23 %, så solproduksjonen bør nedjusteres rundt 30 % før tallet brukes videre. Vindtallet krever vindmåling på tomta.",
    en: "The 31 % module efficiency in the spreadsheet is set too high; standard modules sit at 20 to 23 %, so the solar figure should come down about 30 % before it is used further. The wind figure needs a wind measurement on site.",
  },
};

/** The borehole field as dimensioned in Earth Energy Designer (EED), 35-year simulation. */
export const EED = {
  boreholes: 28,
  config: "4 x 12, open rectangle",
  depth_m: 105.8,
  spacing_m: 15,
  diameter_mm: 110,
  type: "Double-U",
  base_heat_mwh: 325,
  base_cool_mwh: 90,
  dhw_mwh: 80,
  dhw_spf: 3.0,
  fluid_min_c: -0.78,
  fluid_max_c: 8.12,
  years: 35,
};

export type Measure = {
  category: "storage" | "production" | "efficiency" | "control";
  name: { no: string; en: string };
  what: { no: string; en: string };
  verdict: "yes" | "maybe" | "no";
  why: { no: string; en: string };
  robustness: number | null;     // 0..10, operation during a power outage
};

export const MEASURES: Measure[] = [
  { category: "production", name: { no: "Solceller på tak", en: "Rooftop solar" }, what: { no: "Paneler på sørvendte tak med 15 til 40 graders helning, vekselretter og egen produksjonsmåler. Overskudd til batteri.", en: "Panels on south-facing roofs at 15 to 40 degrees, an inverter and a production meter. Surplus to the battery." }, verdict: "yes", why: { no: "Kan dekke store deler av energibehovet. Rundt 235 000 kWh i året på 1 350 m² tak.", en: "Can cover a large share of the demand. About 235,000 kWh a year on 1,350 m² of roof." }, robustness: 10 },
  { category: "production", name: { no: "Felles solcelleanlegg", en: "Shared solar plant" }, what: { no: "Et større anlegg på det høyeste punktet i bakkant av feltet, første scenario rundt 600 paneler.", en: "A larger plant at the highest point behind the field, first scenario around 600 panels." }, verdict: "maybe", why: { no: "Retning fra prosjekteier. Areal, helning, skygge og systemtap må regnes før tallet brukes.", en: "Direction from the project owner. Area, slope, shading and system losses must be computed before the figure is used." }, robustness: null },
  { category: "storage", name: { no: "Bergvarme", en: "Bedrock heat" }, what: { no: "Energibrønner spredt med minst 15 m avstand, varmepumpe med årsvarmefaktor rundt 3,6.", en: "Boreholes at least 15 m apart, heat pump with a seasonal performance factor around 3.6." }, verdict: "yes", why: { no: "Høy virkningsgrad, stabil uansett utetemperatur, lave driftskostnader, kan gi gratis kjøling om sommeren. EED-simuleringen viser stabile temperaturer over 35 år.", en: "High efficiency, stable in any outdoor temperature, low running cost, free cooling in summer. The EED simulation shows stable temperatures over 35 years." }, robustness: 0 },
  { category: "storage", name: { no: "Sesonglager i berg (BTES)", en: "Seasonal borehole storage (BTES)" }, what: { no: "Brønner tett i rutenett, 3 til 6 m, for å lagre sommervarme og hente den tilbake om vinteren.", en: "Boreholes in a tight grid, 3 to 6 m, to store summer heat and take it back in winter." }, verdict: "maybe", why: { no: "Løser sesongmismatch. Usikkert om lagring eller uttak av bergvarme er best for Knotten.", en: "Solves the seasonal mismatch. Unclear whether storage or plain extraction is best for Knotten." }, robustness: 0 },
  { category: "storage", name: { no: "Batteri i hver bolig", en: "Battery in every home" }, what: { no: "10 til 14 kWh hjemmebatteri med lokal energistyring.", en: "A 10 to 14 kWh home battery with local energy management." }, verdict: "yes", why: { no: "Beboeren styrer selv når batteriet lades og brukes. Lys og varme ved strømbrudd. Kan bli dyrt: 60 000 til 100 000 kr installert.", en: "The resident decides when to charge and use it. Light and heat during outages. Can be expensive: 60,000 to 100,000 kr installed." }, robustness: 9 },
  { category: "storage", name: { no: "Felles beredskapsbatteri", en: "Shared emergency battery" }, what: { no: "Et mellomstort felles batteri som bare brukes i krise.", en: "A medium shared battery used only in a crisis." }, verdict: "maybe", why: { no: "Full robusthet ved strømbrudd, ingen tap i daglig drift. Rundt 18 m² plass.", en: "Full robustness in an outage, no daily losses. About 18 m² of space." }, robustness: 10 },
  { category: "storage", name: { no: "Stort delt batteri", en: "Large shared battery" }, what: { no: "Ett stort batteri med infrastruktur ut til alle husene.", en: "One large battery with infrastructure out to every house." }, verdict: "no", why: { no: "Kan bli juridisk krevende, og gir tap i daglig drift.", en: "Can be legally demanding, and loses energy in daily operation." }, robustness: 5 },
  { category: "storage", name: { no: "Sandbatteri", en: "Sand battery" }, what: { no: "Termisk lager i sand ved høy temperatur, 2 MW og inntil 200 MWh, 15 x 12 m.", en: "High-temperature thermal storage in sand, 2 MW and up to 200 MWh, 15 x 12 m." }, verdict: "no", why: { no: "Interessant, men bergvarme gir samme nytte med mye mindre plass. Forstudie til 20 000 euro bestilles ikke nå.", en: "Interesting, but bedrock heat gives the same benefit in far less space. The 20,000 euro feasibility study is not ordered now." }, robustness: 0 },
  { category: "production", name: { no: "Småskala vind", en: "Small wind" }, what: { no: "Liten vindturbin på mast. Skal dekke 30 boliger trengs 1 til 3 turbiner på 50 til 250 kW.", en: "A small turbine on a mast. Supplying 30 homes takes 1 to 3 turbines of 50 to 250 kW." }, verdict: "no", why: { no: "Krevende søknader, mye plass, og vindmåling på tomta må til. Vurderes videre som supplement.", en: "Demanding permits, a lot of space, and a wind measurement on site is required. Kept under evaluation as a supplement." }, robustness: 7 },
  { category: "efficiency", name: { no: "Varmegjenvinning i ventilasjon", en: "Heat recovery ventilation" }, what: { no: "Varmeveksler som flytter varmen fra brukt luft til frisk luft.", en: "A heat exchanger moving heat from used air to fresh air." }, verdict: "yes", why: { no: "80 til 90 % av varmen i avtrekksluften gjenvinnes. Krav i byggeforskriften uansett.", en: "80 to 90 % of the heat in exhaust air is recovered. Required by the building code anyway." }, robustness: 2 },
  { category: "efficiency", name: { no: "Lufttetting av bygningskroppen", en: "Air sealing" }, what: { no: "Tetting av vegger, tak, gulv og gjennomføringer, dokumentert med trykktest.", en: "Sealing walls, roof, floor and penetrations, documented with a pressure test." }, verdict: "yes", why: { no: "Blant de billigste tiltakene, ingen driftskostnad, mindre trekk og varmetap.", en: "Among the cheapest measures, no running cost, less draught and heat loss." }, robustness: 10 },
  { category: "efficiency", name: { no: "Varmegjenvinning fra gråvann", en: "Greywater heat recovery" }, what: { no: "Henter varmen fra dusjvannet før det går i avløpet og forvarmer kaldtvannet.", en: "Takes the heat from shower water before it drains and preheats the cold water." }, verdict: "yes", why: { no: "Rimelig når det gjøres under bygging, Enova-støtte finnes.", en: "Affordable when done during construction, Enova support exists." }, robustness: 8 },
  { category: "control", name: { no: "Smart laststyring", en: "Smart load management" }, what: { no: "Automatisk styring av varmtvann, varmepumpe og lading etter pris, effekt og sol.", en: "Automatic control of hot water, heat pump and charging by price, power and sun." }, verdict: "yes", why: { no: "Modent marked i Norge. Unngår dyre effekttrinn og gjør solstrømmen mer nyttig.", en: "A mature market in Norway. Avoids expensive power tariffs and makes solar more useful." }, robustness: 0 },
  { category: "control", name: { no: "Energivisning for beboerne", en: "Energy display for residents" }, what: { no: "Sanntidsvisning av forbruk, produksjon og pris via HAN-porten på strømmåleren.", en: "Real-time consumption, production and price through the meter's HAN port." }, verdict: "yes", why: { no: "Billigste tiltaket på lista, under 1 000 kr, ingen elektriker.", en: "The cheapest measure on the list, under 1,000 kr, no electrician." }, robustness: 0 },
  { category: "control", name: { no: "Lokalt mikronett", en: "Local microgrid" }, what: { no: "Eget nett for feltet som kan kobles fra det offentlige nettet ved utfall.", en: "The field's own grid that can disconnect from the public grid in an outage." }, verdict: "maybe", why: { no: "Regulatorisk krevende. Deling av felles produksjon på samme eiendom er den farbare veien.", en: "Regulatorily demanding. Sharing shared production on the same property is the practical route." }, robustness: 8 },
  { category: "control", name: { no: "Elbil som lager (V2H)", en: "Car battery as storage (V2H)" }, what: { no: "Toveis lader som lar bilen forsyne huset.", en: "A bidirectional charger letting the car supply the house." }, verdict: "no", why: { no: "Teknologien er ikke moden i større systemer ennå. Lite nytte mot kostnad i dag.", en: "The technology is not mature in larger systems yet. Little benefit against cost today." }, robustness: 10 },
  { category: "control", name: { no: "Trefase til boligene", en: "Three-phase supply" }, what: { no: "400 V inntak for raskere hjemmelading.", en: "400 V supply for faster home charging." }, verdict: "no", why: { no: "Ikke nødvendig for konseptet.", en: "Not needed for the concept." }, robustness: 0 },
];

/** The project owner's direction of 4 September 2026, in eight points. */
export const DIRECTION = {
  no: [
    "Hver bolig får eget batteri og energistyring, med mulig tilgang til felles lager.",
    "Mikronett undersøkes på et begrenset nivå, men er ingen forutsetning.",
    "Sandbatteri beholdes som et alternativ uten at ressurser bindes nå.",
    "Verksted og lager dimensjoneres foreløpig som én bolig, tydelig merket.",
    "Kontorbygget beregnes fra faktisk forbruk for 19 kontorer, skalert til 28.",
    "Solkonseptet kombinerer optimaliserte takflater med et fellesanlegg, først modellert med rundt 600 paneler.",
    "Vindkraft vurderes som supplement, basert på lokale målinger.",
    "Målet er et robust og fleksibelt system, ikke ett felt bygget rundt én teknologi.",
  ],
  en: [
    "Every home gets its own battery and energy management, with possible access to shared storage.",
    "A microgrid is investigated at a limited level, but is not a prerequisite.",
    "The sand battery stays an option without committing resources now.",
    "Workshop and storage are provisionally dimensioned as one home, clearly labelled.",
    "The office building is estimated from measured consumption for 19 offices, scaled to 28.",
    "The solar concept combines optimised roof surfaces with a shared plant, first modelled at around 600 panels.",
    "Wind is evaluated as a supplement, based on local measurements.",
    "The aim is a robust, flexible system, not a field built around one technology.",
  ],
};
