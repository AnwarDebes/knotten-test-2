/**
 * What the visitor learns at each spot in the house: the installation or the part of the building,
 * why it is there, which of the project's measures it is (with the energy track's verdict), and the
 * source behind it. Figures come from the facts module, so they match the rest of the site.
 */
import { BUDGET, EED, PV_KWP_PER_HOME, fmt, measure, type SourceId } from "@/lib/facts";
import type { LiveFigures } from "../scene/house/walkState";

export type HotspotInfo = {
  title: { no: string; en: string };
  body: { no: string; en: string };
  measure?: string;
  source: SourceId;
  live?: (f: LiveFigures, no: boolean) => string;
};

const n1 = (v: number, no: boolean) => fmt(Math.round(v * 10) / 10, no ? "no" : "en");
const n0 = (v: number, no: boolean) => fmt(Math.round(v), no ? "no" : "en");

export const HOTSPOTS: Record<string, HotspotInfo> = {
  heatpump: {
    title: { no: "Bergvarmepumpe med varmtvann", en: "Ground-source heat pump with hot water" },
    body: {
      no: `Varmen til gulvvarmen og 180 liter varmtvann kommer fra berget under feltet. En væske sirkulerer i felles energibrønner, i energisporets simulering ${EED.boreholes} brønner på om lag ${Math.round(EED.depth_m)} meter, og varmepumpen løfter temperaturen. Over året gir hver kWh strøm om lag ${fmt(BUDGET.bedrock.scop)} kWh varme (energiregnskapets årsvarmefaktor). Ingen utedel på veggen.`,
      en: `The heat for the floor heating and 180 litres of hot water comes from the rock under the field. A fluid circulates in shared boreholes, in the energy track's simulation ${EED.boreholes} boreholes of about ${Math.round(EED.depth_m)} metres, and the heat pump lifts the temperature. Over the year each kWh of power gives about ${fmt(BUDGET.bedrock.scop, "en")} kWh of heat (the energy budget's seasonal factor). No outdoor unit on the wall.`,
    },
    measure: "bedrock",
    source: "eed",
    live: (f, no) => (no ? `Nå: ${n1(f.hp, no)} kW strøm gir ${n1(f.hp * f.cop, no)} kW varme, ute ${n1(f.temp, no)} °C.` : `Now: ${n1(f.hp, no)} kW of power gives ${n1(f.hp * f.cop, no)} kW of heat, ${n1(f.temp, no)} °C outside.`),
  },
  ventilation: {
    title: { no: "Balansert ventilasjon med varmegjenvinning", en: "Balanced ventilation with heat recovery" },
    body: {
      no: "Frisk luft inn til stua og soverommene, brukt luft ut fra kjøkken og bad, gjennom en varmeveksler. Den tar vare på 80 til 90 % av varmen i luften som går ut. Byggeforskriften krever minst 80 % for småhus. Kanalene går over himlingen til takhatten på nordsiden.",
      en: "Fresh air in to the living room and bedrooms, used air out from the kitchen and bathrooms, through a heat exchanger. It keeps 80 to 90 % of the heat in the outgoing air. The building code asks for at least 80 % in small houses. The ducts run above the ceiling to the roof hood on the north side.",
    },
    measure: "heat_recovery",
    source: "tek17",
  },
  battery: {
    title: { no: `Hjemmebatteri, ${BUDGET.battery.per_home_kwh} kWh`, en: `Home battery, ${BUDGET.battery.per_home_kwh} kWh` },
    body: {
      no: `Lagrer solstrøm fra dagen til kvelden og jevner ut effekttoppene. Energiregnskapet regner med ${BUDGET.battery.per_home_kwh} kWh per bolig, og prosjekteier ønsker eget batteri og energistyring i hver bolig. I simuleringen holdes 30 % i reserve for strømbrudd.`,
      en: `Stores the day's solar power for the evening and evens out the peaks. The energy budget counts ${BUDGET.battery.per_home_kwh} kWh per home, and the project owner wants a battery and energy management in every home. The simulation keeps 30 % in reserve for a power cut.`,
    },
    measure: "battery_home",
    source: "batteri",
    live: (f, no) => (no ? `Nå: ${n0(f.soc * 100, no)} % ladet.` : `Now: ${n0(f.soc * 100, no)} % charged.`),
  },
  inverter: {
    title: { no: "Vekselretter for solcellene", en: "Inverter for the solar modules" },
    body: {
      no: `Gjør likestrømmen fra modulene på taket om til vekselstrøm for huset og styrer ladingen av batteriet. Energiregnskapet regner om lag ${PV_KWP_PER_HOME} kWp per bolig; modellen legger dem på takflaten mot utsikten, slik prosjekteier ønsker enkle sørtak.`,
      en: `Turns the direct current from the modules on the roof into alternating current for the house and runs the battery's charging. The energy budget counts about ${PV_KWP_PER_HOME} kWp per home; the model lays them on the roof slope towards the view, as the project owner wants simple south roofs.`,
    },
    measure: "solar_roof",
    source: "sol",
    live: (f, no) => (no ? `Nå: ${n1(f.pv, no)} kW fra taket. I året: om lag ${n0(f.yearPv, no)} kWh.` : `Now: ${n1(f.pv, no)} kW from the roof. In a year: about ${n0(f.yearPv, no)} kWh.`),
  },
  meter: {
    title: { no: "Strømmåleren og HAN-porten", en: "The meter and its HAN port" },
    body: {
      no: "Den smarte strømmåleren har en HAN-port. En liten leser i porten sender forbruk og produksjon i sanntid til energiskjermen og til styringen av varmtvann, varmepumpe og lading. Leseren koster under 1 000 kr og trenger ingen elektriker.",
      en: "The smart meter has a HAN port. A small reader in the port sends consumption and production in real time to the energy screen and to the control of hot water, heat pump and charging. The reader costs under 1,000 kr and needs no electrician.",
    },
    measure: "energy_display",
    source: "tiltak",
  },
  greywater: {
    title: { no: "Varmegjenvinning fra dusjvannet", en: "Heat recovery from the shower water" },
    body: {
      no: "Under dusjsluket renner det varme avløpsvannet gjennom en varmeveksler som forvarmer kaldtvannet på vei til dusjen. Rimelig når det bygges inn fra starten.",
      en: "Under the shower drain the warm waste water runs through a heat exchanger that preheats the cold water on its way to the shower. Affordable when it is built in from the start.",
    },
    measure: "greywater",
    source: "tiltak",
  },
  screen: {
    title: { no: "Energiskjermen", en: "The energy screen" },
    body: {
      no: "Viser hva taket gir, hva huset bruker, batteriet, varmepumpen og hva som kjøpes, selges og deles med naboene, time for time. Tallene her er husets egne fra energisimuleringen på timen du har valgt.",
      en: "Shows what the roof makes, what the house uses, the battery, the heat pump and what is bought, sold and shared with the neighbours, hour by hour. The figures here are the house's own from the energy simulation at the hour you have chosen.",
    },
    measure: "energy_display",
    source: "tiltak",
  },
  kitchen: {
    title: { no: "Smart styring", en: "Smart control" },
    body: {
      no: "Oppvaskmaskin, varmtvann og lading styres etter pris, effekt og sol: de går når taket gir strøm eller strømmen er billig, og venter når nettet er presset. Det gjør solstrømmen mer verdt og unngår dyre effekttrinn.",
      en: "Dishwasher, hot water and charging run by price, power and sun: they run when the roof makes power or power is cheap, and wait when the grid is under pressure. That makes the solar power worth more and avoids expensive peak tariffs.",
    },
    measure: "smart_control",
    source: "tiltak",
  },
  windows: {
    title: { no: "Vinduer med trelags glass", en: "Triple-glazed windows" },
    body: {
      no: "U-verdi 0,80 W/m²K eller bedre, som byggeforskriftens krav for småhus. Glassveggen mot sør gir vintersol og varme inn i stua; takutstikket skygger for noe av den høye sommersola. Sola du ser på gulvet, kommer inn akkurat der vinduet slipper den inn, på den tiden du har valgt.",
      en: "U-value 0.80 W/m²K or better, as the building code asks of small houses. The glass wall to the south lets winter sun and heat into the living room; the roof overhang shades some of the high summer sun. The sun you see on the floor comes in exactly where the window lets it, at the time you have chosen.",
    },
    measure: "air_sealing",
    source: "tek17",
  },
  wall: {
    title: { no: "Tett og godt isolert", en: "Airtight and well insulated" },
    body: {
      no: "Ytterveggene er 35 cm: stående kledning, lufting, vindsperre, 25 cm isolasjon, dampsperre og innvendig kledning, til U 0,18 W/m²K eller bedre. Taket er isolert til 0,13 og gulvet til 0,10. Huset trykktestes: lekkasjetallet skal være 0,6 luftvekslinger i timen eller lavere.",
      en: "The outer walls are 35 cm: standing cladding, an air gap, a wind barrier, 25 cm of insulation, a vapour barrier and the inner lining, to U 0.18 W/m²K or better. The roof is insulated to 0.13 and the floor to 0.10. The house is pressure tested: no more than 0.6 air changes an hour.",
    },
    measure: "air_sealing",
    source: "tek17",
  },
  floorheat: {
    title: { no: "Vannbåren gulvvarme", en: "Water-borne floor heating" },
    body: {
      no: "Lavt temperert vann, 25 til 35 °C, i gulvene gir jevn varme og lar varmepumpen jobbe med best virkningsgrad. Fordelerskapet med en sløyfe per rom står i teknisk rom.",
      en: "Low-temperature water, 25 to 35 °C, in the floors gives even warmth and lets the heat pump work at its best efficiency. The manifold with one loop per room is in the plant room.",
    },
    measure: "bedrock",
    source: "eed",
  },
  sofa: {
    title: { no: "Utsikten fra stua", en: "The view from the living room" },
    body: {
      no: "Det du ser gjennom glassveggen, er det målte terrenget og sjøen, ikke et bilde. Siktanalysen for tomta regnes fra stuehøyde med nabohusene stående.",
      en: "What you see through the glass wall is the measured terrain and the sea, not a picture. The plot's view analysis is computed from living-room height with the neighbouring houses standing.",
    },
    source: "modell",
  },
};

export const verdictLabel = (id: string | undefined, no: boolean) => {
  if (!id) return null;
  const m = measure(id);
  const label = m.verdict === "yes" ? (no ? "Ja" : "Yes") : m.verdict === "maybe" ? (no ? "Kanskje" : "Maybe") : (no ? "Nei" : "No");
  return { label, name: m.name[no ? "no" : "en"], verdict: m.verdict };
};
