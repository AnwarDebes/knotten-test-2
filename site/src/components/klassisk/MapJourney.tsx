"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MAPS } from "@/lib/klassisk/maps";
import { Src } from "./Source";

const STEPS: { key: keyof typeof MAPS; src?: "audna" | "areal" | "bygg" | "vei" | "profil" | "foto" | "posisjon" }[] = [
  { key: "siktlinje", src: "audna" },
  { key: "terreng", src: "posisjon" },
  { key: "eiendom", src: "areal" },
  { key: "omrade", src: "areal" },
  { key: "bygg", src: "bygg" },
  { key: "skisse", src: "vei" },
  { key: "profil", src: "profil" },
  { key: "grillbu", src: "foto" },
];

/**
 * "Fra kysten til tomten": the owner's real maps, zooming in step by step as the visitor scrolls.
 * The map stays put on one side; the text steps scroll past and switch the image.
 */
export default function MapJourney() {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setI(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="journey">
      <div className="jsteps">
        {STEPS.map((s, k) => {
          const m = MAPS[s.key];
          return (
            <div key={s.key} ref={(el) => { refs.current[k] = el; }} data-i={k} className={`jstep${i === k ? " on" : ""}`}>
              <span className="jnum">{k + 1} av {STEPS.length}</span>
              <h3>{m.title}</h3>
              <p>{m.text} {s.src && <Src id={s.src} />}</p>
              {k === STEPS.length - 1 && <div className="cta-row" style={{ marginTop: 14 }}><Link className="btn ghost sm" href="/kart">Alle kart i full størrelse</Link></div>}
            </div>
          );
        })}
      </div>
      <div className="jstage">
        <div className="jframe">
          {STEPS.map((s, k) => {
            const m = MAPS[s.key];
            return (
              <div key={s.key} className={`jimg${i === k ? " on" : ""}`}>
                <Image src={m.src} alt={m.alt} width={m.w} height={m.h} sizes="(max-width: 900px) 100vw, 56vw" quality={92} unoptimized={m.w < 900} />
              </div>
            );
          })}
          <div className="jcap">{MAPS[STEPS[i].key].credit}</div>
        </div>
      </div>
    </div>
  );
}
