import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { isLocale, t } from "@/lib/i18n";
import { loadPlots, loadPlot, loadCommercial, loadSettings } from "@/lib/data";
import { plotName, rowLabel, sunLabel } from "@/lib/format";
import { fmt } from "@/lib/facts/core";
import Nav from "@/components/ui/Nav";
import Stage from "@/components/Stage";
import Passport from "@/components/ui/Passport";
import HorizonChart from "@/components/charts/HorizonChart";
import { withAlternates } from "@/lib/meta";

export async function generateStaticParams() {
  const { plots } = await loadPlots();
  return plots.flatMap((p) => [{ locale: "no", id: p.id }, { locale: "en", id: p.id }]);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { id, locale } = await params;
  if (!isLocale(locale)) notFound();
  const p = await loadPlot(id);
  const no = locale === "no";
  if (!p) return { title: no ? "Fant ikke siden" : "Page not found" };
  return withAlternates(`/tomter/${id}`, no ? "no" : "en", {
    title: plotName(id, no),
    description: no
      ? `Sol 21. desember: ${p.sun.dec21.hours.toLocaleString("nb-NO", { maximumFractionDigits: 1 })} timer. Sjø i sikt: ${p.view.water_visible_deg} grader.${p.view.open_sea_visible ? " Åpent hav i sikt." : ""}`
      : `Sun 21 December: ${p.sun.dec21.hours.toLocaleString("en-GB", { maximumFractionDigits: 1 })} hours. Water in view: ${p.view.water_visible_deg} degrees.${p.view.open_sea_visible ? " Open sea visible." : ""}`,
  });
}

export default async function PlotPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: l, id } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const no = locale === "no";
  const d = t(locale);
  const { plots } = await loadPlots();
  const plot = plots.find((p) => p.id === id);
  if (!plot) notFound();
  const name = plotName(id, no);
  const lang = no ? "no" : "en";
  const com = (await loadCommercial())[plot.id];
  const settings = await loadSettings();
  const statusLabel = { unreleased: no ? "ikke sluppet" : "unreleased", available: no ? "ledig" : "available", reserved: no ? "reservert" : "reserved", sold: no ? "solgt" : "sold" }[com.status];
  return (
    <>
      <Nav locale={locale} />
      <section className="wrap pt-12 md:pt-16 pb-8 md:pb-10 grid gap-8 lg:grid-cols-[1fr_auto] items-end">
        <div>
          <Link href={`/${locale}/tomter`} className="text-[14px] text-granite no-underline hover:underline">{no ? "Alle tomter" : "All plots"}</Link>
          <h1 className="display text-[clamp(42px,6vw,88px)] mt-3">{name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
            <span className={`chip ${com.status === "available" ? "chip-pine" : com.status === "reserved" ? "chip-amber" : ""}`}>{statusLabel}</span>
            {com.price_nok ? <span className="num text-[22px]">{com.price_nok.toLocaleString(no ? "nb-NO" : "en-GB")} kr</span> : <span className="text-muted">{settings.release_note[locale]}</span>}
            <span className="text-muted">{com.house_type}</span>
          </div>
          <p className="lede mt-5 max-w-[54ch]">
            {no ? `${plot.zone === "flat" ? "Flaten ved Rødbergsveien" : `Rekke ${rowLabel(plot)}`}, ${plot.local.z_ground.toFixed(0)} meter over havet. Huset vender mot ${plot.house.facing_deg.toFixed(0)} grader. ` : `${plot.zone === "flat" ? "The flat by Rødbergsveien" : `Row ${rowLabel(plot)}`}, ${plot.local.z_ground.toFixed(0)} m above sea level. The house faces ${plot.house.facing_deg.toFixed(0)} degrees. `}
            {plot.view.open_sea_visible
              ? (no ? `Åpent hav er synlig over ${plot.view.open_sea_deg} grader av horisonten.` : `Open sea is visible across ${plot.view.open_sea_deg} degrees of the horizon.`)
              : (no ? "Fjorden er i sikt. Åpent hav ligger bak åsen fra denne tomten." : "The fjord is in view. Open sea sits behind the hill from this plot.")}
          </p>
        </div>
        <Link className="btn btn-amber" href={`/${locale}/interesse?plot=${plot.id}`}>{d.cta.register}</Link>
      </section>
      <Stage plots={plots} locale={locale} initialMode="plot" initialPlot={plot.id} compact />
      <section className="wrap section-tight grid gap-12 lg:grid-cols-[400px_1fr]">
        <Passport plot={plot} locale={locale} here />
        <div>
          <h2 className="display text-[32px]">{no ? "Horisonten rundt tomten" : "The horizon around the plot"}</h2>
          <p className="mt-3 text-[15.5px] max-w-[58ch] text-bone-2">
            {no
              ? "Terrengets høyde over horisonten i hver retning, regnet fra stuegulvet. Solen er over terrenget der dens bane ligger over den mørke linjen."
              : "The terrain's angle above the horizon in every direction, from the living-room floor. The sun is above the terrain where its path sits above the dark line."}
          </p>
          <div className="mt-5"><HorizonChart plot={plot} locale={locale} /></div>
          <table className="table mt-8">
            <tbody>
              <tr><th>{no ? "Koordinater" : "Coordinates"}</th><td>{plot.lat.toFixed(6)}, {plot.lon.toFixed(6)} (UTM32 {plot.utm32_east.toFixed(0)} E, {plot.utm32_north.toFixed(0)} N)</td></tr>
              <tr><th>{no ? "Gulvnivå" : "Floor level"}</th><td>{fmt(plot.local.z_floor, lang, 1)} {no ? "moh." : "m a.s.l."}</td></tr>
              <tr><th>{no ? "Sol 21. mars" : "Sun 21 March"}</th><td>{fmt(plot.sun.mar21.hours, lang)} h, {sunLabel(plot.sun.mar21.first_sun_cet)} {no ? "til" : "to"} {sunLabel(plot.sun.mar21.last_sun_cet)}</td></tr>
              <tr><th>{no ? "Lengste sikt over vann" : "Farthest water in view"}</th><td>{fmt(plot.view.farthest_water_m / 1000, lang, 1)} km</td></tr>
              <tr><th>{no ? "Hus i modellen" : "House in the model"}</th><td>{fmt(plot.house.width_m, lang)} × {fmt(plot.house.depth_m, lang)} m, {no ? "gesims" : "eaves"} {fmt(plot.house.eaves_m, lang)} m, {no ? "møne" : "ridge"} {fmt(plot.house.ridge_m, lang)} m ({no ? "illustrasjon" : "illustration"})</td></tr>
              <tr><th>{no ? "Planering" : "Levelling"}</th><td>≈ {fmt(plot.terrain.level_pad_cutfill_m3, lang)} m³ ({no ? "størrelsesorden" : "order of magnitude"})</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
