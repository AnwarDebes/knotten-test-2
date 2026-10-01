import type { Locale } from "@/lib/i18n";
import { getRole, allowed } from "@/lib/auth";
import Gate from "@/components/portal/Gate";
import { FINAL_PHASE, weeks } from "@/lib/facts";

export default async function Project({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const role = await getRole();
  if (!allowed(role, "contractor", "energy_team")) return <Gate locale={locale} role={role} need={["contractor", "energy_team"]} />;
  const tasks = no
    ? [["Georeferert situasjonsplan", "Sigve / planlegger", "åpen", "høy"], ["gnr/bnr → Matrikkel-polygon", "Sigve", "åpen", "høy"], ["Foto fra grillbua (original)", "Sigve", "åpen", "middels"], ["Norge i bilder-tilgang eller droneorto", "Markedssporet", "åpen", "middels"], ["Energikontrakt v1", "Energisporet", "åpen", "høy"], ["Elhub-ID + historikk, kontor og hus", "Sigve", "åpen", "middels"], ["Vinterfoto 21. desember 12:00", "Markedssporet", "planlagt", "lav"]]
    : [["Georeferenced site plan", "Sigve / planner", "open", "high"], ["gnr/bnr → Matrikkel polygon", "Sigve", "open", "high"], ["Grill-hut photo (original)", "Sigve", "open", "medium"], ["Norge i bilder access or drone ortho", "Market track", "open", "medium"], ["Energy contract v1", "Energy track", "open", "high"], ["Elhub ID + history, office and house", "Sigve", "open", "medium"], ["Winter photo 21 Dec 12:00", "Market track", "planned", "low"]];
  const milestones = no
    ? [["2026-09-05", "3D-modell fra Kartverket-LiDAR, siktanalyse, solpass per tomt"], ["2026-09-06", "Nettsted og portal, første versjon"], ["kommer", "Reguleringsplan sendes kommunen"], ["kommer", `Teknisk energirapport fra energisporet, sluttfasen ${weeks(FINAL_PHASE.weeks)}`], ["kommer", "Tomter slippes"]]
    : [["2026-09-05", "3D model from Kartverket LiDAR, view analysis, sun passports per plot"], ["2026-09-06", "Website and portal, first version"], ["later", "Zoning plan submitted to the municipality"], ["later", `Technical energy report from the energy track, final phase ${weeks(FINAL_PHASE.weeks, "en")}`], ["later", "Plots released"]];
  return (
    <div className="grid gap-12">
      <div>
        <h1 className="display text-[clamp(36px,5vw,60px)]">{no ? "Prosjektarbeidsrom" : "Project workspace"}</h1>
        <p className="measure mt-3">{no ? "Oppgaver, beslutninger og dokumenter knyttet til tomter og systemer. Det som er offentlig, publiseres til nyhetssiden med ett trykk." : "Tasks, decisions and documents linked to plots and systems. What is public is published to the news page with one toggle."}</p>
      </div>
      <div>
        <h2 className="display text-[30px]">{no ? "Oppgaver" : "Tasks"}</h2>
        <table className="table mt-3 max-w-[90ch]">
          <thead><tr><th>{no ? "Oppgave" : "Task"}</th><th>{no ? "Eier" : "Owner"}</th><th>Status</th><th>{no ? "Prioritet" : "Priority"}</th></tr></thead>
          <tbody>{tasks.map(([a, b, c, d]) => <tr key={a}><td>{a}</td><td>{b}</td><td><span className="chip">{c}</span></td><td>{d}</td></tr>)}</tbody>
        </table>
      </div>
      <div>
        <h2 className="display text-[30px]">{no ? "Milepæler" : "Milestones"}</h2>
        <table className="table mt-3 max-w-[90ch]">
          <tbody>{milestones.map(([a, b]) => <tr key={b}><td className="whitespace-nowrap">{a}</td><td>{b}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
