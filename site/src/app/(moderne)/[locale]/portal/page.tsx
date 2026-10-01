import Link from "next/link";
import { AREA_LABEL, ROLE_LABEL, can, isAdmin } from "@/lib/auth";
import type { Area } from "@/lib/auth-shared";
import { portalPage } from "@/lib/server/portal";
import { readStore } from "@/lib/store";
import { loadAuth } from "@/lib/server/accounts";
import { canSeeDoc, canSeeThread, docs, localizeWorkspace, threads, workspace } from "@/lib/server/records";
import { INTERNAL_DOCS } from "@/lib/docRegister";
import { STORAGE } from "@/lib/server/kv";
import { MAIL_ON } from "@/lib/server/mail";
import { FILES_ON } from "@/lib/server/files";
import { readDays, total } from "@/lib/server/stats";
import Icon, { type IconName } from "@/components/portal/Icon";
import { Section, Stat, when } from "@/components/portal/ui";

export const dynamic = "force-dynamic";

const AREA_ICON: Record<Area, IconName> = { investor: "briefcase", resident: "house", energy: "bolt", project: "board", municipality: "landmark", research: "flask" };
const AREA_PATH: Record<Area, string> = { investor: "/investor", resident: "/resident", energy: "/energy", project: "/project", municipality: "/municipality", research: "/research" };

