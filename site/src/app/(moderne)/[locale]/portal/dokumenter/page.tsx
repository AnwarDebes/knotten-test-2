import Link from "next/link";
import { can, isAdmin } from "@/lib/auth";
import { AREA_LABEL } from "@/lib/auth-shared";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { CATEGORY_LABEL, DOC_CATEGORIES, canSeeDoc, docs } from "@/lib/server/records";
import { INTERNAL_DOCS, internalDoc } from "@/lib/docRegister";
import { loadPlots } from "@/lib/data";
import { DocList, UploadForm } from "@/components/portal/Docs";
import Icon from "@/components/portal/Icon";
import { Notice, PageHead, Section, when } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Dokumenter", "Documents");

/**
 * Every document shared with this person, in one place: filter by kind, search, download. The
 * public document bank links here for its internal documents (?dok=key). Administrators see which
 * of those are still missing and upload them with the right title and access in one step, and
 * they see who downloaded what, the clearest sign of interest in the data room.
 */
export default async function Documents({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ kategori?: string; q?: string; dok?: string }> }) {
  const { locale, no, session } = await portalPage(params, "/dokumenter", "any");
  const { kategori, q = "", dok } = await searchParams;
  const admin = isAdmin(session);
  const [state, { plots }] = await Promise.all([docs.read(), loadPlots()]);
  const mine = state.docs.filter((d) => canSeeDoc(session, d));
  const needle = q.trim().toLowerCase();
  const shown = mine.filter((d) => (!kategori || d.category === kategori) && (!needle || `${d.title} ${d.description ?? ""} ${d.file.name}`.toLowerCase().includes(needle)));
  const used = DOC_CATEGORIES.filter((c) => mine.some((d) => d.category === c));
  const mayUpload = admin || can(session, "project");
  // arriving from the public document bank
  const wanted = dok ? internalDoc(dok) : undefined;
  const wantedDoc = wanted ? state.docs.find((d) => d.register === wanted.key) : undefined;
  const wantedVisible = wantedDoc && canSeeDoc(session, wantedDoc);
  const promised = INTERNAL_DOCS.map((r) => ({ r, d: state.docs.find((x) => x.register === r.key) }));
  const missing = promised.filter((p) => !p.d).length;
  return (
    <>
      <PageHead
        eyebrow={no ? "Delt med deg" : "Shared with you"}
        title={no ? "Dokumenter" : "Documents"}
        lede={no ? "Alle dokumenter du har tilgang til, med siste versjon øverst. Hver nedlasting går gjennom portalen og logges." : "Every document you have access to, latest version first. Every download goes through the portal and is logged."}
      />

      {wanted && (
        <div className="panel p-5 md:p-6 grid gap-3 border-[var(--amber)]">
          <div className="text-[13px] text-muted">{no ? "Fra dokumentbanken på nettsiden" : "From the document bank on the website"}</div>
          <div className="font-medium text-[17px]">{wanted.title[locale]}</div>
          <p className="text-[14.5px] text-ink-2">{wanted.what[locale]}</p>
          {wantedDoc && wantedVisible ? (
            <div className="flex flex-wrap items-center gap-3">
              <a className="btn btn-sm no-underline" href={`/api/files/${wantedDoc.id}`}><Icon name="download" size={16} />{no ? "Last ned" : "Download"}</a>
              <span className="text-[13px] text-muted">{no ? `Versjon ${wantedDoc.version}, ${when(wantedDoc.uploaded, locale, false)}` : `Version ${wantedDoc.version}, ${when(wantedDoc.uploaded, locale, false)}`}</span>
            </div>
          ) : wantedDoc ? (
            <Notice>{no ? "Dokumentet ligger i portalen, men kontoen din har ikke tilgang til det. Spør prosjekteier om tilgang." : "The document is in the portal, but your account has no access to it. Ask the project owner for access."}</Notice>
          ) : (
            <Notice>{no ? "Dokumentet er ikke lagt inn i portalen ennå. Det kommer her så snart prosjektet har lastet det opp." : "The document has not been added to the portal yet. It appears here as soon as the project uploads it."}</Notice>
          )}
          {admin && !wantedDoc && <UploadForm session={session} locale={locale} register={wanted.key} title={wanted.title.no} category={wanted.category} audience={wanted.audience} />}
        </div>
      )}

      <div className={mayUpload ? "grid gap-5 xl:grid-cols-[1.6fr_1fr] items-start" : "grid gap-5"}>
        <div className="grid gap-4">
          <form className="flex flex-wrap items-center gap-2" role="search">
            {kategori && <input type="hidden" name="kategori" value={kategori} />}
            <input name="q" defaultValue={q} className="input !py-2 !w-auto flex-1 min-w-[200px]" placeholder={no ? "Søk i titler og filnavn" : "Search titles and file names"} aria-label={no ? "Søk" : "Search"} />
            <button className="btn btn-sm btn-ghost btn-plain">{no ? "Søk" : "Search"}</button>
          </form>
          {used.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Link href={`?${q ? `q=${encodeURIComponent(q)}` : ""}`} className={`chip no-underline ${!kategori ? "chip-fjord" : ""}`}>{no ? "Alle" : "All"} {mine.length}</Link>
              {used.map((c) => <Link key={c} href={`?kategori=${c}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`chip no-underline ${kategori === c ? "chip-fjord" : ""}`}>{CATEGORY_LABEL[c][locale]} {mine.filter((d) => d.category === c).length}</Link>)}
            </div>
          )}
          <DocList items={shown} session={session} locale={locale} highlight={wanted?.key} empty={needle || kategori ? (no ? "Ingen treff. Prøv et annet søk eller en annen kategori." : "No matches. Try another search or category.") : (no ? "Når prosjektet deler dokumenter med deg, kommer de her." : "When the project shares documents with you, they appear here.")} />
        </div>
        {mayUpload && (
          <div className="panel p-5 md:p-6 grid gap-2">
            <div className="font-medium mb-1">{no ? "Last opp et dokument" : "Upload a document"}</div>
            <UploadForm session={session} locale={locale} audience={admin ? ["all"] : ["project"]} plots={admin ? plots.map((p) => p.id) : undefined} />
          </div>
        )}
      </div>

      {admin && (
        <Section
          id="forventet"
          title={no ? "Dokumentene nettsiden viser til" : "The documents the website refers to"}
          sub={no ? `Dokumentbanken på nettsiden lister disse som «krever innlogging». ${missing ? `${missing} av ${INTERNAL_DOCS.length} er ikke lastet opp ennå; den som klikker på dem, får beskjed om at de kommer.` : "Alle er lastet opp."} Opplastinger her lagres under tittelen, ikke under det opprinnelige filnavnet.` : `The document bank on the website lists these as "requires login". ${missing ? `${missing} of ${INTERNAL_DOCS.length} are not uploaded yet; whoever clicks them is told they are coming.` : "All are uploaded."} Uploads here are stored under the title, not the original file name.`}
        >
          <div className="panel divide-y divide-[var(--line)]">
            {promised.map(({ r, d }) => (
              <div key={r.key} className="p-4 md:p-5 grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium flex-1 min-w-[16ch]">{r.title[locale]}</span>
                  <span className="text-[12.5px] text-muted">{r.audience.map((a) => (a === "all" ? (no ? "alle med konto" : "everyone with an account") : AREA_LABEL[a][locale].toLowerCase())).join(", ")}</span>
                  <span className={`chip ${d ? "chip-pine" : "chip-amber"}`}>{d ? (no ? `Lagt inn, v${d.version}` : `Uploaded, v${d.version}`) : (no ? "Mangler" : "Missing")}</span>
                </div>
                <p className="text-[13.5px] text-muted">{r.what[locale]}</p>
                <details className="text-[13.5px]">
                  <summary className="cursor-pointer text-fjord list-none">{d ? (no ? "Last opp en ny versjon" : "Upload a new version") : (no ? "Last opp nå" : "Upload now")}</summary>
                  <div className="mt-3 max-w-[560px]"><UploadForm session={session} locale={locale} register={r.key} title={r.title.no} category={r.category} audience={r.audience} /></div>
                </details>
              </div>
            ))}
          </div>
        </Section>
      )}

      {admin && state.log.length > 0 && (
        <Section title={no ? "Siste nedlastinger" : "Latest downloads"} sub={no ? "Hvem som har hentet hva, og når." : "Who fetched what, and when."}>
          <div className="panel scroll-x">
            <table className="table table-tight min-w-[520px]">
              <thead><tr><th>{no ? "Når" : "When"}</th><th>{no ? "Hvem" : "Who"}</th><th>{no ? "Dokument" : "Document"}</th><th className="n">{no ? "Versjon" : "Version"}</th></tr></thead>
              <tbody>{state.log.slice(0, 25).map((l, i) => <tr key={i}><td className="whitespace-nowrap">{when(l.at, locale)}</td><td>{l.who}</td><td>{l.title}</td><td className="n">v{l.version}</td></tr>)}</tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}
