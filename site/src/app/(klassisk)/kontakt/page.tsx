import type { Metadata } from "next";
import PageHead from "@/components/klassisk/PageHead";
import InterestForm from "@/components/klassisk/InterestForm";
import OwnerLogo from "@/components/klassisk/OwnerLogo";

export const metadata: Metadata = { title: "Meld interesse" };

export default async function Kontakt({ searchParams }: { searchParams: Promise<{ tomt?: string }> }) {
  const { tomt } = await searchParams;
  return (
    <>
      <PageHead title="Meld interesse" crumb="Kontakt">
        <p>Si fra hvem du er, så tar vi kontakt. Vi svarer innen to virkedager. Salg skjer gjennom megler når reguleringen er vedtatt.</p>
      </PageHead>
      <section className="sec">
        <div className="wrap split">
          <div className="stack">
            <OwnerLogo />
            <div className="contact">
              <b>Sigve Simonsen AS</b>
              <span>Prosjekteier</span>
              <span>Rødbergsveien 121, 4520 Lindesnes</span>
              <a href="mailto:sigve.simonsen@hotmail.com">sigve.simonsen@hotmail.com</a>
              <a href="tel:+4795495152">954 95 152</a>
            </div>
            <p className="small measure">Opplysningene du sender lagres av Sigve Simonsen AS for å følge opp interessen din, og for ingenting annet. Du kan be om innsyn eller sletting når som helst.</p>
          </div>
          <InterestForm plot={tomt} />
        </div>
      </section>
    </>
  );
}
