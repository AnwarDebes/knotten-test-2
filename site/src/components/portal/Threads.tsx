import { isAdmin, type Session } from "@/lib/auth-shared";
import type { Thread, ThreadArea } from "@/lib/server/records";
import { replyThread, setThread, startThread } from "@/app/(moderne)/[locale]/portal/actions";
import { ActionForm, ConfirmButton } from "./forms";
import { when } from "./ui";

const STATUS = { open: { no: "Venter på svar", en: "Awaiting reply" }, answered: { no: "Besvart", en: "Answered" }, closed: { no: "Lukket", en: "Closed" } };

/**
 * Questions and answers inside an area: investors ask the project, the municipality comments on
 * the plan, residents send requests. The asker and the administrators see a thread; an
 * administrator can share an answered question with everyone in the area.
 */
export function Threads({ area, items, session, locale, askTitle, askHint, empty }: { area: ThreadArea; items: Thread[]; session: Session; locale: "no" | "en"; askTitle: string; askHint?: string; empty: string }) {
  const no = locale === "no";
  const admin = isAdmin(session);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] items-start">
      <div className="grid gap-3">
        {items.length === 0 && <div className="panel p-5 text-[14.5px] text-muted">{empty}</div>}
        {items.map((t) => (
          <details key={t.id} className="panel p-0 overflow-hidden group" open={t.status === "open" && admin}>
            <summary className="cursor-pointer list-none p-4 md:p-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-medium flex-1 min-w-[12ch]">{t.subject}</span>
              {t.shared && <span className="chip chip-fjord">{no ? "Delt med alle i området" : "Shared with the area"}</span>}
              <span className={`chip ${t.status === "open" ? "chip-amber" : t.status === "answered" ? "chip-pine" : ""}`}>{STATUS[t.status][locale]}</span>
              <span className="w-full text-[12.5px] text-muted">{t.name}{t.org ? `, ${t.org}` : ""}{t.plot ? ` · ${no ? "tomt" : "plot"} ${Number(t.plot.slice(5))}` : ""} · {when(t.created, locale)} · {t.messages.length} {t.messages.length === 1 ? (no ? "melding" : "message") : (no ? "meldinger" : "messages")}</span>
            </summary>
            <div className="border-t line p-4 md:p-5 grid gap-3 bg-bg/60">
              {t.messages.map((m, i) => (
                <div key={i} className={`rounded-[var(--radius)] p-3.5 text-[14.5px] ${m.staff ? "bg-white border line" : "bg-[rgba(47,102,136,.07)]"}`}>
                  <div className="text-[12.5px] text-muted mb-1">{m.name}{m.staff ? (no ? " (prosjektet)" : " (the project)") : ""} · {when(m.at, locale)}</div>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              ))}
              {(admin || t.uid === session.id) && t.status !== "closed" && (
                <ActionForm action={replyThread} submit={no ? "Send svar" : "Send reply"} className="grid gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="lang" value={locale} />
                  <textarea name="text" rows={3} required className="input !text-[15px]" placeholder={admin ? (no ? "Svar fra prosjektet" : "Reply from the project") : (no ? "Skriv mer" : "Add more")} />
                </ActionForm>
              )}
              {admin && (
                <div className="flex flex-wrap gap-4 text-[13px] pt-1">
                  <form action={setThread}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="op" value="share" /><button className="text-fjord hover:underline">{t.shared ? (no ? "Gjør privat igjen" : "Make private again") : (no ? "Del med alle i området" : "Share with the area")}</button></form>
                  <form action={setThread}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="op" value={t.status === "closed" ? "open" : "close"} /><button className="text-ink-2 hover:underline">{t.status === "closed" ? (no ? "Åpne igjen" : "Reopen") : (no ? "Lukk" : "Close")}</button></form>
                  <ConfirmButton action={setThread} fields={{ id: t.id, op: "delete" }} label={no ? "Slett" : "Delete"} question={no ? "Slette hele tråden?" : "Delete the whole thread?"} />
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
      <div className="panel p-5 md:p-6 grid gap-3">
        <div className="font-medium">{askTitle}</div>
        {askHint && <p className="text-[13.5px] text-muted">{askHint}</p>}
        <ActionForm action={startThread} submit={no ? "Send" : "Send"} className="grid gap-3">
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="lang" value={locale} />
          <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Emne" : "Subject"}</span><input className="input !py-2" name="subject" required maxLength={160} /></label>
          <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Melding" : "Message"}</span><textarea className="input !text-[15px]" name="text" rows={5} required /></label>
        </ActionForm>
      </div>
    </div>
  );
}
