import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { readStore, PLOT_STATUSES } from "@/lib/store";
import { loadPlots } from "@/lib/data";
import { plotName, rowLabel } from "@/lib/format";
import { savePlot, setAllPlots } from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { no: string; en: string }> = { unreleased: { no: "Ikke sluppet", en: "Unreleased" }, available: { no: "Ledig", en: "Available" }, reserved: { no: "Reservert", en: "Reserved" }, sold: { no: "Solgt", en: "Sold" } };

/** Status and price per plot. What is saved here shows on the public plot pages at once. */
export default async function AdminPlots({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const store = await readStore();
  const { plots } = await loadPlots();
  const hill = plots.filter((p) => p.zone !== "flat");
  const wanted = store.leads.flatMap((x) => x.plots).reduce<Record<string, number>>((a, id) => { a[id] = (a[id] ?? 0) + 1; return a; }, {});
  const ids = plots.map((p) => p.id).join(",");
  return (
    <div className="grid gap-8">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] items-end">
        <div>
          <h1 className="display text-[clamp(34px,4.5vw,56px)]">{no ? "Tomter og priser" : "Plots and prices"}</h1>
          <p className="text-[15px] text-muted mt-2 max-w-[60ch]">{no ? "Det du lagrer her vises på tomtesidene med en gang. Prisen står tom til du setter den. Sol og sikt er regnet fra terrenget og kan ikke endres her." : "What you save here shows on the plot pages at once. The price stays empty until you set it. Sun and view are computed from the terrain and cannot be changed here."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={setAllPlots}><input type="hidden" name="ids" value={hill.map((p) => p.id).join(",")} /><input type="hidden" name="status" value="available" /><button className="btn btn-sm btn-plain btn-ghost">{no ? "Slipp alle på åsen" : "Release all on the hill"}</button></form>
          <form action={setAllPlots}><input type="hidden" name="ids" value={ids} /><input type="hidden" name="status" value="unreleased" /><button className="btn btn-sm btn-plain btn-ghost">{no ? "Trekk alle tilbake" : "Withdraw all"}</button></form>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>{no ? "Tomt" : "Plot"}</th><th className="n">{no ? "Sol 21. des" : "Sun 21 Dec"}</th><th className="n">{no ? "Sjø i sikt" : "Water"}</th><th className="n">{no ? "Spurt etter" : "Asked for"}</th><th>Status</th><th>{no ? "Pris (kr)" : "Price (kr)"}</th><th>{no ? "Notat" : "Note"}</th><th></th></tr>
          </thead>
          <tbody>
            {plots.map((p) => {
              const s = store.plots[p.id];
              return (
                <tr key={p.id}>
                  <td><Link href={`/${locale}/tomter/${p.id}`} className="font-medium whitespace-nowrap">{plotName(p.id, no)}</Link><div className="text-[12px] text-muted">{p.zone === "flat" ? (no ? "flaten" : "flat") : `${no ? "rekke" : "row"} ${rowLabel(p)}`}, {p.local.z_ground.toFixed(0)} m</div></td>
                  <td className="n">{p.sun.dec21.hours.toFixed(1)} h</td>
                  <td className="n">{p.view.water_visible_deg}°{p.view.open_sea_visible ? "" : ""}</td>
                  <td className="n">{wanted[p.id] ?? 0}</td>
                  <td colSpan={4}>
                    <form action={savePlot} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <select name="status" defaultValue={s?.status ?? "unreleased"} className="input !py-1.5 !w-auto !text-[14px]">
                        {PLOT_STATUSES.map((k) => <option key={k} value={k}>{STATUS[k][locale]}</option>)}
                      </select>
                      <input name="price_nok" defaultValue={s?.price_nok ?? ""} inputMode="numeric" placeholder="2 450 000" className="input !py-1.5 !w-[140px] !text-[14px]" />
                      <input name="note" defaultValue={s?.note ?? ""} placeholder={no ? "f.eks. reservert for Hansen til 1. nov" : "e.g. reserved for Hansen until 1 Nov"} className="input !py-1.5 !w-[260px] !text-[14px]" />
                      <button className="btn btn-sm btn-plain">{no ? "Lagre" : "Save"}</button>
                      {s?.updated && <span className="text-[12px] text-muted">{no ? "endret" : "changed"} {s.updated.slice(0, 10)}</span>}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
