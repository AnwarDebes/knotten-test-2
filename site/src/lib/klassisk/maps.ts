import { DOCS, EED as SIM, FACT, WIND_SCALE, dateLong, fmt } from "@/lib/facts";

/** Maps and drawings from the project owner, and analysis images from the energy track. Shown at native size, never upscaled. */
export type MapImg = { src: string; w: number; h: number; alt: string; title: string; text: string; credit: string };

export const MAPS: Record<string, MapImg> = {
  siktlinje: {
    src: "/img/kart-siktlinje.png", w: 445, h: 369,
    alt: "Regionkart med stiplet linje fra byggefeltet ved Raudberg sørover forbi Snig til åpent hav",
    title: "Siktlinjen til havet",
    text: "Prosjekteiers kart: «Stiplet linje er inn til byggefeltet og sikt linjen ut til åpent hav.» Linjen går fra Raudberg forbi Snig og ut Sniksfjorden.",
    credit: "Prosjekteier",
  },
  omrade: {
    src: "/img/kart-omrade.png", w: 832, h: 856,
    alt: `Kart der prosjektområdet er markert med blå strek langs eiendomsgrensen, med Løkkeheia ${fmt(FACT.lokkeheia_m)} moh, Knotten og Rødbergsveien`,
    title: "Prosjektområdet",
    text: `Området er markert i blått langs den røde eiendomsgrensen. Det dekker knausen Knotten og en smalere del ned til Rødbergsveien ved husnummer 121 og 123. Løkkeheia bak feltet ligger ${fmt(FACT.lokkeheia_m)} moh.`,
    credit: "Prosjekteier, kartgrunnlag Norkart",
  },
  eiendom: {
    src: "/img/kart-eiendom.png", w: 928, h: 703,
    alt: `Eiendomskart fra Norgeskart for ${FACT.property_address}, gnr ${FACT.gnr} bnr ${FACT.bnr}, ${fmt(FACT.parcel_bnr10_m2)} m²`,
    title: "Eiendommen",
    text: `${FACT.property_address}, ${FACT.postcode}. Gnr ${FACT.gnr} bnr ${FACT.bnr}, ${fmt(FACT.parcel_bnr10_m2)} m². Sammen med bnr ${FACT.bnr_extra} er arealet ${fmt(FACT.parcel_m2)} m².`,
    credit: "Norgeskart, Kartverket",
  },
  bygg: {
    src: "/img/kart-bygg.png", w: 451, h: 426,
    alt: "Kartutsnitt med høydekurver over Knotten, eksisterende bygg i oransje og to planlagte bygg i grønt",
    title: "Byggene i dag og de som er planlagt",
    text: "Oransje bygg finnes i dag. De to grønne er planlagt: en utvidelse av kontorbygget og et lager- og verkstedbygg rett bak bolighuset.",
    credit: "Prosjekteier, kartgrunnlag Norkart",
  },
  skisse: {
    src: "/img/skisse-situasjonsplan.png", w: 1234, h: 777,
    alt: `Skisse over flyfoto: rekker med boliger langs en vei i hårnålssvinger, merket Stigning på veien max ${FACT.road_grade_pct} % og Gang sti`,
    title: "Skissen til situasjonsplan",
    text: `Prosjekteiers første skisse: boligrekker langs en vei som svinger seg oppover feltet med maks ${FACT.road_grade_pct} prosent stigning, gangstier mellom rekkene, og de to planlagte byggene i grønt nederst til høyre.`,
    credit: "Prosjekteier",
  },
  terreng: {
    src: "/img/kart-terreng-1km.png", w: 1000, h: 1000,
    alt: "Terrengkart over 1 km rundt Knotten med 5 m høydekoter, veier og bygg, laget fra Kartverkets høydemodell",
    title: "Terrenget rundt Knotten",
    text: `En kilometer rundt feltet, tegnet for nettsiden fra Kartverkets høydemodell med 1 m oppløsning og 5 m koter. Det røde krysset er posisjonen ${FACT.lat}, ${FACT.lon}. Åsene bak stiger til over 190 meter, mens flaten ved elva ligger nær havnivå.`,
    credit: "Laget for nettsiden: Kartverket DTM 1 m (CC BY 4.0), veier og bygg fra OpenStreetMap (ODbL)",
  },
  profil: {
    src: "/img/kart-terrengprofil.png", w: 830, h: 675,
    alt: `Terrengprofil i Norgeskart fra punkt A ved Spangereidveien til punkt B ved Knotten, ${fmt(FACT.profile_m)} m, 0 til ${FACT.knotten_m} moh`,
    title: "Terrengprofilen",
    text: `Fra vannet ved Spangereidveien (A) til Knotten (B) er det ${fmt(FACT.profile_m)} meter. Profilen er flat over elvesletta og stiger bratt opp knausen, fra 0 til ${FACT.knotten_m} meter over havet.`,
    credit: "Norgeskart, Kartverket",
  },
  grillbu: {
    src: "/img/kart-grillbu.png", w: 713, h: 494,
    alt: "Kart med pil til naboens grillbu øst for Knotten, der utsiktsbildet er tatt",
    title: "Der utsiktsbildet er tatt",
    text: "«Nabo grillbu med utsikten som vist i bildet.» Grillbua ligger på nabotomten, litt lavere enn feltet.",
    credit: "Prosjekteier, kartgrunnlag Norkart",
  },
};

