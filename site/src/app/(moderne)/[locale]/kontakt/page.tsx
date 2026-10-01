import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import { CONTACT, FACT, INTERNSHIP } from "@/lib/facts";
import { pageMeta } from "@/lib/meta";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const generateMetadata = pageMeta("/kontakt", {
  no: { title: "Kontakt", description: "Spørsmål om tomtene, prosjektet eller samarbeid går rett til daglig leder." },
  en: { title: "Contact", description: "Questions about the plots, the project or partnerships go straight to the Managing Director." },
});

export default async function Contact({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const no = locale === "no";
  return (
    <>
      <Nav locale={locale} />
      <PageHead title={no ? "Kontakt" : "Contact"} lede={no ? "Spørsmål om tomtene, prosjektet eller samarbeid går rett til daglig leder." : "Questions about the plots, the project or partnerships go straight to the Managing Director."} />
      <section className="wrap pb-24 grid gap-10 md:grid-cols-2 items-start">
        <div>
          <div className="display text-[30px]">{CONTACT.company}</div>
          <p className="mt-3 text-[17px]">{CONTACT.role[locale]}: {CONTACT.name}</p>
          <p className="mt-1 text-[17px]"><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></p>
          <p className="mt-1 text-[17px]"><a href={`tel:${CONTACT.tel}`}>{CONTACT.phone_intl}</a></p>
          <p className="mt-6 text-[15px] text-granite max-w-[48ch]">{no ? `Søknadsfristen for praksisplassene var ${INTERNSHIP.deadline.no}.` : `The application deadline for the internship places was ${INTERNSHIP.deadline.en}.`}</p>
          <Link className="btn btn-amber mt-8" href={`/${locale}/interesse`}>{no ? "Meld interesse" : "Register interest"}</Link>
        </div>
        <div className="panel p-7">
          <div className="font-medium">{no ? "Hvor" : "Where"}</div>
          <p className="mt-2 text-[15.5px]">{CONTACT.place}<br />{`${FACT.lat} N, ${FACT.lon} ${no ? "Ø" : "E"}`}</p>
          <a className="inline-block mt-4 text-[15px]" href={`https://www.google.com/maps?q=${FACT.lat},${FACT.lon}`} target="_blank" rel="noreferrer">{no ? "Åpne i kart" : "Open in maps"}</a>
        </div>
      </section>
    </>
  );
}
