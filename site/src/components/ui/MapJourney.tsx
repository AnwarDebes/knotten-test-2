"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import Src from "./Source";
import type { SourceId } from "@/lib/sources";

type Step = { file: string; title: { no: string; en: string }; text: { no: string; en: string }; credit: string; src?: SourceId };

/** The project owner's own maps, from the coast down to the sketch, in the order one would zoom in. */
const STEPS: Step[] = [
  { file: "sightline_map.webp", credit: "Kart: prosjekteier", src: "sikt",
    title: { no: "Siktlinjen ut til havet", en: "The sight line to the sea" },
    text: { no: "Fra Raudberg ved Vigeland går den stiplede linjen sørover forbi Snig og ut på åpent hav. Det er den retningen feltet ser.", en: "From Raudberg by Vigeland the dashed line runs south past Snig and out to open sea. That is the direction the field faces." } },
  { file: "terrain_profile.webp", credit: "Norgeskart, prosjekteier", src: "profil",
    title: { no: "Fra vannet og opp", en: "From the water and up" },
    text: { no: "Terrengprofilen er tegnet fra Spangereidveien nede ved vannet til Knotten. 409,5 meter, flatt først, så bratt opp knausen.", en: "The terrain profile is drawn from Spangereidveien down by the water to Knotten. 409.5 metres, flat at first, then steeply up the knoll." } },
  { file: "norgeskart_property.webp", credit: "Kartverket, Norgeskart", src: "areal",
    title: { no: "Eiendommen", en: "The parcel" },
    text: { no: "Rødbergsveien 121, gnr 355 bnr 10, 39 431 m². Sammen med bnr 368 er feltet 40 181 m².", en: "Rødbergsveien 121, cadastral 355/10, 39,431 m². With 355/368 the field is 40,181 m²." } },
  { file: "cadastral_map.webp", credit: "Norkart, prosjekteier", src: "flat",
    title: { no: "Området som inngår", en: "The area that goes in" },
    text: { no: "Prosjekteier har merket området i blått langs den røde grensen: hele knausen, og tungen ned til Rødbergsveien der kontoret og boligen står. Flaten ved veien får ikke sjøutsikt, derfor ligger alle tomtene i hellingen.", en: "The project owner marked the area in blue along the red boundary: the whole knoll, and the tongue down to Rødbergsveien where the office and the house stand. The flat by the road has no sea view, so every plot sits on the slope." } },
  { file: "knotten_map.webp", credit: "Norkart, prosjekteier", src: "bygg",
    title: { no: "Det som står der i dag", en: "What stands there today" },
    text: { no: "Kontorbygget og boligen nederst finnes allerede. De to grønne byggene er planlagt: et tilbygg til kontoret og et lager- og verkstedbygg bak boligen.", en: "The office and the house at the bottom already exist. The two green buildings are planned: an extension to the office and a workshop behind the house." } },
  { file: "grillbu_map.webp", credit: "Norkart, prosjekteier", src: "foto",
    title: { no: "Der utsiktsbildet er tatt", en: "Where the view photo was taken" },
    text: { no: "Naboens grillbu ligger på skrenten øst for Knotten, litt lavere enn feltet. Fotografiene på denne siden er tatt derfra.", en: "The neighbour's grill hut sits on the ledge east of Knotten, a little lower than the field. The photographs on this page were taken from there." } },
  { file: "site_plan_sketch.webp", credit: "Skisse: prosjekteier", src: "vei",
    title: { no: "Skissen", en: "The sketch" },
    text: { no: "Rekker av hus langs én vei som svinger seg opp hellingen i hårnålssvinger, med maks 6 prosent stigning og gangstier mellom rekkene. Modellen på forsiden legger rekkene inn i det målte terrenget som terrasser, rekke under rekke, slik prosjekteier vil forme åsen.", en: "Rows of houses along one road that hairpins up the slope, at most 6 percent grade, with footpaths between the rows. The model on the front page puts the rows into the measured terrain as terraces, row under row, the way the project owner intends to shape the hill." } },
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
          <div className="jcap">{STEPS[i].credit}</div>
        </div>
      </div>
    </div>
  );
}
