import type { Metadata } from "next";
import PageHead from "@/components/klassisk/PageHead";

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
          <p>Når du melder interesse lagrer Sigve Simonsen AS navn, e-post, eventuelt telefonnummer, hva du er interessert i og meldingen din, sammen med ordlyden i samtykket du ga. Opplysningene brukes bare til å følge opp interessen din om Knotten.</p>
          <h3>Innsyn og sletting</h3>
          <p>Du kan når som helst be om innsyn i eller sletting av opplysningene ved å skrive til sigve.simonsen@hotmail.com.</p>
          <h3>Informasjonskapsler og måling</h3>
          <p>Nettsiden bruker ikke informasjonskapsler til sporing. Besøkstall måles uten å identifisere deg.</p>
          <p>Velger du klassisk eller moderne utseende øverst på siden, huskes valget i en informasjonskapsel i ett år. Den brukes ikke til noe annet.</p>
          <p className="small">Denne teksten er et utkast og ferdigstilles før lansering.</p>
        </div>
      </section>
    </>
  );
}
