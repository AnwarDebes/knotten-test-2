/**
 * Every number and claim on the site points to one of these entries.
 * "quote" is word for word from the source. "doc" names the document.
 * The rule: a number that is not in this list does not go on the website.
 */
export type Source = { quote: string; doc: string; url?: string };

export const SOURCES: Record<string, Source> = {
  sigve30: {
    quote:
      "«Planen er at det kan bli en plass rundt 30 tomter, ønsket er at alle tomtene skal få sjøutsikt.»",
    doc: "Prosjekteier, melding til prosjektgruppen, september 2026",
  },
  areal: {
    quote:
      "Eiendomskart, Kartverket: Rødbergsveien 121, gnr 355 bnr 10, 39 431 m². Prosjekteier: «+ Gnr 355 Bnr 368 så samlet 40 181 m2».",
    doc: "Norgeskart og e-post fra prosjekteier",
  },
  vei: {
    quote:
      "Skisse til situasjonsplan: «Stigning på veien max 6 %», påført fire ganger langs veien. «Gang sti» mellom rekkene.",
    doc: "Skisse fra prosjekteier",
  },
  regulering: {
    quote:
      "«Prosjektet starter før reguleringsplan, slik at både tekniske og markedsmessige løsninger integreres fra tidlig fase.»",
    doc: "Prosjektbeskrivelse, UiA internship, 2026",
  },
  sjoutsikt: {
    quote:
      "«ønsket er at alle tomtene skal få sjøutsikt». Sjøutsikt fra hver tomt bekreftes når situasjonsplanen er ferdig.",
    doc: "Melding fra prosjekteier, september 2026",
  },
  profil: {
    quote:
      "Terrengprofil tegnet i Norgeskart fra punkt A ved Spangereidveien til punkt B ved Knotten: 409,5 m. Diagrammet er merket 0 moh og 60 moh.",
    doc: "Norgeskart, skjermbilde fra prosjekteier",
  },
  bygg: {
    quote:
      "«The office building and the residential house located within the project area already exist today. The two green buildings represent the new developments that are currently planned for construction.»",
    doc: "E-post fra prosjekteier",
  },
  retning: {
    quote:
      "«The aim is not to build the development around a single technology. The aim is to create a robust, flexible and future-ready energy system.»",
    doc: "Foreløpig retning for energikonseptet, prosjekteier, 4. september 2026",
  },
  batteri: {
    quote:
      "«Each home should have its own battery and energy management, with possible access to shared storage.»",
    doc: "Foreløpig retning for energikonseptet, punkt 8",
  },
  paneler: {
    quote:
      "«An initial scenario based on approximately 600 panels in the shared installation. The figure of 600 panels is a capacity scenario, not yet a confirmed solar area.»",
    doc: "Foreløpig retning for energikonseptet, punkt 6",
  },
  vind: {
    quote:
      "«Wind energy should be evaluated as a complementary source at both household and shared-system level, based on local measurements.»",
    doc: "Foreløpig retning for energikonseptet, punkt 8",
  },
  mikronett: {
    quote:
      "«A microgrid should be investigated at a limited level, but it should not be a prerequisite for the project.»",
    doc: "Foreløpig retning for energikonseptet, punkt 8",
  },
  sand: {
    quote:
      "«The sand battery should remain an option, but no major resources should be committed until the overall system is better defined.»",
    doc: "Foreløpig retning for energikonseptet, punkt 8",
  },
  tak: {
    quote:
      "«South-facing roofs should be kept as simple and unobstructed as possible, with limited dormers, projections or other elements that reduce continuous panel area or create shading.»",
    doc: "Foreløpig retning for energikonseptet, punkt 6",
  },
  budsjett: {
    quote:
      "Totalt energibehov 719 500 kWh per år, el og varme, boliger, kontor og lager, merket «realistisk spenn ca. ±25 %». Batteri 14 kWh per bolig, 420 kWh samlet. Spart CO₂ 104 190 kg per år med utslippsfaktor 0,2 kg per kWh, merket «Metodevalg».",
    doc: "Energiregnskap, arbeidsversjon, energisporet",
  },
  selvforsyning: {
    quote:
      "Selvforsyningsgrad strøm 52,5 %. Samme ark sier at modulvirkningsgraden er satt for høyt og gir cirka 30 % for høy solproduksjon. Tallet vil gå ned.",
    doc: "Energiregnskap, arbeidsversjon, energisporet",
  },
  eed: {
    quote:
      "Earth Energy Designer: 28 brønner, 4 x 12 åpen rektangel, dybde 105,83 m, avstand 15 m, dobbel U. Væsketemperatur siste år: min -0,78 °C, maks 8,12 °C.",
    doc: "Grunnvarmeanalyse, energisporet",
  },
  kontor: {
    quote:
      "«I can obtain the actual electricity consumption for the 19 offices that are currently completed. The building is being expanded to a total of 28 offices.»",
    doc: "Foreløpig retning for energikonseptet, punkt 5",
  },
  lager: {
    quote:
      "«You may use the annual consumption of one home as a conservative planning assumption. The assumption must be clearly labelled and replaced with actual meter data.»",
    doc: "Foreløpig retning for energikonseptet, punkt 4",
  },
  henrik: {
    quote:
      "Sammenligningstabell over tiltak med kostnad, oppstartskostnad, gjennomførbarhet, robusthet ved strømbrudd og energi. «Byggestandarden for prosjektet er ikke fastsatt, alle tall er indikative.»",
    doc: "Energisporet, 28. august 2026",
  },
  sol: {
    quote:
      "«For a solar panel footprint of 1,350 m², estimated production is 235,254.78 kWh/year.» Nettsiden avrunder og viser spenn, ikke to desimaler.",
    doc: "Statusoppsummering, energisporet",
  },
  besparelse: {
    quote:
      "Besparelse per bolig, forenklet fordeling: 39 229 kr per år, mot en referanse med direkte elektrisk oppvarming uten solceller, vind eller batteri.",
    doc: "Energiregnskap, arbeidsversjon, energisporet",
  },
  audna: {
    quote:
      "«Audna er 55 kilometer lang» og «Audna munner ut i Sniksfjorden». Snigsfjorden er om lag 3 km lang og begynner ved Audnas utløp ved Snig, om lag 4 km sør for Vigeland.",
    doc: "Wikipedia: Audna (norsk) og Snigsfjorden (engelsk), lest 13. september 2026",
    url: "https://no.wikipedia.org/wiki/Audna",
  },
  vigeland: {
    quote:
      "Vigeland har 1 708 innbyggere per 1. januar 2025 og var administrasjonssenter i Lindesnes kommune fram til kommunesammenslåingen i 2020. Fylkesvei 460 går fra Lindesnes fyr via Spangereid til Vigeland, der den krysser E39.",
    doc: "Wikipedia: Vigeland og Fylkesvei 460, lest 13. september 2026",
    url: "https://no.wikipedia.org/wiki/Vigeland",
  },
  posisjon: {
    quote:
      "Posisjon 58.068057, 7.278401 gir adressen Rødbergsveien, Raudberg, Vigeland, Lindesnes, 4520 (OpenStreetMap). Eiendomskart: Rødbergsveien 121, 4520 Lindesnes.",
    doc: "OpenStreetMap Nominatim og Kartverket, 13. september 2026",
    url: "https://www.openstreetmap.org/?mlat=58.068057&mlon=7.278401#map=16/58.0681/7.2784",
  },
  solbane: {
    quote:
      "Soltider er beregnet astronomisk for posisjonen 58.068 N, 7.278 Ø, uten terrengskygge fra åsene rundt. Faktisk sol på tomtene kan avvike og måles på befaring.",
    doc: "Beregning på nettsiden (NOAA-algoritme). Ikke en måling.",
  },
  foto: {
    quote:
      "«Bildet med utsikten er tatt på en nabo tomt, den ligger litt lavere enn dette feltet.»",
    doc: "Prosjekteier, september 2026",
  },
};

