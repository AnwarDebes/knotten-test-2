import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import InterestForm from "@/components/ui/InterestForm";
import { loadPlots } from "@/lib/data";
import { pageMeta } from "@/lib/meta";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const generateMetadata = pageMeta("/interesse", {
  no: { title: "Meld interesse", description: "Tomtene er ikke sluppet ennå. Registrer deg, så får du beskjed når det skjer noe med tomtene." },
  en: { title: "Register interest", description: "The plots are not released yet. Register and you hear when something happens with the plots." },
});

export default async function Interest({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ plot?: string; purpose?: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const { plot, purpose } = await searchParams;
  const locale = l as Locale;
  const no = locale === "no";
  const { plots } = await loadPlots();
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Meld interesse" : "Register interest"}
        lede={no
          ? "Tomtene er ikke sluppet ennå. Registrer deg, så får du beskjed når det skjer noe med tomtene. Du velger selv hva vi får bruke kontakten til."
          : "The plots are not released yet. Register and you hear when something happens with the plots. You choose what we may use your contact for."}
      />
      <section className="wrap pb-24">
        <div className="panel p-6 md:p-8 max-w-[680px]">
          <InterestForm locale={locale} plots={plots.map((p) => p.id)} preselect={plot} purpose={purpose} />
        </div>
      </section>
    </>
  );
}
