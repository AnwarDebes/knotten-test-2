import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";

export default async function Privacy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  return (
    <>
      <Nav locale={locale} />
      <PageHead title={no ? "Personvern" : "Privacy"} lede={no ? "Behandlingsansvarlig er Sigve Simonsen AS. Vi lagrer bare det du gir oss i interesseskjemaet, med de samtykkene du krysser av for. Data lagres i EU." : "The controller is Sigve Simonsen AS. We store only what you give us in the interest form, with the consents you tick. Data is stored in the EU."} />
      <section className="wrap pb-24 prose">
        <h2>{no ? "Analyse" : "Analytics"}</h2>
        <p>{no ? "Trafikk måles uten informasjonskapsler og uten personopplysninger. Produkthendelser, for eksempel at et solpass ble åpnet, lagres med en anonym økt-ID." : "Traffic is measured without cookies and without personal data. Product events, for example a passport opened, are stored with an anonymous session id."}</p>
        <h2>{no ? "Dine rettigheter" : "Your rights"}</h2>
        <p>{no ? "Du kan be om innsyn, eksport og sletting ved å skrive til sigve.simonsen@hotmail.com." : "You can request access, export and deletion by writing to sigve.simonsen@hotmail.com."}</p>
        <h2>{no ? "Portalen" : "The portal"}</h2>
        <p>{no ? "Forhåndsvisningen av innloggingen lagrer bare valgt rolle og navn i en informasjonskapsel i sju dager." : "The login preview stores only the chosen role and name in a cookie for seven days."}</p>
      </section>
    </>
  );
}
