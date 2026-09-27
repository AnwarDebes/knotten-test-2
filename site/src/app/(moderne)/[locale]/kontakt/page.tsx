import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";

export default async function Contact({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  return (
    <>
      <Nav locale={locale} />
      <PageHead title={no ? "Kontakt" : "Contact"} lede={no ? "Spørsmål om tomtene, prosjektet eller samarbeid går rett til daglig leder." : "Questions about the plots, the project or partnerships go straight to the CEO."} />
      <section className="wrap pb-24 grid gap-10 md:grid-cols-2 items-start">
        <div>
          <div className="display text-[30px]">Sigve Simonsen AS</div>
          <p className="mt-3 text-[17px]">{no ? "Daglig leder" : "CEO"}: Sigve Simonsen</p>
          <p className="mt-1 text-[17px]"><a href="mailto:sigve.simonsen@hotmail.com">sigve.simonsen@hotmail.com</a></p>
          <p className="mt-1 text-[17px]"><a href="tel:+4795495152">+47 954 95 152</a></p>
          <p className="mt-6 text-[15px] text-granite max-w-[48ch]">{no ? "Søknad om praksisplass merkes «Internship - Energivennlig boligfelt Rødberg i Lindesnes Kommune»." : "Internship applications: mark them “Internship - Energivennlig boligfelt Rødberg i Lindesnes Kommune”."}</p>
          <Link className="btn btn-amber mt-8" href={`/${locale}/interesse`}>{no ? "Meld interesse" : "Register interest"}</Link>
        </div>
        <div className="panel p-7">
          <div className="font-medium">{no ? "Hvor" : "Where"}</div>
          <p className="mt-2 text-[15.5px]">Knotten, Rødberg, 4520 Lindesnes<br />58.068057 N, 7.278401 {no ? "Ø" : "E"}</p>
          <a className="inline-block mt-4 text-[15px]" href="https://www.google.com/maps?q=58.068057,7.278401" target="_blank" rel="noreferrer">{no ? "Åpne i kart" : "Open in maps"}</a>
        </div>
      </section>
    </>
  );
}
