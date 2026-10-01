import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { canSeeDoc, canSeeThread, docs, threads } from "@/lib/server/records";
import NoAccess from "@/components/portal/NoAccess";
import { DocList, UploadForm } from "@/components/portal/Docs";
import { Threads } from "@/components/portal/Threads";
import Icon from "@/components/portal/Icon";
import { PageHead, Section, Waiting } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Kommune", "Municipality");

type Road = { ramps: { id: string; climb_m: number; rise_m: number; fall_m: number; length_m: number; length_needed_at_6pct_m: number; feasible_straight: boolean }[]; summary: { total_length_m: number; length_over_6pct_m: number } };

/**
 * For Lindesnes municipality: the regulation basis as a printable report and as map data in
 * EPSG:25832, the road grades, documents, and a place for questions and remarks. The energy
 * report and the plan compliance check wait for meters and for the regulated plan.
 */
export default async function Municipality({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok, base } = await portalPage(params, "/municipality", "municipality");
  if (!ok) return <NoAccess locale={locale} session={session} area="municipality" />;
  const road = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "data", "road.json"), "utf-8")) as Road;
  const [docState, threadState] = await Promise.all([docs.read(), threads.read()]);
  const munDocs = docState.docs.filter((d) => canSeeDoc(session, d) && (d.audience.includes("municipality") || d.audience.includes("all")));
  const talk = threadState.threads.filter((t) => t.area === "municipality" && canSeeThread(session, t));
  const nf = (v: number) => v.toLocaleString(no ? "nb-NO" : "en-GB", { maximumFractionDigits: 1 });
  return (
    <>
      <PageHead
        eyebrow={no ? "Lindesnes kommune" : "Lindesnes municipality"}
        title={no ? "Kommunerommet" : "Municipality room"}
        lede={no ? "Rapportpakker laget fra de samme dataene som nettsiden viser. Kartdata leveres i EPSG:25832 (UTM 32N), klare for kommunens kartverktøy." : "Report packs made from the same data the website shows. Map data comes in EPSG:25832 (UTM 32N), ready for the municipality's map tools."}
      />
      <Section title={no ? "Rapportpakker" : "Report packs"}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel p-5 md:p-6 grid content-start gap-3">
            <div className="flex items-center justify-between gap-2"><span className="font-medium">{no ? "Reguleringsgrunnlag" : "Regulation basis"}</span><span className="chip chip-pine">{no ? "Klar" : "Ready"}</span></div>
            <p className="text-[14.5px] text-ink-2">{no ? "Eiendommen, de 30 tomtene i fire rekker med høyder, sol og sikt, veien med stigning, og energikonseptet. Som utskriftsvennlig rapport og som kartdata." : "The property, the 30 plots in four rows with heights, sun and view, the road with grades, and the energy concept. As a printable report and as map data."}</p>
            <div className="grid gap-2 mt-1">
              <Link href={`${base}/municipality/rapport`} className="btn btn-sm no-underline justify-self-start"><Icon name="file" size={16} />{no ? "Åpne rapporten" : "Open the report"}</Link>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download from an API route, not a page */}
              <a href="/api/geo" className="text-[14px] inline-flex items-center gap-2"><Icon name="download" size={16} />GeoJSON, EPSG:25832</a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download from an API route, not a page */}
              <a href="/api/geo?crs=4326" className="text-[14px] inline-flex items-center gap-2"><Icon name="download" size={16} />GeoJSON, WGS84 (EPSG:4326)</a>
            </div>
          </div>
          <Waiting no={no} title={no ? "Energirapport for feltet" : "Energy report for the field"} needs={no ? ["Målinger fra boligene og fellesanleggene", "Rapportformatet kommunen ønsker"] : ["Readings from the homes and shared plants", "The report format the municipality wants"]}>
            {no ? "Periodisk rapport med feltets kWh, selvforsyning og CO₂, laget automatisk når målingene finnes." : "A periodic report with the field's kWh, self-sufficiency and CO₂, made automatically once readings exist."}
          </Waiting>
          <Waiting no={no} title={no ? "Plansamsvar" : "Plan compliance"} needs={no ? ["Vedtatt reguleringsplan med byggegrenser og høyder, som kartdata"] : ["The adopted zoning plan with building limits and heights, as map data"]}>
            {no ? "Kontroll av plassering og byggehøyder mot den regulerte planen, når planen foreligger." : "A check of placement and building heights against the regulated plan, once the plan exists."}
          </Waiting>
        </div>
      </Section>

      <Section title={no ? "Adkomstveien: stigning" : "The access road: grades"} sub={no ? `Veien i modellen er tegnet på dagens terreng, ${nf(road.summary.total_length_m)} m lang; ${nf(road.summary.length_over_6pct_m)} m av den er brattere enn 6 % før terrengarbeid. Tabellen viser hvor lang hver sving må være for å holde 6 %, så den regulerte planen kan dimensjonere sløyfer og terrengarbeid.` : `The road in the model is drawn on today's ground, ${nf(road.summary.total_length_m)} m long; ${nf(road.summary.length_over_6pct_m)} m of it is steeper than 6 % before earthworks. The table shows how long each bend must be to hold 6 %, so the regulated plan can size loops and earthworks.`}>
        <div className="panel scroll-x">
          <table className="table table-tight min-w-[640px]">
            <thead><tr><th>{no ? "Strekning" : "Stretch"}</th><th className="n">{no ? "Opp" : "Up"}</th><th className="n">{no ? "Ned" : "Down"}</th><th className="n">{no ? "Lengde i modellen" : "Length in the model"}</th><th className="n">{no ? "Trengs ved 6 %" : "Needed at 6 %"}</th><th>{no ? "Rett strekning mulig" : "Straight run feasible"}</th></tr></thead>
            <tbody>{road.ramps.map((r) => <tr key={r.id}><td>{r.id}</td><td className="n">{nf(r.rise_m)} m</td><td className="n">{nf(r.fall_m)} m</td><td className="n">{nf(r.length_m)} m</td><td className="n">{nf(r.length_needed_at_6pct_m)} m</td><td>{r.feasible_straight ? (no ? "ja" : "yes") : (no ? "nei, sløyfe" : "no, loop")}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section title={no ? "Dokumenter" : "Documents"}>
        <div className={isAdmin(session) ? "grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start" : ""}>
          <DocList items={munDocs} session={session} locale={locale} empty={no ? "Situasjonsplan, planbeskrivelse og utredninger legges her når de foreligger." : "Site plan, plan description and studies are added here when they exist."} />
          {isAdmin(session) && <div className="panel p-5 md:p-6"><div className="font-medium mb-3">{no ? "Del et dokument med kommunen" : "Share a document with the municipality"}</div><UploadForm session={session} locale={locale} audience={["municipality"]} category="plan" /></div>}
        </div>
      </Section>

      <Section title={no ? "Spørsmål og merknader" : "Questions and remarks"}>
        <Threads area="municipality" items={talk} session={session} locale={locale} askTitle={no ? "Send et spørsmål eller en merknad" : "Send a question or a remark"} askHint={no ? "Går direkte til prosjekteier, og svaret kommer her." : "Goes straight to the project owner, and the answer comes here."} empty={no ? "Ingen spørsmål eller merknader ennå." : "No questions or remarks yet."} />
      </Section>
    </>
  );
}
