import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import { loadNews } from "@/lib/data";
import { pageMeta } from "@/lib/meta";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const generateMetadata = pageMeta("/nyheter", {
  no: { title: "Nyheter", description: "Det som har skjedd i prosjektet, etter hvert som det skjer." },
  en: { title: "News", description: "What has happened in the project, as it happens." },
});

export const dynamic = "force-dynamic";

/** What the administrator has published, newest first. */
export default async function News({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const no = locale === "no";
  const items = await loadNews();
  return (
    <>
      <Nav locale={locale} />
      <PageHead title={no ? "Nyheter" : "News"} lede={no ? "Det som har skjedd i prosjektet, etter hvert som det skjer." : "What has happened in the project, as it happens."} />
      <section className="wrap pb-24">
        <div className="grid gap-10 max-w-[72ch]">
          {items.map((n) => (
            <article key={n.id} className="grid gap-2 sm:grid-cols-[120px_1fr]">
              <div className="provenance pt-2">{n.date}</div>
              <div>
                <h2 className="display text-[30px] leading-tight">{n.title[locale]}</h2>
                <p className="mt-2 text-bone-2 max-w-[60ch]">{n.text[locale]}</p>
              </div>
            </article>
          ))}
          {items.length === 0 && <p className="text-muted">{no ? "Ingen saker ennå." : "No items yet."}</p>}
        </div>
      </section>
    </>
  );
}
