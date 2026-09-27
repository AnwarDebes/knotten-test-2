import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import InterestForm from "@/components/ui/InterestForm";
import { loadPlots } from "@/lib/data";

export default async function Interest({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ plot?: string }> }) {
  const { locale: l } = await params;
  const { plot } = await searchParams;
  const locale = l as Locale;
  const no = locale === "no";
  const { plots } = await loadPlots();
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Meld interesse" : "Register interest"}
        lede={no
          ? "Tomtene er ikke sluppet ennå. Registrer deg, så får du beskjed først. Du velger selv hva vi får bruke kontakten til."
          : "The plots are not released yet. Register and you hear first. You choose what we may use your contact for."}
      />
      <section className="wrap pb-24">
        <div className="panel p-6 md:p-8 max-w-[680px]">
          <InterestForm locale={locale} plots={plots.map((p) => p.id)} preselect={plot} />
        </div>
      </section>
    </>
  );
}
