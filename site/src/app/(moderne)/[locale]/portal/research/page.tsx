import type { Locale } from "@/lib/i18n";
import { getRole, allowed } from "@/lib/auth";
import Gate from "@/components/portal/Gate";

export default async function Research({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const role = await getRole();
  if (!allowed(role, "researcher", "energy_team")) return <Gate locale={locale} role={role} need={["researcher"]} />;
  const datasets = [
    ["plots.json", no ? "30 tomter: posisjon, terreng, sol, sikt, horisontprofil 360°" : "30 plots: position, terrain, sun, view, 360° horizon profile", "CC BY 4.0", "/data/plots.json"],
    ["trees.json", no ? "31 823 trær: posisjon, høyde, krone, art, ryddet" : "31,823 trees: position, height, crown, species, cleared", "CC BY 4.0", "/data/trees.json"],
    ["road.json", no ? "Vei: rekker, ramper, stigning per segment" : "Road: rows, ramps, grade per segment", "CC BY 4.0", "/data/road.json"],
    ["clearing.json", no ? "Ryddeområde (foreløpig)" : "Clearing extent (provisional)", "CC BY 4.0", "/data/clearing.json"],
    ["energy_contract.schema.json", no ? "Datakontrakt for energisporet" : "Data contract for the energy track", "MIT", "/data/schemas/energy_contract.schema.json"],
    [no ? "Målerserier" : "Meter series", no ? "Senere, anonymisert per samtykke" : "Later, anonymised per consent", "DSA", ""],
  ];
  return (
    <div className="grid gap-10">
      <div>
        <h1 className="display text-[clamp(36px,5vw,60px)]">{no ? "Forskningsrom · UiA" : "Research space · UiA"}</h1>
        <p className="measure mt-3">{no ? "Datasett med skjema, lisens og versjon. Siteringstekst: «Knotten digital tvilling, Sigve Simonsen AS / UiA, 2026». API-nøkler kommer senere." : "Datasets with schema, licence and version. Citation: “Knotten digital twin, Sigve Simonsen AS / UiA, 2026”. API keys come later."}</p>
      </div>
      <table className="table max-w-[100ch]">
        <thead><tr><th>{no ? "Datasett" : "Dataset"}</th><th>{no ? "Innhold" : "Contents"}</th><th>{no ? "Lisens" : "Licence"}</th><th></th></tr></thead>
        <tbody>{datasets.map(([a, b, c, d]) => <tr key={a}><td className="font-semibold">{a}</td><td>{b}</td><td>{c}</td><td>{d ? <a href={d} download>{no ? "Last ned" : "Download"}</a> : (no ? "kommer" : "coming")}</td></tr>)}</tbody>
      </table>
      <div className="provenance">{no ? "Kilder: Kartverket (CC BY 4.0), OpenStreetMap (ODbL), AWS Terrain Tiles. Avledede data deles under CC BY 4.0 der kildene tillater det." : "Sources: Kartverket (CC BY 4.0), OpenStreetMap (ODbL), AWS Terrain Tiles. Derived data shared under CC BY 4.0 where sources allow."}</div>
    </div>
  );
}
