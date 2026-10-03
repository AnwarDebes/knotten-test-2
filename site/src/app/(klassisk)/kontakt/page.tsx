import type { Metadata } from "next";
import PageHead from "@/components/klassisk/PageHead";
import InterestForm from "@/components/klassisk/InterestForm";
import OwnerLogo from "@/components/klassisk/OwnerLogo";
import { CONTACT } from "@/lib/facts";

export const metadata: Metadata = { title: "Meld interesse" };

export default async function Kontakt({ searchParams }: { searchParams: Promise<{ tomt?: string; rolle?: string }> }) {
  const { tomt, rolle } = await searchParams;
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
              <b>{CONTACT.company}</b>
              <span>Prosjekteier</span>
              <span>{CONTACT.place}</span>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              <a href={`tel:${CONTACT.tel}`}>{CONTACT.phone}</a>
            </div>
            <p className="small measure">{`Opplysningene du sender lagres av ${CONTACT.company} for å følge opp interessen din, og for ingenting annet.`} Du kan be om innsyn eller sletting når som helst.</p>
          </div>
          <InterestForm plot={tomt} role={rolle === "investor" ? "Investor eller partner" : undefined} />
        </div>
      </section>
    </>
  );
}
