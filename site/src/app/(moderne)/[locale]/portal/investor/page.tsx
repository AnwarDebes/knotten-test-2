import type { Locale } from "@/lib/i18n";
import { getRole, allowed } from "@/lib/auth";
import Gate from "@/components/portal/Gate";
import Scenario from "@/components/portal/Scenario";
import { assumption } from "@/lib/facts";
import { Figure } from "@/components/ui/Provenance";

export default async function InvestorPortal({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const role = await getRole();
  if (!allowed(role, "investor")) return <Gate locale={locale} role={role} need={["investor"]} />;
  const docs = no
    ? [["Prospekt (utkast)", "eksempel", "ikke lagt inn"], ["Energikonsept, energisporet", "eksempel", "kommer"], ["Reguleringsstatus", "eksempel", "ikke lagt inn"], ["Finansiell modell (xlsx)", "eksempel", "ikke lagt inn"], ["Risikoregister", "eksempel", "ikke lagt inn"], ["Siktanalyse og solpass, alle tomter", "modell v6", "2026-09-30"]]
    : [["Prospectus (draft)", "example", "not added"], ["Energy concept, energy track", "example", "coming"], ["Regulation status", "example", "not added"], ["Financial model (xlsx)", "example", "not added"], ["Risk register", "example", "not added"], ["View analysis and sun passports, all plots", "model v6", "2026-09-30"]];
  return (
    <div className="grid gap-12">
      <div>
        <h1 className="display text-[clamp(36px,5vw,60px)]">{no ? "Datarom" : "Data room"}</h1>
        <p className="measure mt-3">{no ? "Eksempel på innholdet i datarommet. Et lukket område for investorer er planlagt; ingen dokumenter er lagt inn ennå." : "An example of what the data room will hold. A closed area for investors is planned; no documents have been added yet."}</p>
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
          <Figure a={assumption("co2_saved")} locale={locale} size="md" />
          <Figure a={assumption("trees_cleared")} locale={locale} size="md" />
          <Figure a={assumption("saving_per_home")} locale={locale} size="md" />
        </div>
      </div>
    </div>
  );
}
