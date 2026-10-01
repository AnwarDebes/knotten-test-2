import Link from "next/link";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { readDays, sum, total } from "@/lib/server/stats";
import { readJSON } from "@/lib/server/kv";
import NoAccess from "@/components/portal/NoAccess";
import { Bars } from "@/components/portal/charts";
import { Notice, PageHead, Section, Stat } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Besøk på nettsiden", "Website visits");

const PERIODS = [7, 30, 90] as const;
const EVENTS: Record<string, { no: string; en: string }> = {
  form_start: { no: "Begynte på interesseskjemaet", en: "Started the interest form" },
  lead: { no: "Meldte interesse (ny)", en: "Registered interest (new)" },
  lead_repeat: { no: "Meldte interesse på nytt", en: "Registered again" },
  lead_buy: { no: "  vil kjøpe bolig", en: "  want to buy a home" },
  lead_invest: { no: "  vil investere", en: "  want to invest" },
  lead_partner: { no: "  vil samarbeide", en: "  want to partner" },
  lead_curious: { no: "  vil følge med", en: "  want to follow" },
  doc_download: { no: "Dokumenter lastet ned i portalen", en: "Documents downloaded in the portal" },
  dataset_download: { no: "Datasett lastet ned", en: "Datasets downloaded" },
  geo_download: { no: "Kartdata lastet ned", en: "Map data downloaded" },
  login: { no: "Innlogginger i portalen", en: "Portal logins" },
  ask: { no: "Spørsmål til Knotten AI", en: "Questions to Knotten AI" },
};
const TOPIC: Record<string, { no: string; en: string }> = {
  plot: { no: "En bestemt tomt", en: "A particular plot" }, sun: { no: "Sol", en: "Sun" }, view: { no: "Utsikt", en: "View" }, release: { no: "Salg og pris", en: "Sale and price" },
  energy: { no: "Energi", en: "Energy" }, price_now: { no: "Strømprisen nå", en: "The power price now" }, weather: { no: "Været", en: "The weather" }, size: { no: "Antall tomter og areal", en: "Number of plots and area" },
  location: { no: "Beliggenhet", en: "Location" }, road: { no: "Veien", en: "The road" }, trees: { no: "Trær og natur", en: "Trees and nature" }, investor: { no: "Investering", en: "Investing" },
  documents: { no: "Dokumenter", en: "Documents" }, contact: { no: "Kontakt og befaring", en: "Contact and visits" }, news: { no: "Nyheter og status", en: "News and status" },
  greeting: { no: "Hilsen", en: "Greeting" }, thanks: { no: "Takk", en: "Thanks" }, ai: { no: "Svart av språkmodellen", en: "Answered by the language model" }, unknown: { no: "Uten svar", en: "No answer" }, limit: { no: "Stoppet (for mange)", en: "Stopped (too many)" },
};

/** Where readable page names come from: the path, with the two designs told apart. */
function pageName(p: string, no: boolean) {
  const moderne = /^\/(no|en)(\/|$)/.test(p);
  const rest = p.replace(/^\/(no|en)(?=\/|$)/, "") || "/";
  const plot = rest.match(/^\/tomter\/plot-(\d+)/);
  const names: Record<string, [string, string]> = { "/": ["Forsiden", "Front page"], "/tomter": ["Tomtene", "The plots"], "/tomtene": ["Tomtene", "The plots"], "/prosjektet": ["Prosjektet", "The project"], "/energi": ["Energi", "Energy"], "/energi/eksisterende": ["Eksisterende bygg", "Existing buildings"], "/eksisterende-bygg": ["Eksisterende bygg", "Existing buildings"], "/investor": ["Investorer", "Investors"], "/investorer": ["Investorer", "Investors"], "/interesse": ["Meld interesse", "Register interest"], "/kontakt": ["Kontakt", "Contact"], "/dokumenter": ["Dokumenter", "Documents"], "/dokumentbank": ["Dokumentbank", "Document bank"], "/nyheter": ["Nyheter", "News"], "/utsikt": ["Utsikten", "The view"], "/omradet": ["Området", "The area"], "/kart": ["Kart", "Map"], "/galleri": ["Galleri", "Gallery"], "/personvern": ["Personvern", "Privacy"], "/kilder": ["Kilder", "Sources"] };
  const base = plot ? `${no ? "Tomt" : "Plot"} ${Number(plot[1])}` : names[rest]?.[no ? 0 : 1] ?? rest;
  return `${base}${moderne ? (p.startsWith("/en") ? " (moderne, engelsk)" : " (moderne)") : ""}`;
}

