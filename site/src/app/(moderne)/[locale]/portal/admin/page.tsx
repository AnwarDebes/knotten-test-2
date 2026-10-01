import { Fragment } from "react";
import Link from "next/link";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { readStore, LEAD_LABEL, LEAD_STATUSES, type KpiTargets } from "@/lib/store";
import { loadAuth } from "@/lib/server/accounts";
import { docs, threads } from "@/lib/server/records";
import { readDays, total } from "@/lib/server/stats";
import { nowMs } from "@/lib/server/live";
import { loadPlots } from "@/lib/data";
import { plotName } from "@/lib/format";
import { removeExamples, saveTargets } from "./actions";
import NoAccess from "@/components/portal/NoAccess";
import { Bars, Spark } from "@/components/portal/charts";
import { Notice, PageHead, Section, when } from "@/components/portal/ui";
import { logText } from "@/lib/logText";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Nøkkeltall", "Key figures");

const PERIODS = [30, 90, 365] as const;

/**
 * The owner's key figures: the business success criteria the project owner asked for
 * (registrations, conversion, investor interest, website engagement, stakeholder participation)
 * and the measures in the website plan (reply time, form completion). Targets are set by the
 * owner after two months of real traffic; until then the page shows the measured values.
 */
export default async function KeyFigures({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ periode?: string }> }) {
  const { locale, no, session, ok, base } = await portalPage(params, "/admin", "admin");
  if (!ok) return <NoAccess locale={locale} session={session} area="admin" />;
  const { periode } = await searchParams;
  const period = PERIODS.find((p) => String(p) === periode) ?? 30;
  const now = nowMs();
  const since = now - period * 86400e3;
  const [store, auth, days, docState, threadState, { plots }] = await Promise.all([readStore(), loadAuth(), readDays(period), docs.read(), threads.read(), loadPlots()]);
  const t: KpiTargets = store.settings.kpi;
  const nf = (v: number, d = 0) => v.toLocaleString(no ? "nb-NO" : "en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  const perMonth = (v: number) => (v * 30) / period;

  const real = store.leads.filter((l) => !l.excluded && l.source !== "eksempel");
  const inPeriod = real.filter((l) => Date.parse(l.created) >= since);
  const fromWeb = inPeriod.filter((l) => l.source.startsWith("web"));
  const visitors = total(days, "uv"), views = total(days, "pv"), visits = total(days, "visits");
  const formStarts = total(days, "e:form_start"), webLeads = total(days, "e:lead");
  const conversion = visitors ? (fromWeb.length / visitors) * 100 : null;
  const completion = formStarts ? Math.min(100, (webLeads / formStarts) * 100) : null;
  const investorLeads = inPeriod.filter((l) => l.purpose === "invest" || l.consent_investor);
  const conversations = real.filter((l) => (l.purpose === "invest" || l.purpose === "partner") && l.status !== "new" && l.status !== "lost");
  const replyHours = real.filter((l) => l.replied && Date.parse(l.created) >= since).map((l) => (Date.parse(l.replied!) - Date.parse(l.created)) / 3600e3).sort((a, b) => a - b);
  const medianReply = replyHours.length ? replyHours[Math.floor(replyHours.length / 2)] : null;
  const waiting = real.filter((l) => l.status === "new");
  const oldestWait = waiting.length ? Math.max(...waiting.map((l) => (now - Date.parse(l.created)) / 3600e3)) : 0;
  const users = auth.accounts.filter((a) => a.role === "user");
  const active = users.filter((a) => a.status === "active" && a.last_login && Date.parse(a.last_login) >= since);
  const posts = threadState.threads.reduce((a, th) => a + th.messages.filter((m) => !m.staff && Date.parse(m.at) >= since).length, 0);
  const downloads = docState.log.filter((l) => Date.parse(l.at) >= since).length;
  const pipeline = LEAD_STATUSES.map((s) => ({ s, n: real.filter((l) => l.status === s).length }));
  const wanted = Object.entries(real.flatMap((x) => x.plots).reduce<Record<string, number>>((a, id) => { a[id] = (a[id] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const examples = store.leads.filter((x) => x.source === "eksempel").length;
  const weeks = Math.min(13, Math.ceil(period / 7));
  const weekly: number[] = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * 86400e3, start = end - 7 * 86400e3;
    return real.filter((l) => { const c = Date.parse(l.created); return c >= start && c < end; }).length;
  });

  const target = (value: number | null, goal: number | undefined, unit: string, lowerIsBetter = false) => {
    if (goal === undefined) return { pct: null, text: no ? "Mål ikke satt" : "No target set" };
    if (value === null) return { pct: null, text: no ? `Mål: ${nf(goal, unit === "%" ? 1 : 0)} ${unit}` : `Target: ${nf(goal, unit === "%" ? 1 : 0)} ${unit}` };
    const pct = lowerIsBetter ? (value <= goal ? 100 : (goal / value) * 100) : (value / goal) * 100;
    return { pct, text: no ? `Mål: ${nf(goal, unit === "%" ? 1 : 0)} ${unit} (${nf(Math.min(999, pct))} %)` : `Target: ${nf(goal, unit === "%" ? 1 : 0)} ${unit} (${nf(Math.min(999, pct))} %)` };
  };
  const card = (label: string, value: string, sub: string, tgt?: { pct: number | null; text: string }, spark?: number[], href?: string) => (
    <div className="panel p-5 grid content-start gap-1.5">
      <div className="flex items-baseline justify-between gap-2"><span className="text-[13.5px] text-muted">{label}</span>{href && <Link href={href} className="text-[12.5px]">{no ? "Detaljer" : "Details"}</Link>}</div>
      <div className="num text-[34px] mt-1">{value}</div>
      <div className="text-[13px] text-muted">{sub}</div>
      {spark && spark.length > 1 && <div className="mt-1"><Spark values={spark} height={34} /></div>}
      {tgt && (
        <div className="mt-2">
          {tgt.pct !== null && <div className="h-[6px] rounded-full bg-bone/10 overflow-hidden"><div className={`h-full rounded-full ${tgt.pct >= 100 ? "bg-pine" : "bg-fjord"}`} style={{ width: `${Math.min(100, tgt.pct)}%` }} /></div>}
          <div className="text-[12.5px] text-muted mt-1.5">{tgt.text}</div>
        </div>
      )}
    </div>
  );

  const criteria = [
    {
      title: no ? "1. Interesseregistreringer" : "1. Interest registrations",
      cards: [
        card(no ? "Nye registreringer" : "New registrations", nf(inPeriod.length), no ? `${nf(perMonth(inPeriod.length), 1)} per måned, ${real.length} totalt` : `${nf(perMonth(inPeriod.length), 1)} a month, ${real.length} in total`, target(perMonth(inPeriod.length), t.registrations_month, no ? "per måned" : "a month"), weekly, `${base}/admin/interessenter`),
        card(no ? "Vil kjøpe bolig" : "Want to buy a home", nf(inPeriod.filter((l) => l.purpose === "buy").length), no ? `${inPeriod.filter((l) => l.purpose === "partner").length} samarbeid, ${inPeriod.filter((l) => l.purpose === "curious").length} følger med` : `${inPeriod.filter((l) => l.purpose === "partner").length} partners, ${inPeriod.filter((l) => l.purpose === "curious").length} following`),
      ],
    },
    {
      title: no ? "2. Konvertering" : "2. Conversion",
      cards: [
        card(no ? "Besøkende som registrerer seg" : "Visitors who register", conversion === null ? "…" : `${nf(conversion, 1)} %`, no ? `${fromWeb.length} fra nettsiden av ${nf(visitors)} besøkende` : `${fromWeb.length} from the website of ${nf(visitors)} visitors`, target(conversion, t.conversion_pct, "%")),
        card(no ? "Fullfører skjemaet" : "Finish the form", completion === null ? "…" : `${nf(completion)} %`, no ? `${webLeads} sendt av ${formStarts} påbegynt` : `${webLeads} sent of ${formStarts} started`, target(completion, t.form_completion_pct, "%")),
      ],
    },
    {
      title: no ? "3. Investorinteresse" : "3. Investor interest",
      cards: [
        card(no ? "Investorhenvendelser" : "Investor enquiries", nf(investorLeads.length), no ? `i perioden; ${threadState.threads.filter((x) => x.area === "investor" && Date.parse(x.created) >= since).length} spørsmål i datarommet` : `in the period; ${threadState.threads.filter((x) => x.area === "investor" && Date.parse(x.created) >= since).length} questions in the data room`),
        card(no ? "Samtaler startet fra nettsiden" : "Conversations started from the site", nf(conversations.length), no ? "investorer og partnere som er kontaktet eller har møte" : "investors and partners contacted or with a meeting", target(conversations.length, t.investor_conversations, "")),
      ],
    },
    {
      title: no ? "4. Engasjement på nettsiden" : "4. Website engagement",
      cards: [
        card(no ? "Besøkende" : "Visitors", nf(visitors), no ? `${nf(perMonth(visitors))} per måned, ${nf(views)} sidevisninger` : `${nf(perMonth(visitors))} a month, ${nf(views)} page views`, target(perMonth(visitors), t.visitors_month, no ? "per måned" : "a month"), days.map((d) => d.c.uv ?? 0), `${base}/admin/statistikk`),
        card(no ? "Sider per besøk" : "Pages per visit", visits ? nf(views / visits, 1) : "…", no ? `${nf(visits)} besøk` : `${nf(visits)} visits`),
      ],
    },
    {
      title: no ? "5. Deltakelse fra interessenter" : "5. Stakeholder participation",
      cards: [
        card(no ? "Aktive i portalen" : "Active in the portal", nf(active.length), no ? `av ${users.length} inviterte brukere, logget inn i perioden` : `of ${users.length} invited users, logged in during the period`, target(active.length, t.active_stakeholders, no ? "personer" : "people"), undefined, `${base}/admin/brukere`),
        card(no ? "Innspill og nedlastinger" : "Input and downloads", nf(posts), no ? `meldinger fra interessenter; ${downloads} dokumenter lastet ned` : `messages from stakeholders; ${downloads} documents downloaded`),
      ],
    },
  ];

  return (
    <>
      <PageHead
        eyebrow={no ? "Administrasjon" : "Administration"}
        title={no ? "Nøkkeltall" : "Key figures"}
        lede={no ? "Forretningsmålene prosjekteier ba om, målt fra nettsiden og portalen: registreringer, konvertering, investorinteresse, engasjement og deltakelse." : "The business goals the project owner asked for, measured from the website and the portal: registrations, conversion, investor interest, engagement and participation."}
        actions={<div className="seg">{PERIODS.map((p) => <Link key={p} href={`?periode=${p}`} aria-current={p === period ? "true" : undefined} className={`!no-underline px-3 py-1.5 rounded-full text-[13.5px] font-medium ${p === period ? "bg-ink text-white" : "text-ink-2"}`}>{p === 365 ? (no ? "12 mnd" : "12 mo") : `${p} ${no ? "dager" : "days"}`}</Link>)}</div>}
      />
      {Object.keys(t).length === 0 && <Notice>{no ? "Målene er ikke satt ennå. Nettstedsplanen setter mål etter to måneder med reell trafikk, fordi det ikke finnes grunnlag før det. Tallene under måles fra første dag." : "The targets are not set yet. The website plan sets targets after two months of real traffic, since there is no basis before that. The figures below are measured from day one."}</Notice>}
      {examples > 0 && (
        <form action={removeExamples} className="panel p-4 flex flex-wrap items-center gap-3 text-[14px]">
          <span className="w-2 h-2 rounded-full bg-amber" />
          <span>{no ? `${examples} eksempelinteressenter ligger i listen for å vise hvordan den virker. De telles ikke med her.` : `${examples} example leads are in the list to show how it works. They are not counted here.`}</span>
          <button className="btn btn-sm btn-plain btn-ghost ml-auto">{no ? "Fjern eksemplene" : "Remove the examples"}</button>
        </form>
      )}

      {criteria.map((c) => (
        <Section key={c.title} title={c.title}>
          <div className="grid gap-4 sm:grid-cols-2">{c.cards.map((el, i) => <Fragment key={i}>{el}</Fragment>)}</div>
        </Section>
      ))}

      <Section title={no ? "Svartid" : "Reply time"} sub={no ? "Tid fra noen melder interesse til en person i prosjektet svarer: et av målene i nettstedsplanen." : "Time from someone registering interest to a person in the project replying: one of the measures in the website plan."}>
        <div className="grid gap-4 sm:grid-cols-2">
          {card(no ? "Median svartid" : "Median reply time", medianReply === null ? "…" : medianReply < 48 ? `${nf(medianReply)} t` : `${nf(medianReply / 24, 1)} d`, no ? `${replyHours.length} besvart i perioden` : `${replyHours.length} answered in the period`, target(medianReply, t.reply_hours, no ? "timer" : "hours", true))}
          {card(no ? "Venter nå" : "Waiting now", nf(waiting.length), waiting.length ? (no ? `den eldste har ventet ${oldestWait < 48 ? `${nf(oldestWait)} timer` : `${nf(oldestWait / 24)} dager`}` : `the oldest has waited ${oldestWait < 48 ? `${nf(oldestWait)} hours` : `${nf(oldestWait / 24)} days`}`) : (no ? "ingen venter" : "nobody is waiting"), undefined, undefined, `${base}/admin/interessenter?status=new`)}
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Section title={no ? "Hvor interessentene står" : "Where the leads stand"} actions={<Link href={`${base}/admin/interessenter`} className="text-[14px]">{no ? "Alle interessenter" : "All leads"}</Link>}>
          <div className="panel p-5 grid gap-3">
            {pipeline.map(({ s, n }) => (
              <Link key={s} href={`${base}/admin/interessenter?status=${s}`} className="grid grid-cols-[150px_1fr_40px] items-center gap-3 text-[14px] no-underline hover:text-fjord">
                <span>{LEAD_LABEL[s][locale]}</span>
                <div className="h-[10px] rounded-full bg-bone/10 overflow-hidden"><div className={`h-full rounded-full ${s === "won" ? "bg-pine" : s === "lost" ? "bg-bone/30" : "bg-fjord"}`} style={{ width: `${(n / Math.max(1, real.length)) * 100}%` }} /></div>
                <span className="num text-[18px] text-right">{n}</span>
              </Link>
            ))}
            <p className="text-[12.5px] text-muted">{no ? "Konverteringstrappen: registrert, kontaktet, møte avtalt, reservert eller solgt (markedsplanens mål)." : "The conversion steps: registered, contacted, meeting set, reserved or sold (the market plan's measure)."}</p>
          </div>
        </Section>
        <Section title={no ? "Tomtene folk spør etter" : "The plots people ask for"}>
          <div className="panel p-5">
            {wanted.length === 0 ? <p className="text-[14px] text-muted">{no ? "Vises når noen har krysset av for tomter i skjemaet." : "Shown once someone ticks plots in the form."}</p> : (
              <div className="grid gap-2.5">
                {wanted.map(([id, n]) => (
                  <div key={id} className="grid grid-cols-[72px_1fr_32px] items-center gap-3 text-[14px]">
                    <Link href={`/${locale}/tomter/${id}`}>{plotName(id, no)}</Link>
                    <div className="h-[8px] rounded-full bg-bone/10 overflow-hidden"><div className="h-full bg-amber rounded-full" style={{ width: `${(n / wanted[0][1]) * 100}%` }} /></div>
                    <div className="num text-[18px] text-right">{n}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[12.5px] text-muted mt-4">{plots.length} {no ? "tomter i utlegget" : "plots in the layout"}</p>
          </div>
        </Section>
      </div>

      <Section title={no ? "Siste hendelser" : "Recent activity"}>
        <div className="panel divide-y divide-[var(--line)]">
          {store.activity.slice(0, 10).map((a, i) => (
            <div key={i} className="grid sm:grid-cols-[170px_1fr] gap-x-4 gap-y-0.5 p-3.5 text-[14px]">
              <span className="text-muted whitespace-nowrap">{when(a.at, locale)}</span>
              <span><span className="text-muted">{logText(a.by, locale)}: </span>{logText(a.what, locale)}</span>
            </div>
          ))}
          {store.activity.length === 0 && <p className="p-5 text-muted text-[14px]">{no ? "Alt som endres i administrasjonen logges her." : "Everything changed in the administration is logged here."}</p>}
        </div>
      </Section>

      <Section title={no ? "Mål" : "Targets"} sub={no ? "La et felt stå tomt for «ikke satt». Mål per måned sammenlignes med snittet i valgt periode." : "Leave a field empty for \"not set\". Monthly targets are compared with the average over the chosen period."}>
        <form action={saveTargets} className="panel p-5 md:p-6 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {([
              ["registrations_month", no ? "Registreringer per måned" : "Registrations a month"],
              ["conversion_pct", no ? "Konvertering, % av besøkende" : "Conversion, % of visitors"],
              ["form_completion_pct", no ? "Fullfører skjemaet, %" : "Finish the form, %"],
              ["investor_conversations", no ? "Investor- og partnersamtaler" : "Investor and partner conversations"],
              ["visitors_month", no ? "Besøkende per måned" : "Visitors a month"],
              ["active_stakeholders", no ? "Aktive interessenter i portalen" : "Active stakeholders in the portal"],
              ["reply_hours", no ? "Svartid, timer (høyst)" : "Reply time, hours (at most)"],
            ] as const).map(([k, label]) => (
              <label key={k} className="grid gap-1.5 text-[13.5px]"><span className="text-ink-2 font-medium">{label}</span><input name={k} inputMode="decimal" defaultValue={t[k] ?? ""} className="input !py-2" placeholder={no ? "ikke satt" : "not set"} /></label>
            ))}
          </div>
          <button className="btn btn-sm justify-self-start">{no ? "Lagre målene" : "Save the targets"}</button>
        </form>
      </Section>

      <Section title={no ? "Registreringer per uke" : "Registrations per week"}>
        <div className="panel p-4 md:p-5"><Bars data={weekly.map((v, i) => ({ label: `${i - weekly.length + 1}`, value: v, title: no ? `${weekly.length - 1 - i} uker siden: ${v}` : `${weekly.length - 1 - i} weeks ago: ${v}` }))} unit="" ariaLabel={no ? "Registreringer per uke" : "Registrations per week"} /><div className="provenance mt-1">{no ? "Uker bakover fra i dag (0 er siste sju dager)." : "Weeks back from today (0 is the last seven days)."}</div></div>
      </Section>
    </>
  );
}
