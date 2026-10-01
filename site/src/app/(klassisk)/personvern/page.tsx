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
          <p>Nettsiden bruker ikke informasjonskapsler til sporing. Besøk telles uten informasjonskapsler og uten å lagre IP-adresser: en besøkende kjennes igjen samme dag ved en enveiskode av datoen, adressen og nettleseren, som byttes hver dag og ikke kan spores tilbake. Det som lagres, er antall per dag: sidevisninger, besøk, hvilke sider som ble lest, hvilken nettside besøket kom fra, og om det var mobil eller datamaskin. Nettlesere som ber om ikke å bli sporet (Do Not Track eller Global Privacy Control), telles ikke.</p>
          <p>Velger du klassisk eller moderne utseende øverst på siden, huskes valget i en informasjonskapsel i ett år. Den brukes ikke til noe annet.</p>
          <h3>Knotten AI</h3>
          <p>{`Assistenten i det moderne utseendet svarer fra prosjektets egne data. Vi teller hvilke temaer det spørres om, og tar vare på spørsmål den ikke kunne svare på, uten e-postadresser, telefonnumre eller noe annet som peker på deg.${process.env.ANTHROPIC_API_KEY ? " Spørsmål dataene ikke dekker, sendes til en språkmodell hos Anthropic for å lage svaret." : ""}`}</p>
          <h3>Prosjektportalen</h3>
          <p>Logger du inn i prosjektportalen, settes to informasjonskapsler: én som holder deg innlogget (i 12 timer, eller 30 dager hvis du velger «Husk meg»), og én med navnet ditt til visning øverst på siden. Passordet lagres bare som en kryptografisk hash. I portalen lagres det du selv legger inn, som spørsmål, dokumenter og samtykker, og en logg over innlogginger og nedlastinger av sikkerhetshensyn.</p>
          <p className="small">Denne teksten er et utkast og ferdigstilles før lansering.</p>
        </div>
      </section>
    </>
  );
}
