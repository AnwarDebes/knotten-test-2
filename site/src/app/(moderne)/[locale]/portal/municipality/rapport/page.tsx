import { promises as fs } from "fs";
import path from "path";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { loadPlots } from "@/lib/data";
import { toUtm32 } from "@/lib/geo";
import { BUDGET, DIRECTION, EED, FACT, PV_KWP_PER_HOME, fmt } from "@/lib/facts";
import NoAccess from "@/components/portal/NoAccess";
import PrintButton from "@/components/portal/PrintButton";
import { osloDate } from "@/lib/server/live";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Reguleringsgrunnlag", "Regulation basis");

type Road = { rows: { id: string; level: number; length_m: number; mean_grade_pct: number }[]; summary: { total_length_m: number; length_over_6pct_m: number } };

/**
 * The regulation basis as one printable document (the browser saves it as PDF). Generated from
 * the same data as the website, so it is never out of step with it.
 */
export default async function Report({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/municipality/rapport", "municipality");
  if (!ok) return <NoAccess locale={locale} session={session} area="municipality" />;
  const { plots } = await loadPlots();
  const road = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "data", "road.json"), "utf-8")) as Road;
  const lang = no ? "no" : "en";
  const n1 = (v: number) => fmt(Math.round(v * 10) / 10, lang);
  const [e, nn] = toUtm32(Number(FACT.lat), Number(FACT.lon));
  const rows = (["A", "B", "C", "D"] as const).map((r) => ({ r, list: plots.filter((p) => p.row_label === r) }));
  const h2 = "display text-[22px] mt-2";
  return (
    <article className="panel p-6 md:p-10 grid gap-7 max-w-[1000px] print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b line pb-5">
        <div>
          <div className="label">{no ? "Reguleringsgrunnlag, foreløpig" : "Regulation basis, provisional"}</div>
          <h1 className="display text-[30px] md:text-[36px] mt-1">Knotten, {FACT.property_address}</h1>
          <p className="text-[14px] text-muted mt-1">{no ? `Gnr ${FACT.gnr} bnr ${FACT.bnr} og ${FACT.bnr_extra}, ${FACT.postcode}. Laget ${osloDate()} fra nettsidens data.` : `Gnr ${FACT.gnr} bnr ${FACT.bnr} and ${FACT.bnr_extra}, ${FACT.postcode}. Made ${osloDate()} from the website's data.`}</p>
        </div>
        <PrintButton label={no ? "Skriv ut eller lagre som PDF" : "Print or save as PDF"} />
      </header>

      <section className="grid gap-2 text-[14.5px]">
        <h2 className={h2}>1. {no ? "Eiendommen" : "The property"}</h2>
        <table className="table table-tight max-w-[640px]">
          <tbody>
            <tr><td>{no ? "Areal, gnr 355 bnr 10 og 368" : "Area, gnr 355 bnr 10 and 368"}</td><td className="n">{fmt(FACT.parcel_m2, lang)} m²</td></tr>
            <tr><td>{no ? "Referansepunkt" : "Reference point"}</td><td className="n">{FACT.lat} N, {FACT.lon} E</td></tr>
            <tr><td>{no ? "Referansepunkt, EPSG:25832" : "Reference point, EPSG:25832"}</td><td className="n">E {e.toFixed(1)}, N {nn.toFixed(1)}</td></tr>
            <tr><td>{no ? "Høyde, Knotten" : "Height, Knotten"}</td><td className="n">{no ? `om lag ${FACT.knotten_m} moh` : `about ${FACT.knotten_m} m a.s.l.`}</td></tr>
          </tbody>
        </table>
        <p className="provenance">{no ? "Kilde: Kartverket, Matrikkelen og Norgeskart; prosjekteier." : "Source: Kartverket, the land register and Norgeskart; the project owner."}</p>
      </section>

      <section className="grid gap-2 text-[14.5px]">
        <h2 className={h2}>2. {no ? "Utlegget: fire rekker, 30 tomter" : "The layout: four rows, 30 plots"}</h2>
        <p className="text-ink-2 max-w-[80ch]">{no ? "Modellens utlegg v6 følger planens fire rekker, A til D. Hver tomt er sjekket mot vannet med nabohusene stående. Utlegget er et beregnet forslag, ikke en vedtatt plan; høydene er terrenget under husets midtpunkt fra Kartverkets terrengmodell (1 m)." : "The model's layout v6 follows the plan's four rows, A to D. Each plot is checked against the water with the neighbouring houses standing. The layout is a computed proposal, not an adopted plan; heights are the ground under the house centre from Kartverket's terrain model (1 m)."}</p>
        <div className="scroll-x">
          <table className="table table-tight min-w-[720px]">
            <thead><tr><th>{no ? "Tomt" : "Plot"}</th><th>{no ? "Rekke" : "Row"}</th><th className="n">{no ? "Terreng" : "Ground"}</th><th className="n">{no ? "Gulv" : "Floor"}</th><th className="n">{no ? "Hus" : "House"}</th><th className="n">{no ? "Sol 21. des" : "Sun 21 Dec"}</th><th className="n">{no ? "Sol 21. jun" : "Sun 21 Jun"}</th><th className="n">{no ? "Sjøutsikt" : "Sea view"}</th><th>{no ? "Åpent hav" : "Open sea"}</th></tr></thead>
            <tbody>
              {rows.flatMap(({ list }) => list).map((p) => (
                <tr key={p.id}>
                  <td>{Number(p.id.slice(5))}</td><td>{p.row_label}</td><td className="n">{n1(p.local.z_ground)} m</td><td className="n">{n1(p.local.z_floor)} m</td>
                  <td className="n">{p.house.width_m} x {p.house.depth_m} m</td><td className="n">{n1(p.sun.dec21.hours)} t</td><td className="n">{n1(p.sun.jun21.hours)} t</td><td className="n">{p.view.water_visible_deg}°</td><td>{p.view.open_sea_visible ? (no ? "ja" : "yes") : (no ? "nei" : "no")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="provenance">{no ? "Høyder i meter over havet. Sol er timer med direkte sol på taket den dagen, med beregnet horisont. Sjøutsikt er grader av horisonten med vann i sikt." : "Heights in metres above sea level. Sun is hours of direct sun on the roof that day, with the computed horizon. Sea view is degrees of horizon with water in view."}</p>
      </section>

      <section className="grid gap-2 text-[14.5px]">
        <h2 className={h2}>3. {no ? "Vei og adkomst" : "Road and access"}</h2>
        <p className="text-ink-2 max-w-[80ch]">{no ? `Én vei fra tunet ved Rødbergsveien, bak hver rekke, med hårnålssvinger i vekslende ender som i prosjekteiers skisse. Samlet ${n1(road.summary.total_length_m)} m i modellen; ${n1(road.summary.length_over_6pct_m)} m er brattere enn ${FACT.road_grade_pct} % på dagens terreng. Den regulerte planen må gi sløyfer og terrengarbeid som holder ${FACT.road_grade_pct} %.` : `One road from the yard by Rødbergsveien, behind each row, with hairpins at alternating ends as in the project owner's sketch. ${n1(road.summary.total_length_m)} m in all in the model; ${n1(road.summary.length_over_6pct_m)} m is steeper than ${FACT.road_grade_pct} % on today's ground. The regulated plan must give loops and earthworks that keep ${FACT.road_grade_pct} %.`}</p>
        <table className="table table-tight max-w-[640px]">
          <thead><tr><th>{no ? "Rekkevei" : "Row road"}</th><th className="n">{no ? "Nivå" : "Level"}</th><th className="n">{no ? "Lengde" : "Length"}</th><th className="n">{no ? "Snittstigning" : "Mean grade"}</th></tr></thead>
          <tbody>{road.rows.map((r) => <tr key={r.id}><td>{r.id}</td><td className="n">{r.level} {no ? "moh" : "m a.s.l."}</td><td className="n">{n1(r.length_m)} m</td><td className="n">{n1(r.mean_grade_pct)} %</td></tr>)}</tbody>
        </table>
      </section>

      <section className="grid gap-2 text-[14.5px]">
        <h2 className={h2}>4. {no ? "Energikonseptet" : "The energy concept"}</h2>
        <ol className="list-decimal ml-5 grid gap-1 text-ink-2 max-w-[86ch]">{DIRECTION[locale].map((d) => <li key={d}>{d}</li>)}</ol>
        <table className="table table-tight max-w-[640px] mt-2">
          <tbody>
            <tr><td>{no ? "Samlet energibehov, el og varme" : "Total energy demand, power and heat"}</td><td className="n">{fmt(BUDGET.demand_total_kwh, lang)} kWh/{no ? "år" : "yr"}</td></tr>
            <tr><td>{no ? "Sol per bolig" : "Solar per home"}</td><td className="n">{no ? "om lag" : "about"} {PV_KWP_PER_HOME} kWp</td></tr>
            <tr><td>{no ? "Batteri per bolig" : "Battery per home"}</td><td className="n">{BUDGET.battery.per_home_kwh} kWh</td></tr>
            <tr><td>{no ? "Energibrønner" : "Boreholes"}</td><td className="n">{EED.boreholes} x {Math.round(EED.depth_m)} m</td></tr>
            <tr><td>{no ? "Selvforsyning, strøm" : "Self-sufficiency, power"}</td><td className="n">{fmt(BUDGET.results.self_sufficiency_pct, lang)} %</td></tr>
          </tbody>
        </table>
        <p className="provenance">{no ? "Prosjekteiers retning 4. september 2026; energiregnskapet fra energisporet (foreløpig). Sandbatteriet er senere lagt bort." : "The project owner's direction of 4 September 2026; the energy budget from the energy track (provisional). The sand battery has since been dropped."}</p>
      </section>

      <footer className="border-t line pt-4 text-[13px] text-muted">
        {no ? "Kartdata for det samme utlegget: GeoJSON i EPSG:25832 fra kommunerommet i portalen. Alle tall er foreløpige og byttes ut når reguleringsplanen og rapportene fra energisporet foreligger." : "Map data for the same layout: GeoJSON in EPSG:25832 from the municipality room in the portal. All figures are provisional and are replaced when the zoning plan and the energy track's reports exist."}
      </footer>
    </article>
  );
}
