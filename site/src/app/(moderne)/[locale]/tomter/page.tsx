import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { loadPlots, loadCommercial } from "@/lib/data";
import { plotName, rowLabel, sunLabel } from "@/lib/format";
import { FACT, word } from "@/lib/facts";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import Stage from "@/components/Stage";

export default async function Plots({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ sort?: string }> }) {
  const { locale: l } = await params;
  const { sort = "dec" } = await searchParams;
  const locale = l as Locale;
  const d = t(locale);
  const no = locale === "no";
  const { plots } = await loadPlots();
  const com = await loadCommercial();
  const sorted = [...plots].sort((a, b) =>
    sort === "sea" ? b.view.water_visible_deg - a.view.water_visible_deg
    : sort === "height" ? b.local.z_ground - a.local.z_ground
    : sort === "row" ? a.row - b.row
    : b.sun.dec21.hours - a.sun.dec21.hours);
  const sorts = [["dec", no ? "Sol 21. desember" : "Sun 21 December"], ["sea", no ? "Sjø i sikt" : "Water in view"], ["height", no ? "Høyde" : "Elevation"], ["row", no ? "Rekke" : "Row"]];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={d.nav.plots}
        lede={no
          ? `I modellen ligger ${plots.length} tomter innenfor eiendomsgrensen, i ${word(FACT.rows)} rekker som i prosjekteiers plan: A, B og C over hverandre i sørhellingen og D på knausen Knotten. Ønsket er sjøutsikt fra alle tomtene, men det er ikke sikkert at det går fra alle; i modellens forslag ser alle vann. Utlegget er foreløpig og byttes ut med den regulerte planen, men tallene per tomt er allerede regnet fra terrenget.`
          : `In the model, ${plots.length} plots sit inside the parcel boundary, in ${word(FACT.rows, "en")} rows as in the project owner's plan: A, B and C one above the other on the south face and D on the Knotten knoll. The aim is a sea view from every plot, but it is not certain every plot will get one; in the model's proposal all see water. The layout is provisional and will be replaced by the regulated plan, but the numbers per plot are already computed from the terrain.`}
        action={<Link className="btn btn-amber" href={`/${locale}/interesse`}>{d.cta.register}</Link>}
      />
      <Stage plots={plots} locale={locale} initialMode="plot" initialPlot={sorted[0].id} compact />
      <section className="wrap section-tight">
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="text-granite mr-1">{no ? "Sorter etter" : "Sort by"}</span>
          {sorts.map(([k, label]) => (
            <Link key={k} href={`?sort=${k}`} className={`chip no-underline ${sort === k ? "chip-amber" : ""}`}>{label}</Link>
          ))}
        </div>
        <div className="overflow-x-auto mt-6">
          <table className="table">
            <thead>
              <tr>
                <th>{no ? "Tomt" : "Plot"}</th>
                <th>{no ? "Rekke" : "Row"}</th>
                <th className="n">{no ? "Høyde" : "Elev."}</th>
                <th className="n">{no ? "Sol 21. des" : "Sun 21 Dec"}</th>
                <th>{no ? "Første til siste sol, des" : "First to last sun, Dec"}</th>
                <th className="n">{no ? "Sol 21. jun" : "Sun 21 Jun"}</th>
                <th className="n">{no ? "Sjø i sikt" : "Water"}</th>
                <th>{no ? "Åpent hav" : "Open sea"}</th>
                <th className="n">{no ? "Helning" : "Slope"}</th>
                <th>{no ? "Hustype" : "House type"}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/${locale}/tomter/${p.id}`} className="font-medium">{plotName(p.id, no)}</Link></td>
                  <td>{p.zone === "flat" ? (no ? "flaten" : "flat") : rowLabel(p)}</td>
                  <td className="n">{p.local.z_ground.toFixed(0)} m</td>
                  <td className="n">{p.sun.dec21.hours.toFixed(1)} h</td>
                  <td>{sunLabel(p.sun.dec21.first_sun_cet)} {no ? "til" : "to"} {sunLabel(p.sun.dec21.last_sun_cet)}</td>
                  <td className="n">{p.sun.jun21.hours.toFixed(1)} h</td>
                  <td className="n">{p.view.water_visible_deg}°</td>
                  <td>{p.view.open_sea_visible ? (no ? "ja" : "yes") : (no ? "nei" : "no")}</td>
                  <td className="n">{p.terrain.slope_deg.toFixed(0)}°</td>
                  <td>{com[p.id].house_type}</td>
                  <td><span className={`chip ${com[p.id].status === "available" ? "chip-pine" : com[p.id].status === "reserved" ? "chip-amber" : ""}`}>{{ unreleased: no ? "ikke sluppet" : "unreleased", available: no ? "ledig" : "available", reserved: no ? "reservert" : "reserved", sold: no ? "solgt" : "sold" }[com[p.id].status]}</span>{com[p.id].price_nok ? <div className="text-[12.5px] text-muted mt-1">{com[p.id].price_nok!.toLocaleString(no ? "nb-NO" : "en-GB")} kr</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="provenance mt-5 max-w-[80ch]">
          {no
            ? "Sol: terrengskygge med feltet ryddet, ingen skygge mellom hus. Sjø: siktlinje til celler på havnivå; åpent hav er vann lenger unna enn 7 km. Kartverket DTM 1 m med 30 km horisont, beregnet 2026-09-30 for det foreløpige utlegget v6."
            : "Sun: terrain shading with the field cleared, no shading between houses. Water: line of sight to sea-level cells; open sea is water beyond 7 km. Kartverket DTM 1 m with a 30 km horizon, computed 2026-09-30 for the provisional layout v6."}
        </p>
      </section>
    </>
  );
}
