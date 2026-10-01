import type { Metadata } from "next";
import Image from "next/image";
import PageHead from "@/components/klassisk/PageHead";
import Reveal from "@/components/klassisk/Reveal";
import { MAPS } from "@/lib/klassisk/maps";

export const metadata: Metadata = { title: "Kart og terreng" };

const ORDER: (keyof typeof MAPS)[] = ["siktlinje", "terreng", "eiendom", "omrade", "bygg", "skisse", "profil", "grillbu"];

export default function Kart() {
  return (
    <>
      <PageHead title="Kart og terreng" crumb="Kart og terreng">
        <p>Kartene prosjekteier har lagt til grunn, og et terrengkart laget for nettsiden, i full størrelse. Eiendomsgrenser, høydekurver, siktlinjen til havet, terrengprofilen og den første skissen til situasjonsplan.</p>
      </PageHead>
      <section className="sec" style={{ paddingTop: 32 }}>
        <div className="wrap mapgrid">
          {ORDER.map((k, n) => {
            const m = MAPS[k];
            return (
              <Reveal key={k} as="figure" className={`mapfig${m.w > 800 ? " wide" : ""}`} delay={n * 40}>
                <div className="mapimg"><Image src={m.src} alt={m.alt} width={m.w} height={m.h} sizes={m.w > 800 ? "100vw" : "50vw"} quality={92} unoptimized={m.w < 900} /></div>
                <figcaption>
                  <h3>{m.title}</h3>
                  <p>{m.text}</p>
                  <span className="small">{m.credit}</span>
                </figcaption>
              </Reveal>
            );
          })}
        </div>
      </section>
    </>
  );
}
