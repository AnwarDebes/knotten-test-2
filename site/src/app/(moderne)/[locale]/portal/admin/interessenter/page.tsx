import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { readStore, LEAD_STATUSES } from "@/lib/store";
import { plotNo } from "@/lib/format";
import { addLead, addLeadNote, deleteLead, setLeadStatus } from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { no: string; en: string }> = { new: { no: "Ny", en: "New" }, contacted: { no: "Kontaktet", en: "Contacted" }, qualified: { no: "Kvalifisert", en: "Qualified" }, won: { no: "Kjøpt", en: "Won" }, lost: { no: "Tapt", en: "Lost" } };
const PURPOSE: Record<string, { no: string; en: string }> = { buy: { no: "kjøpe bolig", en: "buy a home" }, invest: { no: "investere", en: "invest" }, partner: { no: "samarbeide", en: "partner" }, curious: { no: "følge med", en: "follow along" } };

/** Every person who has registered interest, with status, notes and consents. */
export default async function Leads({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; q?: string }> }) {
  const { locale: l } = await params;
  const { status, q = "" } = await searchParams;
  const locale = l as Locale;
  const no = locale === "no";
  const store = await readStore();
  const needle = q.toLowerCase();
  const leads = [...store.leads].reverse().filter((x) => (!status || x.status === status) && (!needle || `${x.name} ${x.email} ${x.phone} ${x.plots.join(" ")}`.toLowerCase().includes(needle)));
  const csv = [["created", "name", "email", "phone", "purpose", "plots", "status", "consent_updates", "consent_investor", "consent_research", "source"].join(";"), ...store.leads.map((x) => [x.created, x.name, x.email, x.phone, x.purpose, x.plots.join(" "), x.status, x.consent_updates, x.consent_investor, x.consent_research, x.source].map((v) => `"${String(v).replace(/"/g, "'")}"`).join(";"))].join("\n");
  return (
    <div className="grid gap-8">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] items-end">
        <div>
          <h1 className="display text-[clamp(34px,4.5vw,56px)]">{no ? "Interessenter" : "Leads"}</h1>
          <p className="text-[15px] text-muted mt-2 max-w-[60ch]">{no ? "Alle som har meldt interesse på nettsiden, og de du legger inn selv. Sett status når du har snakket med dem, og skriv et notat så du husker hva dere ble enige om." : "Everyone who registered interest on the website, and the ones you add yourself. Set the status once you have spoken to them, and write a note so you remember what you agreed."}</p>
        </div>
        <a className="btn btn-ghost btn-sm no-underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download="knotten-interessenter.csv">{no ? "Last ned som Excel (CSV)" : "Download as Excel (CSV)"}</a>
      </div>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <div className="seg">
          <Link href="?" className={`no-underline px-3 py-2 rounded-full text-[14px] ${!status ? "bg-bone text-bg" : ""}`}>{no ? "Alle" : "All"} {store.leads.length}</Link>
          {LEAD_STATUSES.map((s) => <Link key={s} href={`?status=${s}`} className={`no-underline px-3 py-2 rounded-full text-[14px] ${status === s ? "bg-bone text-bg" : ""}`}>{STATUS[s][locale]} {store.leads.filter((x) => x.status === s).length}</Link>)}
        </div>
        {status && <input type="hidden" name="status" value={status} />}
        <input className="input !w-[240px] !py-2" name="q" defaultValue={q} placeholder={no ? "Søk navn, e-post, tomt" : "Search name, email, plot"} />
        <button className="btn btn-sm btn-plain btn-ghost">{no ? "Søk" : "Search"}</button>
      </form>

      <div className="grid gap-3">
        {leads.length === 0 && <div className="panel p-6 text-muted">{no ? "Ingen treff." : "No matches."}</div>}
        {leads.map((x) => (
          <details key={x.id} className="panel">
            <summary className="list-none cursor-pointer p-4 md:p-5 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] items-center">
              <div>
                <div className="font-medium">{x.name || (no ? "Uten navn" : "No name")} {x.source === "eksempel" && <span className="chip chip-amber ml-1">{no ? "eksempel" : "example"}</span>}</div>
                <div className="text-[13.5px] text-muted">{x.email}{x.phone ? `, ${x.phone}` : ""}</div>
              </div>
              <div className="text-[14px]">
                <div>{no ? "Vil " : "Wants to "}{PURPOSE[x.purpose][locale]}</div>
                <div className="text-[13px] text-muted">{x.plots.length ? (no ? "Tomt " : "Plot ") + x.plots.map(plotNo).join(", ") : (no ? "Ingen tomt valgt" : "No plot chosen")}</div>
              </div>
              <div className="text-[13px] text-muted">
                <div>{x.created.slice(0, 16).replace("T", " ")}</div>
                <div>{[x.consent_updates && (no ? "oppdateringer" : "updates"), x.consent_investor && (no ? "investor" : "investor"), x.consent_research && "UiA"].filter(Boolean).join(", ")}</div>
              </div>
              <form action={setLeadStatus} className="flex items-center gap-2" onClick={undefined}>
                <input type="hidden" name="id" value={x.id} />
                <select name="status" defaultValue={x.status} className="input !py-2 !w-auto !text-[14px]">
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s][locale]}</option>)}
                </select>
                <button className="btn btn-sm btn-plain">{no ? "Lagre" : "Save"}</button>
              </form>
            </summary>
            <div className="px-4 md:px-5 pb-5 grid gap-4 md:grid-cols-[1fr_1fr] border-t line pt-4">
              <div>
                <div className="text-[13px] text-muted mb-2">{no ? "Notater" : "Notes"}</div>
                <div className="grid gap-2 text-[14px]">
                  {x.notes.map((n, i) => <div key={i} className="rounded-[var(--radius)] bg-bone/5 p-3"><div className="text-[12px] text-muted">{n.at.slice(0, 16).replace("T", " ")}, {n.by}</div>{n.text}</div>)}
                  {x.notes.length === 0 && <div className="text-muted text-[14px]">{no ? "Ingen notater ennå." : "No notes yet."}</div>}
                </div>
                <form action={addLeadNote} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={x.id} />
                  <input className="input !py-2" name="text" placeholder={no ? "Ring tilbake torsdag, vil se tomt 12" : "Call back Thursday, wants to see plot 12"} />
                  <button className="btn btn-sm btn-plain">{no ? "Legg til" : "Add"}</button>
                </form>
              </div>
              <div className="grid content-start gap-3 text-[14px]">
                <div><span className="text-muted">{no ? "Kilde: " : "Source: "}</span>{x.source}</div>
                <div><span className="text-muted">{no ? "Samtykke: " : "Consent: "}</span>{x.consent_updates ? (no ? "oppdateringer" : "updates") : ""}{x.consent_investor ? (no ? ", kan kontaktes om investering" : ", may be contacted about investing") : ""}{x.consent_research ? (no ? ", anonym statistikk til UiA" : ", anonymous statistics to UiA") : ""}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <a className="btn btn-sm btn-ghost btn-plain no-underline" href={`mailto:${x.email}?subject=${encodeURIComponent("Knotten")}`}>{no ? "Send e-post" : "Send email"}</a>
                  {x.phone && <a className="btn btn-sm btn-ghost btn-plain no-underline" href={`tel:${x.phone.replace(/\s/g, "")}`}>{no ? "Ring" : "Call"}</a>}
                  <form action={deleteLead}><input type="hidden" name="id" value={x.id} /><button className="btn btn-sm btn-ghost btn-plain text-amber">{no ? "Slett" : "Delete"}</button></form>
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>

      <details className="panel">
        <summary className="list-none cursor-pointer p-5 font-medium">{no ? "Legg inn en interessent selv" : "Add a lead yourself"}</summary>
        <form action={addLead} className="px-5 pb-5 grid gap-3 md:grid-cols-3 border-t line pt-4">
          <label className="grid gap-1 text-[13px]">{no ? "Navn" : "Name"}<input className="input !py-2" name="name" /></label>
          <label className="grid gap-1 text-[13px]">E-post<input className="input !py-2" name="email" type="email" required /></label>
          <label className="grid gap-1 text-[13px]">{no ? "Telefon" : "Phone"}<input className="input !py-2" name="phone" /></label>
          <label className="grid gap-1 text-[13px]">{no ? "Vil" : "Wants to"}
            <select name="purpose" className="input !py-2">{Object.keys(PURPOSE).map((k) => <option key={k} value={k}>{PURPOSE[k][locale]}</option>)}</select>
          </label>
          <label className="grid gap-1 text-[13px]">{no ? "Tomter (f.eks. 12, 14)" : "Plots (e.g. 12, 14)"}<input className="input !py-2" name="plots" /></label>
          <label className="grid gap-1 text-[13px]">{no ? "Notat" : "Note"}<input className="input !py-2" name="note" /></label>
          <button className="btn btn-amber btn-sm justify-self-start md:col-span-3">{no ? "Legg til" : "Add"}</button>
        </form>
      </details>
    </div>
  );
}
