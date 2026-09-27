import { promises as fs } from "fs";
import path from "path";
import type { Locale } from "@/lib/i18n";
import { getRole, allowed } from "@/lib/auth";
import Gate from "@/components/portal/Gate";

type Road = { rows: { row: number; level: number; pts: [number, number][] }[]; ramps: { to_row: number; climb_m: number; straight_length_m: number; length_needed_at_6pct_m: number; feasible_straight: boolean }[]; summary: { total_length_m: number; segments_over_6pct: number; worst_grade_pct: number } };

export default async function Municipality({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const role = await getRole();
  if (!allowed(role, "municipality")) return <Gate locale={locale} role={role} need={["municipality"]} />;
  const road = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "data", "road.json"), "utf-8")) as Road;
  const packs = no
    ? [["Reguleringsgrunnlag", "LiDAR-kart med koter, tomter, vei med stigning, sikt- og solanalyse, energikonsept", "PDF + GeoJSON (EPSG:25832)"], ["Energirapport (periodisk)", "Feltets kWh, selvforsyning, CO₂, fra utgivelse 2", "PDF"], ["Plansamsvar", "Byggehøyder, plassering mot regulert plan, når planen foreligger", "PDF"]]
    : [["Regulation basis", "LiDAR map with contours, plots, road with grades, view and sun analysis, energy concept", "PDF + GeoJSON (EPSG:25832)"], ["Energy report (periodic)", "Field kWh, self-sufficiency, CO₂, from release 2", "PDF"], ["Plan compliance", "Building heights, placement vs the regulated plan, when the plan exists", "PDF"]];
  return (
    <div className="grid gap-12">
      <div>
        <h1 className="display text-[clamp(36px,5vw,60px)]">{no ? "Til Lindesnes kommune" : "For Lindesnes municipality"}</h1>
        <p className="measure mt-3">{no ? "Rapportpakker generert fra de samme dataene som nettsiden viser. Alle koordinater i EPSG:25832." : "Report packs generated from the same data the website shows. All coordinates in EPSG:25832."}</p>
        <table className="table mt-6 max-w-[100ch]">
          <thead><tr><th>{no ? "Pakke" : "Pack"}</th><th>{no ? "Innhold" : "Contents"}</th><th>Format</th></tr></thead>
          <tbody>{packs.map(([a, b, c]) => <tr key={a}><td className="font-semibold">{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
        </table>
      </div>
      <div>
        <h2 className="display text-[30px]">{no ? "Adkomstvei: stigning" : "Access road: grades"}</h2>
        <p className="measure mt-2 text-[15px]">{no ? "Rekkeveiene følger kotene og er flate. Rampene mellom rekkene er rette plassholdere; tabellen sier hvor lang en 6 %-vei må være, slik at den virkelige planen kan dimensjonere hårnålssvinger." : "Row roads follow contours and are level. Ramps between rows are straight placeholders; the table states how long a 6 % road needs to be, so the real plan can size hairpins."}</p>
        <table className="table mt-4 max-w-[80ch]">
          <thead><tr><th>{no ? "Rampe til rekke" : "Ramp to row"}</th><th className="n">{no ? "Stigning" : "Climb"}</th><th className="n">{no ? "Rett lengde" : "Straight length"}</th><th className="n">{no ? "Trengs ved 6 %" : "Needed at 6 %"}</th><th>{no ? "Rett rampe mulig" : "Straight ramp feasible"}</th></tr></thead>
          <tbody>
            {road.ramps.map((r) => (
              <tr key={r.to_row}><td>{r.to_row}</td><td className="n">{r.climb_m} m</td><td className="n">{r.straight_length_m} m</td><td className="n">{r.length_needed_at_6pct_m} m</td><td>{r.feasible_straight ? (no ? "ja" : "yes") : (no ? "nei, hårnål" : "no, hairpin")}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="provenance mt-2">{no ? "Rekkeveier" : "Row roads"}: {road.rows.map((r) => `${r.level} m`).join(", ")} · {no ? "total lengde i modellen" : "total length in model"} {road.summary.total_length_m} m · Kartverket DTM 1 m.</div>
      </div>
    </div>
  );
}
