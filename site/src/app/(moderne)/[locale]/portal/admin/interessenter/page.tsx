import Link from "next/link";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { readStore, LEAD_LABEL, LEAD_STATUSES } from "@/lib/store";
import { plotNo } from "@/lib/format";
import { addLead, addLeadNote, deleteLead, setLeadStatus, toggleExcluded } from "../actions";
import NoAccess from "@/components/portal/NoAccess";
import { ConfirmButton } from "@/components/portal/forms";
import { PageHead, when } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Interessenter", "Leads");

const PURPOSE: Record<string, { no: string; en: string }> = { buy: { no: "kjøpe bolig", en: "buy a home" }, invest: { no: "investere", en: "invest" }, partner: { no: "samarbeide", en: "partner" }, curious: { no: "følge med", en: "follow along" } };

/** Every person who has registered interest, with status, notes, consents and reply time. */
export default async function Leads({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; q?: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/admin/interessenter", "admin");
  if (!ok) return <NoAccess locale={locale} session={session} area="admin" />;
  const { status, q = "" } = await searchParams;
  const store = await readStore();
  const needle = q.toLowerCase();
  const leads = [...store.leads].reverse().filter((x) => (!status || x.status === status) && (!needle || `${x.name} ${x.email} ${x.phone} ${x.plots.join(" ")}`.toLowerCase().includes(needle)));
  const csv = [["created", "name", "email", "phone", "purpose", "plots", "status", "replied", "counted", "consent_updates", "consent_investor", "consent_research", "source"].join(";"), ...store.leads.map((x) => [x.created, x.name, x.email, x.phone, x.purpose, x.plots.join(" "), x.status, x.replied ?? "", !x.excluded, x.consent_updates, x.consent_investor, x.consent_research, x.source].map((v) => `"${String(v).replace(/"/g, "'")}"`).join(";"))].join("\n");
  const hours = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3600e3;
  const ago = (h: number) => (h < 1 ? (no ? "under en time" : "under an hour") : h < 48 ? `${Math.round(h)} ${no ? "timer" : "hours"}` : `${Math.round(h / 24)} ${no ? "dager" : "days"}`);
  return (
    <>
      <PageHead
        eyebrow={no ? "Administrasjon" : "Administration"}
        title={no ? "Interessenter" : "Leads"}
        lede={no ? "Alle som har meldt interesse på nettsiden, i begge utseender, og de du legger inn selv. Sett status når du har snakket med dem, og skriv et notat så du husker hva dere ble enige om." : "Everyone who registered interest on the website, in both designs, and the ones you add yourself. Set the status once you have spoken to them, and write a note so you remember what you agreed."}
        actions={<a className="btn btn-ghost btn-sm btn-plain no-underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + csv)}`} download="knotten-interessenter.csv">{no ? "Last ned for Excel (CSV)" : "Download for Excel (CSV)"}</a>}
      />
      <form className="flex flex-wrap items-center gap-2" method="get">
        <div className="flex flex-wrap gap-1">
          <Link href="?" className={`chip no-underline ${!status ? "chip-fjord" : ""}`}>{no ? "Alle" : "All"} {store.leads.length}</Link>
          {LEAD_STATUSES.map((s) => <Link key={s} href={`?status=${s}`} className={`chip no-underline ${status === s ? "chip-fjord" : ""}`}>{LEAD_LABEL[s][locale]} {store.leads.filter((x) => x.status === s).length}</Link>)}
        </div>
        {status && <input type="hidden" name="status" value={status} />}
        <input className="input !w-[240px] !py-2 ml-auto" name="q" defaultValue={q} placeholder={no ? "Søk navn, e-post, tomt" : "Search name, email, plot"} aria-label={no ? "Søk" : "Search"} />
        <button className="btn btn-sm btn-plain btn-ghost">{no ? "Søk" : "Search"}</button>
      </form>

      <div className="grid gap-3">
        {leads.length === 0 && <div className="panel p-6 text-muted">{no ? "Ingen treff." : "No matches."}</div>}
        {leads.map((x) => (
          <details key={x.id} className={`panel ${x.excluded ? "opacity-60" : ""}`}>
            <summary className="list-none cursor-pointer p-4 md:p-5 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] items-center">
              <div>
                <div className="font-medium">
                  {x.name || (no ? "Uten navn" : "No name")}
                  {x.source === "eksempel" && <span className="chip chip-amber ml-2">{no ? "eksempel" : "example"}</span>}
                  {x.excluded && <span className="chip ml-2">{no ? "telles ikke" : "not counted"}</span>}
                </div>
                <div className="text-[13.5px] text-muted">{x.email}{x.phone ? `, ${x.phone}` : ""}</div>
              </div>
              <div className="text-[14px]">
                <div>{no ? "Vil " : "Wants to "}{PURPOSE[x.purpose][locale]}</div>
                <div className="text-[13px] text-muted">{x.plots.length ? (no ? "Tomt " : "Plot ") + x.plots.map(plotNo).join(", ") : (no ? "Ingen tomt valgt" : "No plot chosen")}</div>
              </div>
              <div className="text-[13px] text-muted">
                <div>{when(x.created, locale)}</div>
                <div>{x.replied ? (no ? `svart etter ${ago(hours(x.created, x.replied))}` : `answered after ${ago(hours(x.created, x.replied))}`) : x.status === "new" ? (no ? "venter på svar" : "awaiting a reply") : ""}</div>
              </div>
              <span className={`chip justify-self-start md:justify-self-end ${x.status === "new" ? "chip-amber" : x.status === "won" ? "chip-pine" : x.status === "qualified" ? "chip-fjord" : ""}`}>{LEAD_LABEL[x.status][locale]}</span>
            </summary>
            <div className="px-4 md:px-5 pb-5 grid gap-5 md:grid-cols-[1fr_1fr] border-t line pt-4">
              <div className="grid content-start gap-3">
                <form action={setLeadStatus} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={x.id} />
                  <label className="text-[13px] text-muted" htmlFor={`st-${x.id}`}>Status</label>
                  <select key={x.status} id={`st-${x.id}`} name="status" defaultValue={x.status} className="input !py-2 !w-auto !text-[14px]">{LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_LABEL[s][locale]}</option>)}</select>
                  <button className="btn btn-sm btn-plain">{no ? "Lagre" : "Save"}</button>
                </form>
                <div className="text-[13px] text-muted">{no ? "Notater" : "Notes"}</div>
                <div className="grid gap-2 text-[14px]">
                  {x.notes.map((n, i) => <div key={i} className="rounded-[var(--radius)] bg-bg-2/70 p-3"><div className="text-[12px] text-muted">{when(n.at, locale)}, {n.by}</div><div className="whitespace-pre-wrap">{n.text}</div></div>)}
                  {x.notes.length === 0 && <div className="text-muted text-[14px]">{no ? "Ingen notater ennå." : "No notes yet."}</div>}
                </div>
                <form action={addLeadNote} className="flex gap-2">
                  <input type="hidden" name="id" value={x.id} />
                  <input className="input !py-2" name="text" placeholder={no ? "Ring tilbake torsdag, vil se tomt 12" : "Call back Thursday, wants to see plot 12"} aria-label={no ? "Nytt notat" : "New note"} />
                  <button className="btn btn-sm btn-plain">{no ? "Legg til" : "Add"}</button>
                </form>
              </div>
              <div className="grid content-start gap-3 text-[14px]">
                <div><span className="text-muted">{no ? "Kilde: " : "Source: "}</span>{x.source}</div>
                <div><span className="text-muted">{no ? "Samtykke: " : "Consent: "}</span>{[x.consent_updates && (no ? "oppdateringer" : "updates"), x.consent_investor && (no ? "kan kontaktes om investering" : "may be contacted about investing"), x.consent_research && (no ? "anonym statistikk til UiA" : "anonymous statistics to UiA")].filter(Boolean).join(", ")}</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <a className="btn btn-sm btn-ghost btn-plain no-underline" href={`mailto:${x.email}?subject=${encodeURIComponent("Knotten")}`}>{no ? "Send e-post" : "Send email"}</a>
                  {x.phone && <a className="btn btn-sm btn-ghost btn-plain no-underline" href={`tel:${x.phone.replace(/\s/g, "")}`}>{no ? "Ring" : "Call"}</a>}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[13px] mt-1">
                  <form action={toggleExcluded}><input type="hidden" name="id" value={x.id} /><button className="text-ink-2 hover:underline">{x.excluded ? (no ? "Tell med igjen" : "Count again") : (no ? "Ikke en interessent (leverandør, jobbsøker): ikke tell med" : "Not a lead (supplier, job seeker): do not count")}</button></form>
                  <ConfirmButton action={deleteLead} fields={{ id: x.id }} label={no ? "Slett" : "Delete"} question={no ? `Slette ${x.name || x.email} for godt?` : `Delete ${x.name || x.email} for good?`} />
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
          <label className="grid gap-1 text-[13px]">{no ? "Vil" : "Wants to"}<select name="purpose" className="input !py-2">{Object.keys(PURPOSE).map((k) => <option key={k} value={k}>{PURPOSE[k][locale]}</option>)}</select></label>
          <label className="grid gap-1 text-[13px]">{no ? "Tomter (f.eks. 12, 14)" : "Plots (e.g. 12, 14)"}<input className="input !py-2" name="plots" /></label>
          <label className="grid gap-1 text-[13px]">{no ? "Notat" : "Note"}<input className="input !py-2" name="note" /></label>
          <button className="btn btn-sm justify-self-start md:col-span-3">{no ? "Legg til" : "Add"}</button>
        </form>
      </details>
    </>
  );
}