export const EED: Record<string, MapImg> = {
  grunnlast: {
    src: "/img/eed-grunnlast.png", w: 668, h: 1570,
    alt: "Earth Energy Designer, dialogen Base load med årlig varme, kjøling og tappevann",
    title: "Grunnlast",
    text: `Varme ${SIM.base_heat_mwh} MWh per år, kjøling ${SIM.base_cool_mwh} MWh, tappevann ${SIM.dhw_mwh} MWh med SPF ${fmt(SIM.dhw_spf, "no", 1)}. Netto varme hentet fra grunnen: ${Math.round(SIM.ground_net_mwh)} MWh.`,
    credit: "Energisporet, Earth Energy Designer",
  },
  bronn: {
    src: "/img/eed-bronn.png", w: 820, h: 1380,
    alt: `Earth Energy Designer, dialogen Borehole and heat exchanger med ${SIM.boreholes} brønner i ${SIM.grid} åpen rektangel`,
    title: "Brønnfeltet",
    text: `${SIM.boreholes} brønner i et åpent rektangel på ${SIM.grid}, ${Math.round(SIM.depth_m)} meter dype, ${SIM.spacing_m} meter mellom hver, ${SIM.diameter_mm} mm diameter, dobbel U-kollektor.`,
    credit: "Energisporet, Earth Energy Designer",
  },
  temperatur: {
    src: "/img/eed-temperatur.png", w: 2384, h: 1320,
    alt: `Earth Energy Designer, graf over væsketemperatur i brønnene over ${SIM.years} år`,
    title: `Temperatur over ${SIM.years} år`,
    text: `Grafen stabiliserer seg. Siste år er minimum ${fmt(SIM.fluid_min_c)} °C og maksimum ${fmt(SIM.fluid_max_c)} °C. Energisporet vurderer begge deler som bra.`,
    credit: "Energisporet, Earth Energy Designer",
  },
  notater: {
    src: "/img/energi-notater.png", w: 1423, h: 894,
    alt: "Energisporets forskningsnotater i OneNote: vindkraft, grunnvarme, referanseprosjekter og verktøy",
    title: "Hva som undersøkes videre",
    text: `Vindkraft i klassen ${WIND_SCALE.kw[0]} til ${WIND_SCALE.kw[1]} kW, hybride solceller og solfangere, Varden skole i Bergen og Zero Village Bergen som referanser, og verktøyene TRNSYS og Winsun.`,
    credit: `Energisporet, ${dateLong(DOCS.measures.date)}`,
  },
};
