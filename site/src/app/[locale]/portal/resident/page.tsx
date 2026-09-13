import type { Locale } from "@/lib/i18n";
import { getRole, allowed } from "@/lib/auth";
import Gate from "@/components/portal/Gate";
import { loadPlots } from "@/lib/data";
import { frameFor } from "@/lib/energy";
import Passport from "@/components/ui/Passport";

export default async function Resident({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const role = await getRole();
  if (!allowed(role, "resident")) return <Gate locale={locale} role={role} need={["resident"]} />;
  const { plots } = await loadPlots();
  const mine = plots[6];
  const now = new Date();
  const f = frameFor(plots, now.getMonth() + 1, 21, now.getHours() + now.getMinutes() / 60);
  const me = f.plots[mine.id];
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="grid gap-8">
        <div>
          <h1 className="display text-[clamp(36px,5vw,60px)]">{no ? "Mitt hjem" : "My home"}</h1>
          <p className="measure mt-3">{no ? "Demo som beboer på tomt 7. Egen energi, dokumenter, samtykker og fellesskap. Egne målere vises bare for deg; feltet vises aggregert." : "Demo as the resident of plot 7. Own energy, documents, consents and community. Own meters are shown only to you; the field is shown aggregated."}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[[no ? "Produserer nå" : "Producing now", `${me.pv_kw} kW`], [no ? "Bruker nå" : "Using now", `${me.load_kw} kW`], [no ? "Batteri" : "Battery", `${Math.round(me.soc * 100)} %`]].map(([a, b]) => (
            <div key={a}><div className="num text-[40px] leading-none">{b}</div><div className="text-[14px] mt-1">{a}</div></div>
          ))}
        </div>
        <div>
          <h2 className="display text-[28px]">{no ? "Dokumenter" : "Documents"}</h2>
          <table className="table mt-3 max-w-[70ch]">
            <tbody>
              {(no ? ["Kjøpekontrakt", "FDV-dokumentasjon", "Garantier", "Bruksanvisning energisystem"] : ["Purchase contract", "O&M documentation", "Warranties", "Energy system manual"]).map((d) => <tr key={d}><td>{d}</td><td><span className="chip">{no ? "plassholder" : "placeholder"}</span></td></tr>)}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="display text-[28px]">{no ? "Samtykker" : "Consents"}</h2>
          <div className="grid gap-2 mt-3 text-[15px] max-w-[60ch]">
            {(no ? ["Dele mine målinger med feltet (aggregert)", "Dele anonymiserte data med UiA", "La optimalisering styre varmepumpe og lading (med overstyring)"] : ["Share my readings with the field (aggregated)", "Share anonymised data with UiA", "Let optimisation control heat pump and charging (with override)"]).map((c) => (
              <label key={c} className="flex items-center gap-2"><input type="checkbox" defaultChecked /> {c}</label>
            ))}
          </div>
        </div>
      </div>
      <Passport plot={mine} locale={locale} />
    </div>
  );
}
