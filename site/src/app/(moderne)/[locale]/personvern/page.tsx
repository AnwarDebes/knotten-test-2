import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import { CONTACT } from "@/lib/facts";

export default async function Privacy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  return (
    <>
      <Nav locale={locale} />
      <PageHead title={no ? "Personvern" : "Privacy"} lede={no ? "Behandlingsansvarlig er Sigve Simonsen AS. Vi lagrer bare det du gir oss i interesseskjemaet, med de samtykkene du krysser av for." : "The controller is Sigve Simonsen AS. We store only what you give us in the interest form, with the consents you tick."} />
      <section className="wrap pb-24 prose">
        <h2>{no ? "Analyse" : "Analytics"}</h2>
        <p>{no ? "Nettsiden måler ikke trafikk og bruker ingen analyseverktøy eller sporingskapsler." : "The website does not measure traffic and uses no analytics tools or tracking cookies."}</p>
        <p>{no ? "Velger du klassisk eller moderne utseende øverst på siden, huskes valget i en informasjonskapsel i ett år. Den brukes ikke til noe annet." : "If you choose the classic or modern appearance at the top of the page, the choice is remembered in a cookie for one year. It is used for nothing else."}</p>
        <h2>{no ? "Dine rettigheter" : "Your rights"}</h2>
        <p>{no ? `Du kan be om innsyn, eksport og sletting ved å skrive til ${CONTACT.email}.` : `You can request access, export and deletion by writing to ${CONTACT.email}.`}</p>
        <h2>{no ? "Portalen" : "The portal"}</h2>
        <p>{no ? "Forhåndsvisningen av innloggingen lagrer valgt rolle, navn og e-post i en informasjonskapsel i sju dager." : "The login preview stores the chosen role, name and email in a cookie for seven days."}</p>
      </section>
    </>
  );
}
