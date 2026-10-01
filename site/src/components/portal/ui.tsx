import Link from "next/link";
import Icon, { type IconName } from "./Icon";

/**
 * The building blocks every portal page shares, so the pages read as one application: a page
 * heading, figure tiles, section headings, empty states and the "waiting for data" notice.
 */
export function PageHead({ eyebrow, title, lede, actions }: { eyebrow?: string; title: string; lede?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 max-w-[72ch]">
        {eyebrow && <div className="label mb-2">{eyebrow}</div>}
        <h1 className="display text-[30px] md:text-[38px]">{title}</h1>
        {lede && <p className="mt-3 text-[15.5px] text-ink-2 leading-relaxed">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, sub, actions, children, id }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="grid gap-4 content-start" id={id}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 className="display text-[22px] md:text-[24px]">{title}</h2>
          {sub && <p className="mt-1 text-[14px] text-muted max-w-[80ch]">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone, href, target }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "warn" | "plain"; href?: string; target?: { pct: number | null; text: string } }) {
  const body = (
    <>
      <div className="text-[13.5px] text-muted">{label}</div>
      <div className={`num text-[34px] mt-2 ${tone === "warn" ? "text-amber-deep" : tone === "good" ? "text-pine" : ""}`}>{value}</div>
      {sub && <div className="text-[13px] text-muted mt-1.5">{sub}</div>}
      {target && (
        <div className="mt-3">
          {target.pct !== null && (
            <div className="h-[6px] rounded-full bg-bone/10 overflow-hidden"><div className={`h-full rounded-full ${target.pct >= 100 ? "bg-pine" : "bg-fjord"}`} style={{ width: `${Math.min(100, target.pct)}%` }} /></div>
          )}
          <div className="text-[12.5px] text-muted mt-1.5">{target.text}</div>
        </div>
      )}
    </>
  );
  return href ? <Link href={href} className="panel p-5 no-underline block hover:border-fjord transition-colors">{body}</Link> : <div className="panel p-5">{body}</div>;
}

export function Empty({ icon = "file", title, children, action }: { icon?: IconName; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="panel p-6 md:p-8 grid justify-items-start gap-3">
      <span className="grid place-items-center w-10 h-10 rounded-full bg-bg-2 text-fjord"><Icon name={icon} /></span>
      <div className="font-medium">{title}</div>
      {children && <div className="text-[14.5px] text-muted max-w-[64ch]">{children}</div>}
      {action}
    </div>
  );
}

/** For a function that is built but has no real data yet: says plainly what is missing and what it takes. */
export function Waiting({ title, children, needs, no = true }: { title: string; children?: React.ReactNode; needs?: string[]; no?: boolean }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] bg-white/60 p-5 md:p-6 grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip chip-amber">{no ? "Venter på data" : "Waiting for data"}</span>
        <span className="font-medium">{title}</span>
      </div>
      {children && <div className="text-[14.5px] text-ink-2 max-w-[80ch]">{children}</div>}
      {needs && needs.length > 0 && (
        <div className="grid gap-1.5 text-[14px]">
          <div className="text-muted">{no ? "Det som trengs:" : "What it takes:"}</div>
          <ul className="grid gap-1">
            {needs.map((n) => <li key={n} className="flex gap-2"><span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-amber flex-none" />{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A notice line: info (fjord), success (pine) or warning (amber). */
export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "warn"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-[rgba(79,113,86,.1)] text-[#2f4f38]" : tone === "warn" ? "bg-[rgba(226,162,59,.16)] text-[#6b4710]" : "bg-[rgba(47,102,136,.08)] text-ink-2";
  return <div className={`rounded-[var(--radius)] px-4 py-3 text-[14px] ${cls}`} role={tone === "warn" ? "alert" : undefined}>{children}</div>;
}

export function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`grid gap-1.5 text-[13.5px] ${className}`}>
      <span className="text-ink-2 font-medium">{label}</span>
      {children}
      {hint && <span className="text-[12.5px] text-muted">{hint}</span>}
    </label>
  );
}

/** Dates and times for people in Norway, whatever the server's clock is set to. */
export function when(iso: string | undefined, locale: "no" | "en", withTime = true) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "no" ? "nb-NO" : "en-GB", { timeZone: "Europe/Oslo", day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

export function initials(name: string, email: string) {
  const parts = (name || email).replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
