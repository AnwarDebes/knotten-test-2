import type { Metadata } from "next";
import PageHead from "@/components/klassisk/PageHead";
import { CONTACT } from "@/lib/facts";

export const metadata: Metadata = { title: "Personvern" };

export default function Personvern() {
  return (
    <>
      <PageHead title="Personvern" crumb="Personvern">
        <p>Hva vi lagrer, hvorfor, og hvordan du får det slettet.</p>
      </PageHead>
      <section className="sec">
        <div className="wrap stack" style={{ maxWidth: "70ch" }}>
          <h3>Interessemeldinger</h3>
          <p>Når du melder interesse lagrer {CONTACT.company} navn, e-post, eventuelt telefonnummer, hva du er interessert i og meldingen din, sammen med hvilke samtykker du ga og når. Opplysningene brukes bare til å følge opp interessen din om Knotten.</p>
          <h3>Innsyn og sletting</h3>
          <p>Du kan når som helst be om innsyn i eller sletting av opplysningene ved å skrive til {CONTACT.email}.</p>
          <h3>Informasjonskapsler og måling</h3>
          <p>Nettsiden bruker ikke informasjonskapsler til sporing, og måler ikke trafikk.</p>
          <p>Velger du klassisk eller moderne utseende øverst på siden, huskes valget i en informasjonskapsel i ett år. Den brukes ikke til noe annet. Logger du inn i forhåndsvisningen av portalen, lagres valgt rolle, navn og e-post i en informasjonskapsel i sju dager.</p>
          <p className="small">Denne teksten er et utkast og ferdigstilles før lansering.</p>
        </div>
      </section>
    </>
  );
}
