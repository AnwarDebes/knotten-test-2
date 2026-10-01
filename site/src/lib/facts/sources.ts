import type { T } from "./core";

/**
 * Every "Kilde" chip in both designs opens one of these. Text inside «» or "" is word for word from the
 * verified source folder (knotten-source-informations), in the source's own language. Text without quote
 * marks describes a source faithfully where a word-for-word quote would break the site's rules (the
 * sources use dashes, which the site never shows). `doc` names the document; `url` links public references.
 */
export type Source = { quote: string; doc: T; url?: string };

const OWNER = { no: "Prosjekteier", en: "Project owner" };
const DIRECTION_DOC = (point?: number): T => ({
  no: `Foreløpig retning for energikonseptet, prosjekteier, 4. september 2026${point ? `, punkt ${point}` : ""}`,
  en: `Preliminary direction for the energy concept, project owner, 4 September 2026${point ? `, point ${point}` : ""}`,
});
const BUDGET_DOC: T = { no: "Energiregnskap, arbeidsversjon, energisporet, september 2026", en: "Energy budget, working version, energy track, September 2026" };

const ALL = {
  // the plots and the view
  sigve30: {
    quote: "«Planen er at det kan bli en plass rundt 30 tomter, ønsket er at alle tomtene skal få sjøutsikt, men det er ikke sikkert at det vil gå fra alle tomtene.»",
    doc: { no: `${OWNER.no}, melding til prosjektgruppen, september 2026`, en: `${OWNER.en}, message to the project group, September 2026` },
  },
  flat: {
    quote: "«The plots located down on the flat area will not have a sea view.»",
    doc: { no: "E-post fra prosjekteier", en: "Email from the project owner" },
  },
  foto: {
    quote: "«Bildet med utsikten er tatt på en nabo tomt, den ligger litt lavere enn dette feltet.» Kartet fra prosjekteier: «Nabo grillbu med utsikten som vist i bildet».",
    doc: { no: `${OWNER.no}, september 2026`, en: `${OWNER.en}, September 2026` },
  },
  sikt: {
    quote: "«Stiplet linje er inn til byggefeltet og sikt linjen ut til åpent hav.»",
    doc: { no: "Kart fra prosjekteier", en: "Map from the project owner" },
  },
  vei: {
    quote: "Skisse til situasjonsplan: «Stigning på veien max 6%», skrevet fire ganger langs veien, og «Gang sti» mellom rekkene.",
    doc: { no: "Skisse til situasjonsplan fra prosjekteier", en: "Site plan sketch from the project owner" },
  },
  tak: {
    quote: "«Sørvendte tak bør være så enkle og sammenhengende som mulig, med få arker, kvister, oppbygg eller andre elementer som reduserer tilgjengelig panelareal eller skaper skygge.»",
    doc: DIRECTION_DOC(6),
  },

  // the property and the place
  areal: {
    quote: "Eiendomskart, Norgeskart: «Rødbergsveien 121, 4520 LINDESNES», «Areal 39,431 m²», «Gnr 355», «Bnr 10». Prosjekteier: «+ Gnr 355 Bnr 368 så samlet 40 181m2».",
    doc: { no: "Norgeskart og e-post fra prosjekteier", en: "Norgeskart and email from the project owner" },
  },
  hoyder: {
    quote: "Kartene fra prosjekteier merker «Løkkeheia» med høyden «88.5». Kartverkets stedsnavnregister har både Knotten og Løkkeheia som høyder rett ved feltet.",
    doc: { no: "Kart fra prosjekteier (Norkart) og Kartverket, stedsnavn, lest 27. september 2026", en: "Maps from the project owner (Norkart) and Kartverket place names, read 27 September 2026" },
    url: "https://ws.geonorge.no/stedsnavn/v1/sted?stedsnummer=83797",
  },
  profil: {
    quote: "Terrengprofil tegnet i Norgeskart fra punkt A i vannet ved Spangereidveien til punkt B ved Knotten: «409,5 m». Diagrammet er merket «0 moh» og «60 moh».",
    doc: { no: "Norgeskart, skjermbilde fra prosjekteier", en: "Norgeskart, screenshot from the project owner" },
  },
  posisjon: {
    quote: "Posisjon «58.068057, 7.278401». Kartverkets adresseregister: Rødbergsveien 121 og 123 ligger begge på gnr 355 bnr 10, 4520 Lindesnes.",
    doc: { no: "Prosjektgruppen, 4. september 2026, og Kartverket, adresser, lest 27. september 2026", en: "Project group, 4 September 2026, and Kartverket addresses, read 27 September 2026" },
    url: "https://www.openstreetmap.org/?mlat=58.068057&mlon=7.278401#map=16/58.0681/7.2784",
  },
  fjord: {
    quote: "Kartverkets stedsnavnregister: «Snigsfjorden» er godkjent og prioritert, «Sniksfjorden» er godkjent. Logoen til prosjektet: «SNIKSFJORDEN • LINDESNES».",
    doc: { no: "Kartverket, stedsnavn 364683, lest 27. september 2026, og logoen fra prosjekteier", en: "Kartverket place name 364683, read 27 September 2026, and the project owner's logo" },
    url: "https://ws.geonorge.no/stedsnavn/v1/sted?stedsnummer=364683",
  },
  audna: {
    quote: "«Audna er 55 kilometer lang» og «munner ut i Sniksfjorden» (Wikipedia). «Den er 55 km lang» (Store norske leksikon). Fjorden er om lag 3 km lang og begynner ved Audnas utløp ved Snig.",
    doc: { no: "Wikipedia og Store norske leksikon: Audna, lest 27. september 2026", en: "Wikipedia and Store norske leksikon: Audna, read 27 September 2026" },
    url: "https://snl.no/Audna",
  },
  vigeland: {
    quote: "Tettstedet Vigeland: 1 673 bosatte 1. januar 2026 (SSB, tabell 04859). Vigeland «var administrasjonssenteret i tidligere Lindesnes kommune (1964-2019)» (Wikipedia).",
    doc: { no: "SSB tabell 04859 og Wikipedia: Vigeland, lest 27. september 2026", en: "Statistics Norway table 04859 and Wikipedia: Vigeland, read 27 September 2026" },
    url: "https://data.ssb.no/api/v0/no/table/04859",
  },
  fv460: {
    quote: "«Fylkesvei 460 (Fv460) går mellom Håland i Lyngdal og Lindesnes», gjennom Vigeland, der den møter E39, og sørover via Spangereid til Lindesnes fyr.",
    doc: { no: "Wikipedia: Fylkesvei 460, lest 27. september 2026", en: "Wikipedia: Fylkesvei 460, read 27 September 2026" },
    url: "https://no.wikipedia.org/wiki/Fylkesvei_460",
  },

  // the project
  regulering: {
    quote: "«Prosjektet starter før reguleringsplan, slik at både tekniske og markedsmessige løsninger integreres fra tidlig fase.»",
    doc: { no: "Utlysning av praksisplass for studenter ved Universitetet i Agder, Sigve Simonsen AS, 2026", en: "Internship posting for University of Agder students, Sigve Simonsen AS, 2026" },
  },
  utlysning: {
    quote: "Utlysningen fra Sigve Simonsen AS: «Varighet: 300 timer». Oppstart etter avtale, august til november. To fagspor, energi og marked.",
    doc: { no: "Utlysning av praksisplass for studenter ved Universitetet i Agder, 2026", en: "Internship posting for University of Agder students, 2026" },
  },
  arbeidsplan: {
    quote: "Faser: 1 Oppstart (uke 1), 2 Befaring (dato avtales), 3 Research (uke 2 til 4), 4 Konsept (uke 5 til 7), 5 Kvalitetssikring (uke 8 til 10), 6 Sluttfase (uke 11 til 12). «Kontorbygg med inntil 28 kontorer».",
    doc: { no: "Arbeidsopplegg for spor 1 og 2, prosjekteier, august 2026", en: "Work structure for tracks 1 and 2, project owner, August 2026" },
  },
  bygg: {
    quote: "«The office building and the residential house located within the project area already exist today. The two green buildings represent the new developments that are currently planned for construction. One is an extension of the existing office building, while the other is a warehouse/workshop building. This building will be located directly behind the residential house.»",
    doc: { no: "E-post fra prosjekteier", en: "Email from the project owner" },
  },
  kontor: {
    quote: "«I can obtain the actual electricity consumption for the 19 offices that are currently completed. The building is being expanded to a total of 28 offices.»",
    doc: DIRECTION_DOC(5),
  },
  lager: {
    quote: "«You may use the annual consumption of one home as a conservative planning assumption.» «The assumption must be clearly labelled and replaced with actual meter data when available.»",
    doc: DIRECTION_DOC(4),
  },

  // the energy direction
  retning: {
    quote: "«The aim is not to build the development around a single technology. The aim is to create a robust, flexible and future-ready energy system in which solar energy, possible wind power, individual and shared batteries, smart control and future solutions can work together.»",
    doc: DIRECTION_DOC(),
  },
  batteri: {
    quote: "«Each home should have its own battery and energy management, with possible access to shared storage.»",
    doc: DIRECTION_DOC(8),
  },
  paneler: {
    quote: "«The solar concept should combine optimised house surfaces with a shared installation, initially modelled at around 600 panels.» «The figure of 600 panels is a capacity scenario, not yet a confirmed solar area.»",
    doc: DIRECTION_DOC(6),
  },
  vind: {
    quote: "«Wind energy should be evaluated as a complementary source at both household and shared-system level, based on local measurements and a realistic technical and economic assessment.»",
    doc: DIRECTION_DOC(8),
  },
  mikronett: {
    quote: "«A microgrid should be investigated at a limited level, but it should not be a prerequisite for the project.»",
    doc: DIRECTION_DOC(8),
  },
  sand: {
    quote: "«The sand battery should remain an option, but no major resources should be committed until the overall system is better defined.»",
    doc: DIRECTION_DOC(8),
  },

  // the energy track
  tiltak: {
    quote: "«The building standard for the project has not been fixed yet, so all figures below should be treated as indicative rather than final.» Tiltakene er sammenlignet på kostnad, oppstartskostnad, gjennomførbarhet, robusthet ved strømbrudd og energi.",
    doc: { no: "Statusoppsummering, energisporet, 31. august 2026, og sammenligning av tiltak, 28. august 2026", en: "Status summary, energy track, 31 August 2026, and comparison of measures, 28 August 2026" },
  },
  sol: {
    quote: "«For a solar panel footprint of 1,350 m², estimated production is 235,254.78 kWh/year.» Energiregnskapet regner 243 567 kWh med 31 % modulvirkningsgrad, som arket selv sier er satt for høyt og gir om lag 30 % for høy solproduksjon.",
    doc: { no: "Statusoppsummering, energisporet, 31. august 2026, og energiregnskapet, september 2026", en: "Status summary, energy track, 31 August 2026, and the energy budget, September 2026" },
  },
  budsjett: {
    quote: "Totalt energibehov prosjektet (el + varme): 719 500 kWh, med realistisk spenn om lag ±25 %. «Antall boliger» 30. Batteri 14 kWh per bolig, 420 kWh samlet.",
    doc: BUDGET_DOC,
  },
  selvforsyning: {
    quote: "«Selvforsyningsgrad strøm»: 52,5 %. Arket sier selv at modulvirkningsgraden er satt for høyt og gir om lag 30 % for høy solproduksjon.",
    doc: BUDGET_DOC,
  },
  besparelse: {
    quote: "«Besparelse per bolig (forenklet fordeling)»: 39 229 kr per år, mot en referanse der alt varmebehov dekkes med direkte elektrisk oppvarming, uten solceller, vindturbiner eller batteri.",
    doc: BUDGET_DOC,
  },
  co2: {
    quote: "«Spart CO₂»: 104 190 kg per år, regnet med 0,2 kg CO₂ per kWh nettstrøm, som arket kaller et metodevalg.",
    doc: BUDGET_DOC,
  },
  eed: {
    quote: "Earth Energy Designer: «28 : 4 x 12, open rectangle», dybde 105,83 m, avstand 15 m, «Double-U». «Fluid temperatures for last year: min: -0,78°C max: 8,12°C».",
    doc: { no: "Grunnvarmeanalyse i Earth Energy Designer, energisporet, september 2026", en: "Ground source heat analysis in Earth Energy Designer, energy track, September 2026" },
  },

  // the website's own computations (not a source of facts, only the record of how a number was computed)
  modell: {
    quote: "Terreng: Kartverket NHM DTM 1 m (hoydedata.no). Trær: DOM minus DTM, tretoppdeteksjon. Horisont: AWS Terrain Tiles. Sol: NOAA solposisjon. Sikt: linje for linje over terrenget. Utlegget er et foreløpig forslag, ikke prosjekteiers plan.",
    doc: { no: "Nettsidens modell, beregnet 30. september 2026 for foreløpig utlegg v6", en: "The website's model, computed 30 September 2026 for provisional layout v6" },
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof ALL;

/** Typed as a plain record so optional fields such as `url` can be read on any entry. */
export const SOURCES: Record<SourceId, Source> = ALL;
