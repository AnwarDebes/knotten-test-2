import type { Locale } from "@/lib/i18n";
import { getRole, allowed } from "@/lib/auth";
import Gate from "@/components/portal/Gate";
import Scenario from "@/components/portal/Scenario";
import { assumption } from "@/lib/assumptions";
import { Figure } from "@/components/ui/Provenance";

export default async function InvestorPortal({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const role = await getRole();
  if (!allowed(role, "investor")) return <Gate locale={locale} role={role} need={["investor"]} />;
  const docs = no
    ? [["Prospekt (utkast)", "v0.3", "2026-09-05"], ["Energikonsept, UiA gruppe 1", "v0.1", "kommer"], ["Reguleringsstatus", "v1", "2026-09-05"], ["Finansiell modell (xlsx)", "v0.2", "2026-09-05"], ["Risikoregister", "v0.1", "2026-09-05"], ["Siktanalyse og solpass, alle tomter", "v1", "2026-09-05"]]
    : [["Prospectus (draft)", "v0.3", "2026-09-05"], ["Energy concept, UiA group 1", "v0.1", "coming"], ["Regulation status", "v1", "2026-09-05"], ["Financial model (xlsx)", "v0.2", "2026-09-05"], ["Risk register", "v0.1", "2026-09-05"], ["View analysis and sun passports, all plots", "v1", "2026-09-05"]];
  return (
    <div className="grid gap-12">
      <div>
        <h1 className="display text-[clamp(36px,5vw,60px)]">{no ? "Datarom" : "Data room"}</h1>
        <p className="measure mt-3">{no ? "Dokumenter med versjon og nedlastingslogg. NDA signeres før tilgang i produksjon." : "Documents with version and download log. NDA is signed before access in production."}</p>
        <table className="table mt-6 max-w-[80ch]">
          <thead><tr><th>{no ? "Dokument" : "Document"}</th><th>{no ? "Versjon" : "Version"}</th><th>{no ? "Dato" : "Date"}</th><th></th></tr></thead>
          <tbody>{docs.map(([t, v, d]) => <tr key={t}><td>{t}</td><td>{v}</td><td>{d}</td><td><span className="chip">{no ? "plassholder" : "placeholder"}</span></td></tr>)}</tbody>
        </table>
      </div>
      <div>
        <h2 className="display text-[36px]">{no ? "Scenarioutforsker" : "Scenario explorer"}</h2>
        <p className="measure mt-2 mb-6">{no ? "Dra i forutsetningene. Alle utfall regnes om i nettleseren fra publiserte responskurver." : "Drag the assumptions. Every outcome recomputes in the browser from published response curves."}</p>
        <Scenario locale={locale} homes={assumption("homes").value} />
      </div>
      <div>
        <h2 className="display text-[36px]">{no ? "Etterspørsel og ESG" : "Demand and ESG"}</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Figure a={assumption("homes")} locale={locale} size="md" />
          <Figure a={assumption("co2_avoided_t")} locale={locale} size="md" />
          <Figure a={assumption("trees_cleared")} locale={locale} size="md" />
          <Figure a={assumption("opex_saving_nok")} locale={locale} size="md" />
        </div>
      </div>
    </div>
  );
}
