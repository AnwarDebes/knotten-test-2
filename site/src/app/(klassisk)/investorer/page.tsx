import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/klassisk/PageHead";
import Reveal from "@/components/klassisk/Reveal";
import { Src } from "@/components/klassisk/Source";

export const metadata: Metadata = { title: "Investorer og kommune" };

export default function Investorer() {
  return (
    <>
      <PageHead title="Investorer og kommune" crumb="Investorer og kommune" aside={<Link className="btn" href="/kontakt">Be om investormateriale</Link>}>
        <p>Knotten skal bli et nasjonalt referanseprosjekt. Det krever at alt som sies kan dokumenteres. Her er hva vi kan vise i dag, og hva som kommer.</p>
      </PageHead>
      <section className="sec">
        <div className="wrap">
          <Reveal className="duo" stagger>
            <div>
              <h3>For investorer og partnere</h3>
              <ul>
                <li>Forventede energibesparelser, med forutsetningene synlige for hvert tall</li>
                <li>Driftskostnader over tid, per bolig og for feltet samlet</li>
                <li>Skalerbarhet: konseptet er tenkt gjenbrukt i andre felt</li>
                <li>Innovasjonsverdi og aktuelle støtteordninger</li>
                <li>ESG og bærekraftseffekt, målt når feltet står</li>
              </ul>
            </div>
            <div>
              <h3>For kommunen og UiA</h3>
              <ul>
                <li>Underlag til reguleringsprosessen, samlet på ett sted</li>
                <li>Forbruk og effekttopper, og hva det betyr for lokalnettet</li>
                <li>Robusthet ved strømbrudd for boliger og næring</li>
                <li>Et datasett fra de eksisterende byggene som finnes nå</li>
                <li>Studentarbeid og rapporter i dokumentbanken</li>
              </ul>
            </div>
          </Reveal>

          <Reveal className="split" style={{ marginTop: 56 }}>
            <div className="stack">
              <div className="eyebrow">Slik jobber vi med tall</div>
              <h2>Ingen påstander uten kilde</h2>
              <p className="measure">Investorer spør om forventede besparelser, driftskostnader over tid og skalerbarhet. Svarene våre er anslag med kilde og spenn, ikke løfter, til feltet står og kan måles.</p>
              <div className="cta-row"><Link className="btn ghost" href="/kilder">Se kildelisten</Link></div>
            </div>
            <div className="stack">
              <div className="eyebrow">Hva som kommer</div>
              <h2>Neste steg for plattformen</h2>
              <p className="measure">Time for time-simulering av hele feltet mot reelle strømpriser. Privat område for investorer og kommune. Sanntidsdata fra kontorbygget. Energidashbord for beboerne når boligene står.</p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