/** Visits to the public website, counted without cookies (lib/server/stats.ts). */
export default async function Visits({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ periode?: string }> }) {
  const { locale, no, session, ok, base } = await portalPage(params, "/admin/statistikk", "admin");
  if (!ok) return <NoAccess locale={locale} session={session} area="admin" />;
  const { periode } = await searchParams;
  const period = PERIODS.find((p) => String(p) === periode) ?? 30;
  const days = await readDays(period);
  const nf = (v: number, d = 0) => v.toLocaleString(no ? "nb-NO" : "en-GB", { maximumFractionDigits: d });
  const uv = total(days, "uv"), pv = total(days, "pv"), visits = total(days, "visits");
  const pages = Object.entries(sum(days, "p:")).sort((a, b) => b[1] - a[1]);
  const refs = Object.entries(sum(days, "r:")).sort((a, b) => b[1] - a[1]);
  const devices = sum(days, "d:"), designs = sum(days, "s:"), events = sum(days, "e:");
  const topics = Object.entries(events).filter(([k]) => k.startsWith("ask_")).map(([k, n]) => [k.slice(4), n] as const).sort((a, b) => b[1] - a[1]);
  const asked = ((await readJSON<{ asked: { at: string; q: string; lang: string; source: string }[] }>("asked"))?.asked ?? []).slice(0, 15);
  const mobile = (devices.mobil ?? 0) / Math.max(1, (devices.mobil ?? 0) + (devices.pc ?? 0));
  const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(no ? "nb-NO" : "en-GB", { day: "numeric", month: "short" });
  return (
    <>
      <PageHead
        eyebrow={no ? "Administrasjon" : "Administration"}
        title={no ? "Besøk på nettsiden" : "Website visits"}
        lede={no ? "Hvor mange som besøker nettsiden, hva de ser på, og hvor de kommer fra. Begge utseendene telles sammen." : "How many visit the website, what they look at, and where they come from. Both designs are counted together."}
        actions={<div className="seg">{PERIODS.map((p) => <Link key={p} href={`?periode=${p}`} aria-current={p === period ? "true" : undefined} className={`!no-underline px-3 py-1.5 rounded-full text-[13.5px] font-medium ${p === period ? "bg-ink text-white" : "text-ink-2"}`}>{p} {no ? "dager" : "days"}</Link>)}</div>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={no ? "Besøkende" : "Visitors"} value={nf(uv)} sub={no ? "unike per dag, summert" : "unique per day, summed"} />
        <Stat label={no ? "Sidevisninger" : "Page views"} value={nf(pv)} sub={visits ? (no ? `${nf(pv / visits, 1)} sider per besøk` : `${nf(pv / visits, 1)} pages per visit`) : undefined} />
        <Stat label={no ? "Besøk" : "Visits"} value={nf(visits)} sub={no ? "inngang fra en annen side eller direkte" : "entries from another site or direct"} />
        <Stat label={no ? "På mobil" : "On a phone"} value={`${nf(mobile * 100)} %`} sub={no ? `${nf(designs.klassisk ?? 0)} visninger i klassisk, ${nf(designs.moderne ?? 0)} i moderne` : `${nf(designs.klassisk ?? 0)} views in classic, ${nf(designs.moderne ?? 0)} in modern`} />
      </div>
      {pv === 0 && <Notice>{no ? "Ingen besøk telt ennå i perioden. Tellingen starter når nettsiden får besøk; egne besøk mens du er logget inn, telles ikke." : "No visits counted in the period yet. Counting starts when the website gets visits; your own visits while logged in are not counted."}</Notice>}
      <Section title={no ? "Besøkende per dag" : "Visitors per day"}>
        <div className="panel p-4 md:p-5"><Bars data={days.map((d) => ({ label: dayLabel(d.date), value: d.c.uv ?? 0, title: `${dayLabel(d.date)}: ${d.c.uv ?? 0} ${no ? "besøkende" : "visitors"}, ${d.c.pv ?? 0} ${no ? "visninger" : "views"}` }))} every={period > 30 ? 14 : period > 7 ? 5 : 1} ariaLabel={no ? "Besøkende per dag" : "Visitors per day"} /></div>
      </Section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={no ? "Mest besøkte sider" : "Most visited pages"}>
          <div className="panel scroll-x">
            <table className="table table-tight">
              <thead><tr><th>{no ? "Side" : "Page"}</th><th className="n">{no ? "Visninger" : "Views"}</th></tr></thead>
              <tbody>
                {pages.slice(0, 15).map(([p, n]) => <tr key={p}><td><a href={p} target="_blank" rel="noreferrer" className="no-underline hover:underline">{pageName(p, no)}</a></td><td className="n">{nf(n)}</td></tr>)}
                {pages.length === 0 && <tr><td colSpan={2} className="text-muted">{no ? "Ingen ennå." : "None yet."}</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title={no ? "Hvor besøkene kommer fra" : "Where visits come from"}>
          <div className="panel scroll-x">
            <table className="table table-tight">
              <thead><tr><th>{no ? "Kilde" : "Source"}</th><th className="n">{no ? "Besøk" : "Visits"}</th></tr></thead>
              <tbody>
                {refs.slice(0, 15).map(([r, n]) => <tr key={r}><td>{r === "direkte" ? (no ? "Direkte, bokmerke eller app" : "Direct, bookmark or app") : r}</td><td className="n">{nf(n)}</td></tr>)}
                {refs.length === 0 && <tr><td colSpan={2} className="text-muted">{no ? "Ingen ennå." : "None yet."}</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
      <Section title={no ? "Hendelser" : "Events"} sub={no ? "Det som teller mot målene: skjema, registreringer og nedlastinger." : "What counts towards the goals: forms, registrations and downloads."}>
        <div className="panel scroll-x">
          <table className="table table-tight">
            <tbody>
              {Object.keys(EVENTS).filter((k) => events[k] || !k.startsWith("lead_")).map((k) => <tr key={k}><td className={EVENTS[k][locale].startsWith("  ") ? "pl-6 text-muted" : ""}>{EVENTS[k][locale].trim()}</td><td className="n">{nf(events[k] ?? 0)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title={no ? "Spørsmål til Knotten AI" : "Questions to Knotten AI"} sub={no ? "Hva besøkende spør om, og spørsmålene den ikke hadde svar på. Det er gode ideer til hva nettsiden bør forklare bedre." : "What visitors ask about, and the questions it had no answer to. Good ideas for what the website should explain better."}>
        <div className="grid gap-4 xl:grid-cols-2 items-start">
          <div className="panel scroll-x">
            <table className="table table-tight">
              <thead><tr><th>{no ? "Tema" : "Topic"}</th><th className="n">{no ? "Spørsmål" : "Questions"}</th></tr></thead>
              <tbody>
                {topics.map(([k, n]) => <tr key={k}><td>{TOPIC[k]?.[locale] ?? k}</td><td className="n">{nf(n)}</td></tr>)}
                {topics.length === 0 && <tr><td colSpan={2} className="text-muted">{no ? "Ingen spørsmål i perioden." : "No questions in the period."}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="panel divide-y divide-[var(--line)]">
            <div className="p-4 text-[13.5px] font-medium">{no ? "Uten svar fra dataene (siste 15)" : "Without an answer from the data (last 15)"}</div>
            {asked.map((a, i) => <div key={i} className="p-4 text-[14px] grid gap-0.5"><span>«{a.q}»</span><span className="text-[12px] text-muted">{a.at.slice(0, 10)} · {a.source === "ai" ? (no ? "besvart av språkmodellen" : "answered by the language model") : (no ? "ikke besvart" : "not answered")}</span></div>)}
            {asked.length === 0 && <p className="p-4 text-[14px] text-muted">{no ? "Ingen ennå." : "None yet."}</p>}
          </div>
        </div>
      </Section>
      <Section title={no ? "Slik telles det" : "How it is counted"}>
        <div className="panel p-5 text-[14.5px] text-ink-2 grid gap-2 max-w-[90ch]">
          <p>{no ? "Uten informasjonskapsler og uten å lagre IP-adresser. En besøkende kjennes igjen samme dag med en enveiskode av dagens dato, adressen og nettleseren; koden byttes hver dag og kan ikke spores tilbake. Det som lagres, er antall per dag." : "Without cookies and without storing IP addresses. A visitor is recognised within one day by a one-way code of the date, the address and the browser; the code changes daily and cannot be traced back. What is stored is counts per day."}</p>
          <p>{no ? "Roboter, nettlesere som ber om å ikke bli sporet, og innloggede brukere telles ikke. Personvernerklæringen på nettsiden sier det samme." : "Robots, browsers that ask not to be tracked, and logged-in users are not counted. The privacy statement on the website says the same."}</p>
          <p><Link href={`${base}/admin`}>{no ? "Til nøkkeltallene" : "To the key figures"}</Link></p>
        </div>
      </Section>
    </>
  );
}
