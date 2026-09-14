/**
 * Every figure on the front page points to one of these. The quote is word for word from the
 * source, in the source's own language; the document names where it comes from. A number that is
 * not in this list, or computed from the measured model, does not go on the page.
 */
export type Source = { quote: string; doc: { no: string; en: string } };

export const SOURCES = {
  sigve30: {
    quote: "Planen er at det kan bli en plass rundt 30 tomter, ønsket er at alle tomtene skal få sjøutsikt, men det er ikke sikkert at det vil gå fra alle tomtene.",
    doc: { no: "Prosjekteier, melding til prosjektgruppen, september 2026", en: "Project owner, message to the project group, September 2026" },
  },
  areal: {
    quote: "Rødbergsveien 121, 4520 Lindesnes. Areal 39,431 m². Gnr 355, Bnr 10. Prosjekteier: «+ Gnr 355 Bnr 368 så samlet 40 181m2».",
    doc: { no: "Eiendomskart fra Kartverket og e-post fra prosjekteier", en: "Kartverket property map and email from the project owner" },
  },
  flat: {
    quote: "The plots located down on the flat area will not have a sea view.",
    doc: { no: "E-post fra prosjekteier", en: "Email from the project owner" },
  },
  vei: {
    quote: "«Stigning på veien max 6%», skrevet fire ganger langs veien på skissen. «Gang sti» mellom rekkene.",
    doc: { no: "Skisse til situasjonsplan fra prosjekteier", en: "Site plan sketch from the project owner" },
  },
  regulering: {
    quote: "Prosjektet starter før reguleringsplan, slik at både tekniske og markedsmessige løsninger integreres fra tidlig fase.",
    doc: { no: "Utlysning, praksisplass ved Universitetet i Agder, 2026", en: "Internship posting, University of Agder, 2026" },
  },
  profil: {
    quote: "Terrengprofil tegnet i Norgeskart fra punkt A i vannet ved Spangereidveien til punkt B ved Knotten: 409,5 m. Diagrammet er merket 0 moh og 60 moh.",
    doc: { no: "Norgeskart, skjermbilde fra prosjekteier", en: "Norgeskart, screenshot from the project owner" },
  },
  sikt: {
    quote: "Stiplet linje er inn til byggefeltet og sikt linjen ut til åpent hav.",
    doc: { no: "Kart fra prosjekteier", en: "Map from the project owner" },
  },
  bygg: {
    quote: "The office building and the residential house located within the project area already exist today. The two green buildings represent the new developments that are currently planned for construction. One is an extension of the existing office building, while the other is a warehouse/workshop building.",
    doc: { no: "E-post fra prosjekteier", en: "Email from the project owner" },
  },
  kontor: {
    quote: "I can obtain the actual electricity consumption for the 19 offices that are currently completed. The building is being expanded to a total of 28 offices.",
    doc: { no: "Retning for energikonseptet, prosjekteier, 4. september 2026, punkt 5", en: "Energy concept direction, project owner, 4 September 2026, point 5" },
  },
  retning: {
    quote: "The aim is not to build the development around a single technology. The aim is to create a robust, flexible and future-ready energy system in which solar energy, possible wind power, individual and shared batteries, smart control and future solutions can work together.",
    doc: { no: "Retning for energikonseptet, prosjekteier, 4. september 2026", en: "Energy concept direction, project owner, 4 September 2026" },
  },
  foto: {
    quote: "Bildet med utsikten er tatt på en nabo tomt, den ligger litt lavere enn dette feltet.",
    doc: { no: "Prosjekteier, september 2026", en: "Project owner, September 2026" },
  },
  modell: {
    quote: "Terreng: Kartverket NHM DTM 1 m (hoydedata.no). Trær: DOM minus DTM, tretoppdeteksjon. Horisont: AWS terrain tiles 20 og 80 m. Sol: NOAA solposisjon. Sikt: linje for linje over terrenget, refraksjon k = 1,17.",
    doc: { no: "Den målte modellen, beregnet 14. september 2026, utlegg v5", en: "The measured model, computed 14 September 2026, layout v5" },
  },
  budsjett: {
    quote: "Totalt energibehov prosjektet (el + varme): 719 500 kWh, «realistisk spenn ca. ±25 %». Antall boliger 30, «Sikker, fastsatt i prosjektet».",
    doc: { no: "Energiregnskap, arbeidsversjon, energisporet", en: "Energy budget, working version, energy track" },
  },
  eed: {
    quote: "Configuration: 195 (28 : 4 x 12 open rectangle), B: 15 m, D: 106 m. Fluid temperatures for last year: min: -0,78°C max: 8,12°C.",
    doc: { no: "Earth Energy Designer, grunnvarmeanalyse, energisporet", en: "Earth Energy Designer, ground source heat analysis, energy track" },
  },
  panelene: {
    quote: "The solar concept should combine optimised house surfaces with a shared installation, initially modelled at around 600 panels. The figure of 600 panels is a capacity scenario, not yet a confirmed solar area.",
    doc: { no: "Retning for energikonseptet, prosjekteier, 4. september 2026", en: "Energy concept direction, project owner, 4 September 2026" },
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
