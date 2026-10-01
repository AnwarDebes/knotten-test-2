import { FACT, word } from "./facts";

export type Locale = "no" | "en";
export const LOCALES: Locale[] = ["no", "en"];

const dict = {
  no: {
    nav: { plots: "Tomtene", view: "Utsikten", energy: "Energi", area: "Området", project: "Prosjektet", investor: "Investor", contact: "Kontakt", login: "Logg inn", interest: "Meld interesse", menu: "Meny", close: "Lukk", portal: "Portal", logout: "Logg ut" },
    tagline: "Sjøutsikt i Rødberg",
    hero: {
      line1: "Stå på tomten",
      line2: "før den finnes.",
      sub: `Rundt ${FACT.plots} energivennlige boliger på en skogkledd knaus over Sniksfjorden. Terrenget er Kartverkets laserdata, solen er den ekte, og alt kan sjekkes.`,
      arcTitle: "Solen over Knotten, 21. desember",
      arcSub: "Den korteste dagen, regnet mot den målte horisonten fra tomt 1.",
      firstSun: "første sol",
      lastSun: "siste sol",
    },
    moves: {
      wipe: { title: "I dag og etterpå", sub: "Dra i skillet. Samme kamera, samme sol, samme horisont. Bare feltet forandrer seg." },
      stand: { title: "Stå på din tomt", sub: "Velg en tomt. Kameraet går ned i stuehøyde. Drei solen gjennom døgnet og året." },
      proof: { title: "Fotografi mot modell", sub: "Naboens grillbu, samme punkt, samme retning. Når horisonten stemmer, stemmer resten." },
      field: { title: "Feltet som lever", sub: "Energien tegnet på landskapet: produksjon på takene, forbruk i vinduene, mulig deling langs veien." },
    },
    stage: { open: "Åpne modellen", opening: "Bygger terrenget", loading: "Laster", ready: "Modellen er klar", lite: "Lett modus", lost: "Grafikkortet ga opp. Prøv lett modus.", retry: "Prøv lett modus", flyin: "Se flyturen", closeFlyin: "Lukk", hint: "Dra for å se rundt. Rull for å zoome.", plot: "Tomt", grid: "Slå av nettet", gridOff: "Nettet er av. Illustrasjon av drift på lager", cameras: { fjord: "Fra fjorden", site: "Feltet", drone: "Fra vest", knoll: "Fra toppen", plan: "Ovenfra" }, sunHint: "Sol og dato" },
    journey: { start: "Start reisen", stop: "Stopp", next: "Neste", explore: "Utforsk selv", steps: { fjord: { title: "Fra fjorden", text: "Sniksfjorden sett innover mot Rødberg. Knotten er knausen midt i bildet, nær der Audna renner ut i fjorden." }, field: { title: "Feltet", text: `${FACT.plots} tomter i ${word(FACT.rows)} rekker i modellen: A, B og C over hverandre i sørhellingen og D på knausen Knotten, der terrenget gir utsikt. Ønsket er sjøutsikt fra alle tomtene, men det er ikke sikkert at det går fra alle.` }, plot: { title: "Din tomt", text: "Kameraet står i stuehøyde på tomten. Det gule båndet på horisonten er der vannet er synlig, sterkest der det er åpent hav." }, inside: { title: "Inne i huset", text: "Stua med glassveggen mot fjorden. Det du ser gjennom vinduet er det målte terrenget, ikke et bilde." } } },
    states: { today: "I dag", cleared: "Ryddet", built: "Bygget", lived: "Bebodd" },
    dial: { month: "Måned", hour: "Klokka", sunUp: "Sol over terrenget", sunDown: "Sol bak terrenget" },
    passport: { title: "Solpass", sunDec: "Sol 21. desember", sunMar: "Sol 21. mars", sunJun: "Sol 21. juni", first: "første sol", last: "siste sol", seaDeg: "Sjø i sikt", openSea: "Åpent hav", yes: "ja", no: "nei", elevation: "Høyde", slope: "Helning", cutfill: "Planering", share: "Del solpasset", row: "Rekke", flat: "Flaten ved Rødbergsveien" },
    cta: { register: "Meld interesse", seePlots: "Se tomtene", investor: "For investorer", passport: "Åpne solpasset" },
    provenance: { computed: "beregnet", provisional: "foreløpig", source: "Kilde" },
    footer: { rights: "Sigve Simonsen AS", data: "Data: Kartverket (CC BY 4.0), Norkart, OpenStreetMap (ODbL), AWS Terrain Tiles. Flyfoto i modellen: Esri World Imagery (studie).", privacy: "Personvern" },
  },
  en: {
    nav: { plots: "Plots", view: "The view", energy: "Energy", area: "The area", project: "The project", investor: "Investors", contact: "Contact", login: "Log in", interest: "Register interest", menu: "Menu", close: "Close", portal: "Portal", logout: "Log out" },
    tagline: "Sea view at Rødberg",
    hero: {
      line1: "Stand on your plot",
      line2: "before it exists.",
      sub: `About ${FACT.plots} energy-friendly homes on a wooded knoll above Sniksfjorden. The terrain is national LiDAR, the sun is the real one, and everything can be checked.`,
      arcTitle: "The sun over Knotten, 21 December",
      arcSub: "The shortest day, computed against the measured horizon from plot 1.",
      firstSun: "first sun",
      lastSun: "last sun",
    },
    moves: {
      wipe: { title: "Today and after", sub: "Drag the divider. Same camera, same sun, same horizon. Only the field changes." },
      stand: { title: "Stand on your plot", sub: "Pick a plot. The camera drops to living-room height. Turn the sun through the day and the year." },
      proof: { title: "Photograph against model", sub: "The neighbour's grill hut, same point, same bearing. When the horizon lines up, so does the rest." },
      field: { title: "The living field", sub: "Energy drawn on the landscape: production on the roofs, consumption in the windows, possible sharing along the road." },
    },
    stage: { open: "Open the model", opening: "Building the terrain", loading: "Loading", ready: "The model is ready", lite: "Lite mode", lost: "The graphics card gave up. Try lite mode.", retry: "Try lite mode", flyin: "Watch the fly-in", closeFlyin: "Close", hint: "Drag to look around. Scroll to zoom.", plot: "Plot", grid: "Cut the grid", gridOff: "Grid is off. An illustration of running on storage", cameras: { fjord: "From the fjord", site: "The field", drone: "From the west", knoll: "From the top", plan: "From above" }, sunHint: "Sun and date" },
    journey: { start: "Start the journey", stop: "Stop", next: "Next", explore: "Explore yourself", steps: { fjord: { title: "From the fjord", text: "Sniksfjorden looking in towards Rødberg. Knotten is the knoll in the middle, near where the Audna flows into the fjord." }, field: { title: "The field", text: `${FACT.plots} plots in ${word(FACT.rows, "en")} rows in the model: A, B and C one above the other on the south face and D on the Knotten knoll, where the ground gives a view. The aim is a sea view from every plot, but it is not certain every plot will get one.` }, plot: { title: "Your plot", text: "The camera stands at living-room height on the plot. The amber band on the horizon is where water is visible, strongest where it is open sea." }, inside: { title: "Inside the house", text: "The living room with the glass wall towards the fjord. What you see through the window is the measured terrain, not a picture." } } },
    states: { today: "Today", cleared: "Cleared", built: "Built", lived: "Lived-in" },
    dial: { month: "Month", hour: "Time", sunUp: "Sun above the terrain", sunDown: "Sun behind the terrain" },
    passport: { title: "Sun passport", sunDec: "Sun 21 December", sunMar: "Sun 21 March", sunJun: "Sun 21 June", first: "first sun", last: "last sun", seaDeg: "Water in view", openSea: "Open sea", yes: "yes", no: "no", elevation: "Elevation", slope: "Slope", cutfill: "Levelling", share: "Share the passport", row: "Row", flat: "The flat by Rødbergsveien" },
    cta: { register: "Register interest", seePlots: "See the plots", investor: "For investors", passport: "Open the sun passport" },
    provenance: { computed: "computed", provisional: "provisional", source: "Source" },
    footer: { rights: "Sigve Simonsen AS", data: "Data: Kartverket (CC BY 4.0), Norkart, OpenStreetMap (ODbL), AWS Terrain Tiles. Aerial imagery in the model: Esri World Imagery (study).", privacy: "Privacy" },
  },
} as const;

export type Dict = (typeof dict)["no"];
export function t(locale: Locale): Dict {
  return (dict[locale] ?? dict.no) as Dict;
}
export function isLocale(x: string): x is Locale {
  return LOCALES.includes(x as Locale);
}
export const MONTHS = {
  no: ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
