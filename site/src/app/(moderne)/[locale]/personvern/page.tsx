import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import { CONTACT } from "@/lib/facts";
import { pageMeta } from "@/lib/meta";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const generateMetadata = pageMeta("/personvern", {
  no: { title: "Personvern", description: "Behandlingsansvarlig er Sigve Simonsen AS. Vi lagrer bare det du gir oss i interesseskjemaet, med de samtykkene du krysser av for." },
  en: { title: "Privacy", description: "The controller is Sigve Simonsen AS. We store only what you give us in the interest form, with the consents you tick." },
});

export default async function Privacy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const no = locale === "no";
  return (
    <>
      <Nav locale={locale} />
      <PageHead title={no ? "Personvern" : "Privacy"} lede={no ? "Behandlingsansvarlig er Sigve Simonsen AS. Vi lagrer bare det du gir oss i interesseskjemaet, med de samtykkene du krysser av for." : "The controller is Sigve Simonsen AS. We store only what you give us in the interest form, with the consents you tick."} />
      <section className="wrap pb-24 prose">
        <h2>{no ? "Analyse" : "Analytics"}</h2>
        <p>{no ? "Nettsiden bruker ingen sporingskapsler og ingen analyseverktøy fra andre. Besøk telles uten informasjonskapsler og uten å lagre IP-adresser: en besøkende kjennes igjen samme dag ved en enveiskode av datoen, adressen og nettleseren, som byttes hver dag og ikke kan spores tilbake. Det som lagres, er antall per dag: sidevisninger, besøk, hvilke sider som ble lest, hvilken nettside besøket kom fra, og om det var mobil eller datamaskin. Nettlesere som ber om ikke å bli sporet (Do Not Track eller Global Privacy Control), telles ikke." : "The website uses no tracking cookies and no third-party analytics. Visits are counted without cookies and without storing IP addresses: a visitor is recognised within one day by a one-way code of the date, the address and the browser, which changes daily and cannot be traced back. What is stored is counts per day: page views, visits, which pages were read, which site the visit came from, and whether it was a phone or a computer. Browsers that ask not to be tracked (Do Not Track or Global Privacy Control) are not counted."}</p>
        <p>{no ? "Velger du klassisk eller moderne utseende øverst på siden, huskes valget i en informasjonskapsel i ett år. Den brukes ikke til noe annet." : "If you choose the classic or modern appearance at the top of the page, the choice is remembered in a cookie for one year. It is used for nothing else."}</p>
        <h2>Knotten AI</h2>
        <p>{no ? "Spørsmål du stiller Knotten AI, besvares fra prosjektets egne data. Vi teller hvilke temaer det spørres om, og tar vare på spørsmål den ikke kunne svare på, uten e-postadresser, telefonnumre eller noe annet som peker på deg." : "Questions you ask Knotten AI are answered from the project's own data. We count which topics are asked about, and keep the questions it could not answer, without email addresses, phone numbers or anything else that points to you."}{process.env.ANTHROPIC_API_KEY ? (no ? " Spørsmål dataene ikke dekker, sendes til en språkmodell hos Anthropic for å lage svaret." : " Questions the data does not cover are sent to a language model at Anthropic to write the answer.") : ""}</p>
        <h2>{no ? "Dine rettigheter" : "Your rights"}</h2>
        <p>{no ? `Du kan be om innsyn, eksport og sletting ved å skrive til ${CONTACT.email}.` : `You can request access, export and deletion by writing to ${CONTACT.email}.`}</p>
        <h2>{no ? "Portalen" : "The portal"}</h2>
        <p>{no ? "Logger du inn i prosjektportalen, settes to informasjonskapsler: én som holder deg innlogget (i 12 timer, eller 30 dager hvis du velger «Husk meg»), og én med navnet ditt til visning øverst på siden. Passordet lagres bare som en kryptografisk hash. I portalen lagres det du selv legger inn, som spørsmål, dokumenter og samtykker, og en logg over innlogginger og nedlastinger av sikkerhetshensyn." : "If you log in to the project portal, two cookies are set: one that keeps you logged in (for 12 hours, or 30 days if you choose \"Remember me\"), and one with your name for display at the top of the page. The password is stored only as a cryptographic hash. The portal stores what you add yourself, such as questions, documents and consents, and a log of logins and downloads for security."}</p>
      </section>
    </>
  );
}