/** Rows for the public "Kilder og forutsetninger" page. One row per number. */
export const FIGURES: {
  what: string;
  value: string;
  unit: string;
  src: keyof typeof SOURCES;
  status: "Fastsatt" | "Foreløpig" | "Beregnet" | "Verifisert";
  owner: string;
}[] = [
  { what: "Antall tomter", value: "rundt 30", unit: "tomter", src: "sigve30", status: "Foreløpig", owner: "Prosjekteier" },
  { what: "Samlet tomteareal", value: "40 181", unit: "m²", src: "areal", status: "Fastsatt", owner: "Kartverket" },
  { what: "Maks stigning på vei", value: "6", unit: "%", src: "vei", status: "Foreløpig", owner: "Prosjekteier" },
  { what: "Terrengprofil, lengde", value: "409,5", unit: "m", src: "profil", status: "Fastsatt", owner: "Norgeskart" },
  { what: "Terrengprofil, høyde", value: "0 til 60", unit: "moh", src: "profil", status: "Fastsatt", owner: "Norgeskart" },
  { what: "Kontorer ferdig i dag", value: "19", unit: "kontorer", src: "kontor", status: "Fastsatt", owner: "Prosjekteier" },
  { what: "Kontorer etter utvidelse", value: "28", unit: "kontorer", src: "kontor", status: "Fastsatt", owner: "Prosjekteier" },
  { what: "Felles solanlegg, scenario", value: "ca. 600", unit: "paneler", src: "paneler", status: "Foreløpig", owner: "Prosjekteier" },
  { what: "Samlet energibehov", value: "ca. 720 000 ±25 %", unit: "kWh/år", src: "budsjett", status: "Foreløpig", owner: "Energisporet" },
  { what: "Selvforsyning strøm", value: "52,5", unit: "%", src: "selvforsyning", status: "Foreløpig", owner: "Energisporet" },
  { what: "Solstrøm fra 1 350 m²", value: "ca. 235 000", unit: "kWh/år", src: "sol", status: "Foreløpig", owner: "Energisporet" },
  { what: "Energibrønner", value: "28 x 106", unit: "stk x m", src: "eed", status: "Beregnet", owner: "Energisporet" },
  { what: "Besparelse per bolig", value: "ca. 39 000", unit: "kr/år", src: "besparelse", status: "Foreløpig", owner: "Energisporet" },
  { what: "Solstrøm i energiregnskapet", value: "ca. 244 000", unit: "kWh/år", src: "selvforsyning", status: "Foreløpig", owner: "Energisporet" },
  { what: "Batterikapasitet samlet", value: "420", unit: "kWh", src: "budsjett", status: "Foreløpig", owner: "Energisporet" },
  { what: "CO₂ spart per år", value: "ca. 104 000", unit: "kg", src: "budsjett", status: "Foreløpig", owner: "Energisporet" },
  { what: "Løkkeheia, høyde", value: "88,5", unit: "moh", src: "areal", status: "Fastsatt", owner: "Norkart" },
  { what: "Audna, lengde", value: "55", unit: "km", src: "audna", status: "Verifisert", owner: "Wikipedia" },
  { what: "Vigeland, innbyggere 2025", value: "1 708", unit: "personer", src: "vigeland", status: "Verifisert", owner: "Wikipedia" },
];