/** The portal's front page: who you are, what you can open, and what has happened since last time. */
export default async function PortalHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, base } = await portalPage(params, "", "any");
  const admin = isAdmin(session);
  const hour = Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", hour12: false }));
  const greet = no ? (hour < 10 ? "God morgen" : hour < 18 ? "God dag" : "God kveld") : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = (session.name || "").split(" ")[0];

  const [store, docState, threadState, ws] = await Promise.all([readStore(), docs.read(), threads.read(), workspace.read().then((w) => localizeWorkspace(w, locale))]);
  const myAreas = (Object.keys(AREA_PATH) as Area[]).filter((a) => can(session, a));
  const latestDocs = docState.docs.filter((d) => canSeeDoc(session, d)).slice(0, 5);
  const openThreads = threadState.threads.filter((t) => canSeeThread(session, t) && t.status === "open");
  const nextMilestones = ws.milestones.filter((m) => m.status !== "done").slice(0, 4);
  const news = store.news.filter((n) => n.published).slice(0, 3);

  // the owner's readiness list: what is still missing before the portal is in real use
  let checklist: { done: boolean; text: string; href?: string }[] = [];
  let figures: React.ReactNode = null;
  if (admin) {
    const auth = await loadAuth();
    const days = await readDays(30);
    const leads = store.leads.filter((l) => !l.excluded && l.source !== "eksempel");
    const waiting = leads.filter((l) => l.status === "new").length;
    const month = new Date().toISOString().slice(0, 7);
    checklist = [
      { done: STORAGE === "kv" || (STORAGE === "file" && !process.env.VERCEL), text: no ? (STORAGE === "temp" ? "Koble til en database (Redis/KV): uten den glemmes endringer når serveren sover" : "Lagring er permanent") : STORAGE === "temp" ? "Connect a database (Redis/KV): without it changes are forgotten when the server sleeps" : "Storage is permanent", href: `${base}/admin/innstillinger` },
      { done: !!process.env.AUTH_SECRET || process.env.NODE_ENV !== "production", text: no ? "Sett AUTH_SECRET i produksjon" : "Set AUTH_SECRET in production", href: `${base}/admin/innstillinger` },
      { done: MAIL_ON, text: no ? "E-post for invitasjoner og varsler (Resend)" : "Email for invitations and alerts (Resend)", href: `${base}/admin/innstillinger` },
      { done: FILES_ON, text: no ? "Fillagring for dokumenter (Vercel Blob)" : "File storage for documents (Vercel Blob)", href: `${base}/admin/innstillinger` },
      { done: auth.accounts.length > 1, text: no ? "Inviter prosjektgruppen, investorer, kommunen og UiA" : "Invite the project group, investors, the municipality and UiA", href: `${base}/admin/brukere` },
      { done: INTERNAL_DOCS.every((r) => docState.docs.some((d) => d.register === r.key)), text: no ? `Last opp dokumentene nettsiden viser til (${INTERNAL_DOCS.filter((r) => docState.docs.some((d) => d.register === r.key)).length} av ${INTERNAL_DOCS.length})` : `Upload the documents the website refers to (${INTERNAL_DOCS.filter((r) => docState.docs.some((d) => d.register === r.key)).length} of ${INTERNAL_DOCS.length})`, href: `${base}/dokumenter#forventet` },
      { done: Object.keys(store.settings.kpi).length > 0, text: no ? "Sett mål for nøkkeltallene (etter to måneder med trafikk)" : "Set targets for the key figures (after two months of traffic)", href: `${base}/admin` },
      { done: !store.leads.some((l) => l.source === "eksempel"), text: no ? "Fjern eksempelinteressentene" : "Remove the example leads", href: `${base}/admin/interessenter` },
    ];
    figures = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={no ? "Venter på svar" : "Awaiting a reply"} value={waiting} sub={no ? "nye interessenter" : "new leads"} tone={waiting ? "warn" : "plain"} href={`${base}/admin/interessenter?status=new`} />
        <Stat label={no ? "Registreringer denne måneden" : "Registrations this month"} value={leads.filter((l) => l.created.startsWith(month)).length} sub={no ? `${leads.length} totalt` : `${leads.length} in total`} href={`${base}/admin`} />
        <Stat label={no ? "Besøkende, 30 dager" : "Visitors, 30 days"} value={total(days, "uv").toLocaleString(no ? "nb-NO" : "en-GB")} sub={no ? `${total(days, "pv").toLocaleString("nb-NO")} sidevisninger` : `${total(days, "pv").toLocaleString("en-GB")} page views`} href={`${base}/admin/statistikk`} />
        <Stat label={no ? "Åpne henvendelser" : "Open questions"} value={openThreads.length} sub={no ? "fra investorer, kommune, beboere" : "from investors, municipality, residents"} tone={openThreads.length ? "warn" : "plain"} />
      </div>
    );
  }
  const left = checklist.filter((c) => !c.done);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label mb-2">{ROLE_LABEL[session.role][locale]}{session.org ? ` · ${session.org}` : ""}</div>
          <h1 className="display text-[32px] md:text-[42px]">{greet}{first ? `, ${first}` : ""}.</h1>
          <p className="mt-2 text-[15.5px] text-ink-2 max-w-[64ch]">
            {admin
              ? (no ? "Her er status for prosjektet og nettsiden. Alt i portalen bygger på de samme dataene som nettsiden viser." : "Here is the state of the project and the website. Everything in the portal builds on the same data the website shows.")
              : (no ? "Her er områdene du har tilgang til, og det som er nytt." : "Here are the areas you have access to, and what is new.")}
          </p>
        </div>
      </div>

      {admin && left.length > 0 && (
        <div className="panel p-5 md:p-6 grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="font-medium">{no ? "Før portalen tas i bruk" : "Before the portal goes into use"} <Link href={`${base}/admin/funksjoner`} className="ml-2 text-[13px] font-normal">{no ? "Se alle funksjoner og status" : "See all features and status"}</Link></div>
            <div className="text-[13px] text-muted">{checklist.length - left.length} {no ? "av" : "of"} {checklist.length} {no ? "på plass" : "done"}</div>
          </div>
          <div className="h-[6px] rounded-full bg-bone/10 overflow-hidden"><div className="h-full bg-pine rounded-full" style={{ width: `${((checklist.length - left.length) / checklist.length) * 100}%` }} /></div>
          <ul className="grid gap-1.5 sm:grid-cols-2 text-[14px] mt-1">
            {checklist.map((c) => (
              <li key={c.text} className="flex items-start gap-2">
                <span className={`mt-[3px] grid place-items-center w-[18px] h-[18px] rounded-full flex-none ${c.done ? "bg-pine text-white" : "border border-[var(--line-strong)]"}`}>{c.done && <Icon name="check" size={12} />}</span>
                {c.href && !c.done ? <Link href={c.href} className="hover:underline">{c.text}</Link> : <span className={c.done ? "text-muted" : ""}>{c.text}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {figures}

      <Section title={no ? "Dine områder" : "Your areas"}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {myAreas.map((a) => (
            <Link key={a} href={`${base}${AREA_PATH[a]}`} className="panel p-5 no-underline flex gap-4 items-start hover:border-fjord transition-colors">
              <span className="grid place-items-center w-10 h-10 rounded-[10px] bg-bg-2 text-fjord flex-none"><Icon name={AREA_ICON[a]} /></span>
              <span><span className="block font-medium">{AREA_LABEL[a][locale]}</span><span className="block text-[13.5px] text-muted mt-0.5">{AREA_LABEL[a].hint[locale]}</span></span>
            </Link>
          ))}
          <Link href={`${base}/dokumenter`} className="panel p-5 no-underline flex gap-4 items-start hover:border-fjord transition-colors">
            <span className="grid place-items-center w-10 h-10 rounded-[10px] bg-bg-2 text-fjord flex-none"><Icon name="folder" /></span>
            <span><span className="block font-medium">{no ? "Dokumenter" : "Documents"}</span><span className="block text-[13.5px] text-muted mt-0.5">{no ? "Alt som er delt med deg, med versjoner" : "Everything shared with you, with versions"}</span></span>
          </Link>
          {myAreas.length === 0 && (
            <div className="panel p-5 text-[14.5px] text-muted sm:col-span-2">{no ? "Kontoen din har ikke fått tilgang til noen områder ennå. Administratoren gir tilgang." : "Your account has not been given any areas yet. The administrator gives access."}</div>
          )}
        </div>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={no ? "Nye dokumenter" : "New documents"} actions={<Link href={`${base}/dokumenter`} className="text-[14px]">{no ? "Alle dokumenter" : "All documents"}</Link>}>
          <div className="panel divide-y divide-[var(--line)]">
            {latestDocs.length === 0 && <p className="p-5 text-[14.5px] text-muted">{no ? "Ingen dokumenter er delt med deg ennå." : "No documents have been shared with you yet."}</p>}
            {latestDocs.map((d) => (
              <a key={d.id} href={`/api/files/${d.id}`} className="flex items-center gap-3 p-4 no-underline hover:bg-bg/60">
                <Icon name="file" className="text-fjord flex-none" />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-[14.5px]">{d.title}</span><span className="block text-[12.5px] text-muted">{when(d.uploaded, locale, false)}{d.version > 1 ? ` · v${d.version}` : ""}</span></span>
                <Icon name="download" size={16} className="text-muted" />
              </a>
            ))}
          </div>
        </Section>
        {can(session, "project") ? (
          <Section title={no ? "Neste milepæler" : "Next milestones"} actions={<Link href={`${base}/project`} className="text-[14px]">{no ? "Prosjektrommet" : "Project room"}</Link>}>
            <div className="panel divide-y divide-[var(--line)]">
              {nextMilestones.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-4 text-[14.5px]">
                  <span className={`w-2.5 h-2.5 rounded-full flex-none ${m.status === "next" ? "bg-amber" : "bg-bone/20"}`} />
                  <span className="flex-1">{m.title}</span>
                  <span className="text-[12.5px] text-muted whitespace-nowrap">{m.date ? when(m.date, locale, false) : m.status === "next" ? (no ? "neste" : "next") : (no ? "senere" : "later")}</span>
                </div>
              ))}
              {nextMilestones.length === 0 && <p className="p-5 text-[14.5px] text-muted">{no ? "Ingen planlagte milepæler." : "No planned milestones."}</p>}
            </div>
          </Section>
        ) : (
          <Section title={no ? "Nytt fra prosjektet" : "News from the project"}>
            <div className="panel divide-y divide-[var(--line)]">
              {news.map((n) => (
                <Link key={n.id} href={`/${locale}/nyheter`} className="block p-4 no-underline hover:bg-bg/60">
                  <span className="block text-[12.5px] text-muted">{when(n.date, locale, false)}</span>
                  <span className="block font-medium text-[14.5px] mt-0.5">{n.title[locale]}</span>
                </Link>
              ))}
            </div>
          </Section>
        )}
      </div>

      {openThreads.length > 0 && (
        <Section title={admin ? (no ? "Henvendelser som venter på svar" : "Questions awaiting a reply") : (no ? "Dine åpne henvendelser" : "Your open questions")}>
          <div className="panel divide-y divide-[var(--line)]">
            {openThreads.slice(0, 6).map((t) => (
              <Link key={t.id} href={`${base}/${t.area === "resident" ? "resident" : t.area}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 no-underline hover:bg-bg/60 text-[14.5px]">
                <Icon name="message" className="text-amber-deep" />
                <span className="flex-1 font-medium">{t.subject}</span>
                <span className="text-[12.5px] text-muted">{t.name} · {AREA_LABEL[t.area][locale]} · {when(t.created, locale)}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
