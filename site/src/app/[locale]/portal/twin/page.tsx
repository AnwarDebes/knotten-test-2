import type { Locale } from "@/lib/i18n";
import { getRole, allowed } from "@/lib/auth";
import Gate from "@/components/portal/Gate";
import Stage from "@/components/Stage";
import { loadPlots } from "@/lib/data";

export default async function Twin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const role = await getRole();
  if (!allowed(role, "energy_team", "resident", "investor")) return <Gate locale={locale} role={role} need={["energy_team", "resident"]} />;
  const { plots } = await loadPlots();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-[clamp(36px,5vw,60px)]">{no ? "Den digitale tvillingen" : "The digital twin"}</h1>
        <p className="measure mt-3">{no ? "Samme modell som på forsiden, bundet til data. Nå: modellrammer. Utgivelse 3: målere, vær fra MET, historikk, strømbruddsavspilling, feil som lyser." : "The same model as the front page, bound to data. Now: model frames. Release 3: meters, MET weather, history, outage replay, faults that light up."}</p>
      </div>
      <Stage plots={plots} locale={locale} initialMode="field" />
      <div className="provenance">{no ? "Rammekontrakt: GET /api/energy/frame?ts= → {plots: {plot-07: {pv_kw, load_kw, soc, sharing_to}}, field}. Kilde i dag: model." : "Frame contract: GET /api/energy/frame?ts= → {plots: {plot-07: {pv_kw, load_kw, soc, sharing_to}}, field}. Source today: model."}</div>
    </div>
  );
}
