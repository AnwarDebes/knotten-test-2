import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { readStore, LEAD_STATUSES } from "@/lib/store";
import { loadPlots } from "@/lib/data";
import { plotName } from "@/lib/format";
import { removeExamples } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_NO: Record<string, string> = { new: "Ny", contacted: "Kontaktet", qualified: "Kvalifisert", won: "Kjøpt", lost: "Tapt" };
const STATUS_EN: Record<string, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", won: "Won", lost: "Lost" };
const PURPOSE_NO: Record<string, string> = { buy: "kjøpe", invest: "investere", partner: "samarbeide", curious: "følge med" };
const PURPOSE_EN: Record<string, string> = { buy: "buy", invest: "invest", partner: "partner", curious: "follow" };

/** The owner's morning page: what came in, where each lead stands, which plots people ask for. */
export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const session = await getSession();
  const store = await readStore();
  const { plots } = await loadPlots();
  const p = (path: string) => `/${locale}/portal/admin${path}`;
  const week = Date.now() - 7 * 86400e3;
  const leads = store.leads;
  const fresh = leads.filter((x) => Date.parse(x.created) > week).length;
  const unhandled = leads.filter((x) => x.status === "new").length;
  const buyers = leads.filter((x) => x.purpose === "buy").length;
  const investors = leads.filter((x) => x.purpose === "invest" || x.consent_investor).length;
  const plotState = (id: string) => store.plots[id]?.status ?? "unreleased";
  const byPlotStatus = { available: 0, reserved: 0, sold: 0, unreleased: 0 };
  for (const pl of plots) byPlotStatus[plotState(pl.id)]++;
  const wanted = Object.entries(leads.flatMap((x) => x.plots).reduce<Record<string, number>>((a, id) => { a[id] = (a[id] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxWanted = wanted[0]?.[1] ?? 1;
  const hour = new Date().getHours();
  const greet = no ? (hour < 10 ? "God morgen" : hour < 17 ? "God dag" : "God kveld") : (hour < 10 ? "Good morning" : hour < 17 ? "Good day" : "Good evening");
  const raw = (session?.name || "").split(" ")[0];
  const first = raw ? raw[0].toUpperCase() + raw.slice(1) : "";
  const examples = leads.filter((x) => x.source === "eksempel").length;
  const kpis: [string, number | string, string][] = [
    [no ? "Interessenter" : "Leads", leads.length, no ? `${fresh} siste 7 dager` : `${fresh} in the last 7 days`],
    [no ? "Venter på svar" : "Awaiting a reply", unhandled, no ? "status Ny" : "status New"],
    [no ? "Vil kjøpe" : "Want to buy", buyers, no ? `${investors} vil investere` : `${investors} want to invest`],
    [no ? "Tomter sluppet" : "Plots released", `${byPlotStatus.available + byPlotStatus.reserved + byPlotStatus.sold} / ${plots.length}`, no ? `${byPlotStatus.reserved} reservert, ${byPlotStatus.sold} solgt` : `${byPlotStatus.reserved} reserved, ${byPlotStatus.sold} sold`],
  ];
  return (
    <div className="grid gap-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] items-end">
        <div>
          <h1 className="display text-[clamp(36px,5vw,64px)]">{greet}{first ? `, ${first}` : ""}.</h1>
          <p className="lede mt-3 max-w-[56ch]">
            {unhandled > 0
              ? (no ? `${unhandled} ${unhandled === 1 ? "person venter" : "personer venter"} på svar. Alt annet er i orden.` : `${unhandled} ${unhandled === 1 ? "person is" : "people are"} waiting for a reply. Everything else is in order.`)
              : (no ? "Ingen venter på svar. Her er status for feltet." : "Nobody is waiting for a reply. Here is the state of the field.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unhandled > 0 && <Link className="btn btn-amber no-underline" href={p("/interessenter?status=new")}>{no ? "Svar de nye" : "Answer the new ones"}</Link>}
          <Link className="btn btn-ghost no-underline" href={p("/tomter")}>{no ? "Tomter og priser" : "Plots and prices"}</Link>
        </div>
      </div>

      {examples > 0 && (
        <form action={removeExamples} className="panel p-4 flex flex-wrap items-center gap-3 text-[14px]">
          <span className="w-2 h-2 rounded-full bg-amber" />
          <span>{no ? `${examples} av interessentene er eksempler, lagt inn for å vise hvordan oversikten virker.` : `${examples} of the leads are examples, added to show how the overview works.`}</span>
          <button className="btn btn-sm btn-plain btn-ghost ml-auto">{no ? "Fjern eksemplene" : "Remove the examples"}</button>
        </form>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([h, v, sub]) => (
          <div key={h} className="panel p-5">
            <div className="text-[14px] text-muted">{h}</div>
            <div className="num text-[44px] mt-2">{v}</div>
            <div className="text-[13.5px] text-muted mt-1.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="display text-[26px]">{no ? "Hvor hver interessent står" : "Where every lead stands"}</h2>
            <Link href={p("/interessenter")} className="text-[14px]">{no ? "Alle interessenter" : "All leads"}</Link>
          </div>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {LEAD_STATUSES.map((s) => {
              const col = leads.filter((x) => x.status === s);
              return (
                <Link key={s} href={p(`/interessenter?status=${s}`)} className="no-underline rounded-[var(--radius)] bg-bone/5 hover:bg-bone/10 transition-colors p-3 min-h-[120px] grid content-start gap-1.5">
                  <div className="text-[12.5px] text-muted">{no ? STATUS_NO[s] : STATUS_EN[s]}</div>
                  <div className="num text-[28px]">{col.length}</div>
                  <div className="grid gap-1 text-[12.5px] mt-1">
                    {col.slice(0, 4).map((x) => <div key={x.id} className="truncate">{x.name || x.email}</div>)}
                    {col.length > 4 && <div className="text-muted">+{col.length - 4}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
          {leads.length === 0 && (
            <p className="text-[14px] text-muted mt-4">{no ? "Ingen interessenter ennå. Skjemaet ligger på forsiden og på /interesse. Du kan også legge inn noen du har snakket med." : "No leads yet. The form sits on the front page and at /interesse. You can also add someone you have spoken to."}</p>
          )}
        </div>

        <div className="panel p-5 md:p-6">
          <h2 className="display text-[26px]">{no ? "Tomtene folk spør etter" : "The plots people ask for"}</h2>
          {wanted.length === 0 ? (
            <p className="text-[14px] text-muted mt-4">{no ? "Vises når noen har krysset av for tomter i skjemaet." : "Shown once someone ticks plots in the form."}</p>
          ) : (
            <div className="mt-5 grid gap-2.5">
              {wanted.map(([id, n]) => (
                <div key={id} className="grid grid-cols-[72px_1fr_32px] items-center gap-3 text-[14px]">
                  <Link href={`/${locale}/tomter/${id}`}>{plotName(id, no)}</Link>
                  <div className="h-[8px] rounded-full bg-bone/10 overflow-hidden"><div className="h-full bg-amber rounded-full" style={{ width: `${(n / maxWanted) * 100}%` }} /></div>
                  <div className="num text-[18px] text-right">{n}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 grid grid-cols-4 gap-2 text-center">
            {(["unreleased", "available", "reserved", "sold"] as const).map((s) => (
              <div key={s} className="rounded-[var(--radius)] bg-bone/5 p-2.5">
                <div className="num text-[22px]">{byPlotStatus[s]}</div>
                <div className="text-[12px] text-muted">{no ? { unreleased: "ikke sluppet", available: "ledig", reserved: "reservert", sold: "solgt" }[s] : s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="display text-[26px]">{no ? "Siste registreringer" : "Latest registrations"}</h2>
          <table className="table mt-3">
            <thead><tr><th>{no ? "Når" : "When"}</th><th>{no ? "Hvem" : "Who"}</th><th>{no ? "Vil" : "Wants to"}</th><th>Status</th></tr></thead>
            <tbody>
              {[...leads].reverse().slice(0, 8).map((x) => (
                <tr key={x.id}>
                  <td className="whitespace-nowrap">{x.created.slice(0, 10)}</td>
                  <td><div>{x.name || x.email}</div><div className="text-[12.5px] text-muted">{x.email}</div></td>
                  <td>{no ? PURPOSE_NO[x.purpose] : PURPOSE_EN[x.purpose]}</td>
                  <td><span className={`chip ${x.status === "new" ? "chip-amber" : x.status === "won" ? "chip-pine" : ""}`}>{no ? STATUS_NO[x.status] : STATUS_EN[x.status]}</span></td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan={4} className="text-muted">{no ? "Ingen ennå." : "None yet."}</td></tr>}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="display text-[26px]">{no ? "Siste hendelser" : "Recent activity"}</h2>
          <div className="mt-3 grid gap-2 text-[14px]">
            {store.activity.slice(0, 10).map((a, i) => (
              <div key={i} className="grid grid-cols-[130px_1fr] gap-3 py-2 border-b line">
                <span className="text-muted whitespace-nowrap">{a.at.slice(0, 16).replace("T", " ")}</span>
                <span><span className="text-muted">{a.by}: </span>{a.what}</span>
              </div>
            ))}
            {store.activity.length === 0 && <p className="text-muted">{no ? "Alt du endrer her logges, så du kan se hva som skjedde og når." : "Everything you change here is logged, so you can see what happened and when."}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
