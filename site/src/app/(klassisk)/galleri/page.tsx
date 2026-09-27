import type { Metadata } from "next";
import Image from "next/image";
import PageHead from "@/components/klassisk/PageHead";
import Reveal from "@/components/klassisk/Reveal";
import { PHOTOS } from "@/lib/klassisk/photos";

export const metadata: Metadata = { title: "Bilder" };

const ORDER: { key: keyof typeof PHOTOS; span: "g12" | "g6" | "g4" }[] = [
  { key: "view", span: "g12" },
  { key: "view2", span: "g6" },
  { key: "sniksfjorden", span: "g6" },
  { key: "spangereid", span: "g12" },
  { key: "vigeland", span: "g6" },
  { key: "snig", span: "g6" },
  { key: "audna", span: "g12" },
];

export default function Galleri() {
  return (
    <>
      <PageHead title="Bilder fra Knotten og området" crumb="Bilder">
        <p>Bildene av utsikten er tatt fra nabotomten, litt lavere enn feltet. Bildene av fjorden, Snig, Vigeland og Audna er fotografert av andre og delt med fri lisens. Hvert bilde viser hvem som tok det.</p>
      </PageHead>
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal className="gallery" stagger>
            {ORDER.map(({ key, span }) => {
              const p = PHOTOS[key];
              return (
                <figure key={key} className={span}>
                  <Image src={p.src} alt={p.alt} width={p.w} height={p.h} sizes={span === "g12" ? "100vw" : span === "g6" ? "50vw" : "33vw"} quality={85} />
                  <figcaption>
                    {p.caption}. Foto: {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.credit}</a> : p.credit}, {p.license}
                  </figcaption>
                </figure>
              );
            })}
          </Reveal>
        </div>
      </section>
    </>
  );
}
