import { promises as fs } from "fs";
import path from "path";
import { isAdmin } from "@/lib/auth";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { DATASETS } from "@/lib/datasets";
import { readCounters } from "@/lib/server/kv";
import { canSeeDoc, canSeeThread, docs, threads } from "@/lib/server/records";
import { prettySize } from "@/lib/server/files";
import { CONTACT } from "@/lib/facts";
import NoAccess from "@/components/portal/NoAccess";
import { DocList, UploadForm } from "@/components/portal/Docs";
import { Threads } from "@/components/portal/Threads";
import Icon from "@/components/portal/Icon";
import { PageHead, Section, Waiting } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Forskning", "Research");

/**
 * The research room for the University of Agder: the datasets behind the website with licence,
 * fields and citation, counted downloads, research documents and a channel to the project.
 * Meter series and API keys wait until there are meters and consents to share.
 */
export default async function Research({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/research", "research");
  if (!ok) return <NoAccess locale={locale} session={session} area="research" />;
  const [counts, docState, threadState, sizes] = await Promise.all([
    readCounters("datasets").catch(() => ({} as Record<string, number>)),
    docs.read(),
    threads.read(),
    Promise.all(DATASETS.map((d) => fs.stat(path.join(process.cwd(), "public", "data", d.file)).then((s) => s.size).catch(() => 0))),
  ]);
  const resDocs = docState.docs.filter((d) => canSeeDoc(session, d) && (d.audience.includes("research") || d.audience.includes("all")));
  const talk = threadState.threads.filter((t) => t.area === "research" && canSeeThread(session, t));
  const year = 2026; // the model and the datasets were made in 2026
  return (
    <>
      <PageHead
        eyebrow={no ? "Universitetet i Agder" : "University of Agder"}
        title={no ? "Forskningsrommet" : "Research room"}
        lede={no ? "Dataene nettsiden er bygget på, med lisens, felter og sitering, klare for studentarbeid og forskning. Målerserier fra boligene kommer når det finnes målere og samtykker." : "The data the website is built on, with licence, fields and citation, ready for student work and research. Meter series from the homes come when there are meters and consents."}
      />
      <Section title={no ? "Datasett" : "Datasets"} sub={no ? `Avledet av Kartverkets åpne data (CC BY 4.0) i nettsidens modell. Sitér som: «Knotten digital tvilling, ${CONTACT.company} og Universitetet i Agder, ${year}».` : `Derived from Kartverket's open data (CC BY 4.0) in the website's model. Cite as: "Knotten digital twin, ${CONTACT.company} and the University of Agder, ${year}".`}>
        <div className="grid gap-3 md:grid-cols-2">
          {DATASETS.map((d, i) => (
            <div key={d.file} className="panel p-5 grid content-start gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{d.title[locale]}</span>
                <span className="text-[12.5px] text-muted">{d.file} · {prettySize(sizes[i], no)} · {d.licence}</span>
              </div>
              <p className="text-[14.5px] text-ink-2">{d.contents[locale]}</p>
              <code className="text-[12px] text-muted break-all">{d.fields}</code>
              <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
                <a className="btn btn-sm btn-ghost btn-plain no-underline" href={`/api/datasett/${d.file}`}><Icon name="download" size={16} />{no ? "Last ned" : "Download"}</a>
                {isAdmin(session) && <span className="text-[12.5px] text-muted">{counts[d.file] ?? 0} {no ? "nedlastinger" : "downloads"}</span>}
              </div>
            </div>
          ))}
          <div className="panel p-5 grid content-start gap-2">
            <div className="font-medium">{no ? "Kartdata og energirammer" : "Map data and energy frames"}</div>
            <p className="text-[14.5px] text-ink-2">{no ? "Hele utlegget som GeoJSON i EPSG:25832 eller WGS84, og modellens energiramme for et valgt tidspunkt." : "The whole layout as GeoJSON in EPSG:25832 or WGS84, and the model's energy frame for a chosen moment."}</p>
            <div className="grid gap-1.5 text-[14px]">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download from an API route, not a page */}
              <a href="/api/geo" className="inline-flex items-center gap-2"><Icon name="download" size={16} />GeoJSON, EPSG:25832</a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download from an API route, not a page */}
              <a href="/api/geo?crs=4326" className="inline-flex items-center gap-2"><Icon name="download" size={16} />GeoJSON, WGS84</a>
              <a href="/api/energy/frame?ts=2026-12-21T12:00" className="inline-flex items-center gap-2 break-all" target="_blank" rel="noreferrer"><Icon name="external" size={16} />/api/energy/frame?ts=2026-12-21T12:00</a>
            </div>
          </div>
        </div>
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Waiting no={no} title={no ? "Målerserier fra boligene" : "Meter series from the homes"} needs={no ? ["Målere i boligene (se Energi)", "Samtykke fra beboerne til å dele anonymiserte data med UiA (lagres under Mitt hjem)", "En databehandleravtale mellom prosjektet og UiA"] : ["Meters in the homes (see Energy)", "Residents' consent to share anonymised data with UiA (saved under My home)", "A data processing agreement between the project and UiA"]}>
          {no ? "Seriene deles anonymisert og aggregert, bare fra boliger som har sagt ja." : "The series are shared anonymised and aggregated, only from homes that have said yes."}
        </Waiting>
        <Waiting no={no} title={no ? "API-nøkler for forskere" : "API keys for researchers"} needs={no ? ["Målerserier å hente (over)", "Vilkår for bruk, avtalt med UiA"] : ["Meter series to fetch (above)", "Terms of use, agreed with UiA"]}>
          {no ? "Personlige nøkler gir maskinell tilgang til de samme dataene, med logg over bruk." : "Personal keys give machine access to the same data, with a log of use."}
        </Waiting>
      </div>
      <Section title={no ? "Forskningsdokumenter" : "Research documents"} sub={no ? "Studentrapporter, metode og publikasjoner om Knotten." : "Student reports, method and publications about Knotten."}>
        <div className={isAdmin(session) ? "grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start" : ""}>
          <DocList items={resDocs} session={session} locale={locale} empty={no ? "Rapporter fra fagsporene legges her når de er levert." : "Reports from the tracks are added here when delivered."} />
          {isAdmin(session) && <div className="panel p-5 md:p-6"><div className="font-medium mb-3">{no ? "Del et dokument med forskerne" : "Share a document with the researchers"}</div><UploadForm session={session} locale={locale} audience={["research"]} category="research" /></div>}
        </div>
      </Section>
      <Section title={no ? "Kontakt med prosjektet" : "Contact with the project"}>
        <Threads area="research" items={talk} session={session} locale={locale} askTitle={no ? "Spør om data eller samarbeid" : "Ask about data or collaboration"} empty={no ? "Ingen henvendelser ennå." : "No messages yet."} />
      </Section>
    </>
  );
}
