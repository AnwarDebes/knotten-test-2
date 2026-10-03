"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import Src from "./Source";
import { FACT, cap, fmt, word, type SourceId } from "@/lib/facts";

type Step = { file: string; title: { no: string; en: string }; text: { no: string; en: string }; credit: { no: string; en: string }; src?: SourceId };

/** The project owner's own maps, from the coast down to the sketch, in the order one would zoom in. */
const STEPS: Step[] = [
  { file: "sightline_map.webp", credit: { no: "Kart: prosjekteier", en: "Map: project owner" }, src: "sikt",
    title: { no: "Siktlinjen ut til havet", en: "The sight line to the sea" },
    text: { no: "Fra Raudberg ved Vigeland går den stiplede linjen sørover forbi Snig og ut på åpent hav. Det er den retningen feltet ser.", en: "From Raudberg by Vigeland the dashed line runs south past Snig and out to open sea. That is the direction the field faces." } },
  { file: "terrain_profile.webp", credit: { no: "Norgeskart, prosjekteier", en: "Norgeskart, project owner" }, src: "profil",
    title: { no: "Fra vannet og opp", en: "From the water and up" },
    text: { no: `Terrengprofilen er tegnet fra Spangereidveien nede ved vannet til Knotten. ${fmt(FACT.profile_m)} meter, flatt først, så bratt opp knausen.`, en: `The terrain profile is drawn from Spangereidveien down by the water to Knotten. ${fmt(FACT.profile_m, "en")} metres, flat at first, then steeply up the knoll.` } },
  { file: "norgeskart_property.webp", credit: { no: "Kartverket, Norgeskart", en: "Kartverket, Norgeskart" }, src: "areal",
    title: { no: "Eiendommen", en: "The parcel" },
    text: { no: `${FACT.property_address}, gnr ${FACT.gnr} bnr ${FACT.bnr}, ${fmt(FACT.parcel_bnr10_m2)} m². Sammen med bnr ${FACT.bnr_extra} er eiendommene ${fmt(FACT.parcel_m2)} m² til sammen.`, en: `${FACT.property_address}, cadastral ${FACT.gnr}/${FACT.bnr}, ${fmt(FACT.parcel_bnr10_m2, "en")} m². With ${FACT.gnr}/${FACT.bnr_extra} the properties are ${fmt(FACT.parcel_m2, "en")} m² in all.` } },
  { file: "cadastral_map.webp", credit: { no: "Norkart, prosjekteier", en: "Norkart, project owner" }, src: "flat",
    title: { no: "Området som inngår", en: "The area that goes in" },
    text: { no: "Prosjekteier har merket området i blått langs den røde grensen: hele knausen, og tungen ned til Rødbergsveien der kontoret og boligen står. Prosjekteier sier at tomter nede på flaten ikke får sjøutsikt.", en: "The project owner marked the area in blue along the red boundary: the whole knoll, and the tongue down to Rødbergsveien where the office and the house stand. The project owner says plots down on the flat will not have a sea view." } },
  { file: "knotten_map.webp", credit: { no: "Norkart, prosjekteier", en: "Norkart, project owner" }, src: "bygg",
    title: { no: "Det som står der i dag", en: "What stands there today" },
    text: { no: "Kontorbygget og boligen nederst finnes allerede. De to grønne byggene er planlagt: et tilbygg til kontoret og et lager- og verkstedbygg bak boligen.", en: "The office and the house at the bottom already exist. The two green buildings are planned: an extension to the office and a warehouse and workshop behind the house." } },
  { file: "grillbu_map.webp", credit: { no: "Norkart, prosjekteier", en: "Norkart, project owner" }, src: "foto",
    title: { no: "Der utsiktsbildet er tatt", en: "Where the view photo was taken" },
    text: { no: "Naboens grillbu ligger på skrenten øst for Knotten, litt lavere enn feltet. Utsiktsbildet er tatt derfra.", en: "The neighbour's grill hut sits on the ledge east of Knotten, a little lower than the field. The view photo was taken from there." } },
  { file: "site_plan_sketch.webp", credit: { no: "Skisse: prosjekteier", en: "Sketch: project owner" }, src: "vei",
    title: { no: "Skissen", en: "The sketch" },
    text: { no: `${cap(word(FACT.rows))} rekker av hus langs én vei som svinger seg opp hellingen i hårnålssvinger, med maks ${FACT.road_grade_pct} prosent stigning og gangstier mellom rekkene. Modellen på forsiden legger rekkene inn i det målte terrenget innenfor eiendomsgrensen: A, B og C over hverandre i sørhellingen og D på knausen Knotten.`, en: `${cap(word(FACT.rows, "en"))} rows of houses along one road that hairpins up the slope, at most ${FACT.road_grade_pct} percent grade, with footpaths between the rows. The model on the front page puts the rows into the measured terrain inside the parcel boundary: A, B and C one above the other on the south face and D on the Knotten knoll.` } },
];

/**
 * The maps behind the plan: the map stays on one side while the steps scroll past and switch it.
 * One IntersectionObserver, images lazy, opacity only.
 */
export default function MapJourney({ locale }: { locale: Locale }) {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setI(Number((e.target as HTMLElement).dataset.i)); }), { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="journey">
      <div className="jsteps">
        {STEPS.map((s, k) => (
          <div key={s.file} ref={(el) => { refs.current[k] = el; }} data-i={k} className={`jstep ${i === k ? "on" : ""}`}>
            <span className="jnum">{k + 1} / {STEPS.length}</span>
            <h3>{s.title[locale]}</h3>
            <p className="text-[15.5px] text-ink-2 max-w-[46ch]">{s.text[locale]} {s.src && <Src id={s.src} locale={locale} />}</p>
          </div>
        ))}
      </div>
      <div className="jstage">
        <div className="jframe">
          {STEPS.map((s, k) => (
            <div key={s.file} className={`jimg ${i === k ? "on" : ""}`}>
              <img src={`/assets/incoming/web/${s.file}`} alt={s.title[locale]} loading={k === 0 ? "eager" : "lazy"} />
            </div>
          ))}
          <div className="jcap">{STEPS[i].credit[locale]}</div>
        </div>
      </div>
    </div>
  );
}
