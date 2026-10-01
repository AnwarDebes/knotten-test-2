import { AREAS, AREA_LABEL, isAdmin, type Session } from "@/lib/auth-shared";
import { CATEGORY_LABEL, DOC_CATEGORIES, type Audience, type Doc } from "@/lib/server/records";
import { FILES_ON, MAX_BYTES, prettySize } from "@/lib/server/files";
import { deleteDoc, uploadDoc } from "@/app/(moderne)/[locale]/portal/actions";
import { ActionForm, ConfirmButton } from "./forms";
import { Empty, when } from "./ui";
import Icon from "./Icon";

const ext = (name: string) => (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? "fil").toUpperCase();

/** A list of documents with download links; administrators also see the counts and can remove. */
export function DocList({ items, session, locale, empty, highlight }: { items: Doc[]; session: Session; locale: "no" | "en"; empty?: React.ReactNode; highlight?: string }) {
  const no = locale === "no";
  const admin = isAdmin(session);
  if (!items.length) return <Empty icon="folder" title={no ? "Ingen dokumenter her ennå" : "No documents here yet"}>{empty}</Empty>;
  return (
    <div className="panel overflow-hidden">
      <ul className="divide-y divide-[var(--line)]">
        {items.map((d) => (
          <li key={d.id} id={`dok-${d.id}`} className={`grid gap-3 p-4 md:p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center ${highlight && d.register === highlight ? "bg-[rgba(226,162,59,.12)]" : ""}`}>
            <span className="hidden sm:grid place-items-center w-11 h-11 rounded-[10px] bg-bg-2 text-fjord text-[11px] font-semibold tracking-wide">{ext(d.file.name)}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.title}</span>
                <span className="chip">{CATEGORY_LABEL[d.category][locale]}</span>
                {d.version > 1 && <span className="chip chip-fjord">v{d.version}</span>}
                {d.plot && <span className="chip chip-pine">{no ? "Tomt" : "Plot"} {Number(d.plot.slice(5))}</span>}
              </div>
              {d.description && <p className="text-[14px] text-ink-2 mt-1">{d.description}</p>}
              <div className="text-[12.5px] text-muted mt-1">
                {prettySize(d.file.size, no)} · {when(d.uploaded, locale, false)} · {d.by}
                {admin && <> · {no ? "synlig for" : "visible to"} {d.audience.map((a) => (a === "all" ? (no ? "alle med konto" : "everyone with an account") : AREA_LABEL[a][locale].toLowerCase())).join(", ")} · {d.downloads} {no ? "nedlastinger" : "downloads"}</>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a className="btn btn-sm btn-ghost btn-plain no-underline" href={`/api/files/${d.id}`}><Icon name="download" size={16} />{no ? "Last ned" : "Download"}</a>
              {admin && <ConfirmButton action={deleteDoc} fields={{ id: d.id }} label={no ? "Slett" : "Delete"} question={no ? `Slette «${d.title}» med alle versjoner?` : `Delete "${d.title}" and all versions?`} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Upload a document. Administrators choose who sees it; project members share within their own areas. */
export function UploadForm({ session, locale, audience = ["all"], category = "other", plots, register, title }: { session: Session; locale: "no" | "en"; audience?: Audience[]; category?: Doc["category"]; plots?: string[]; register?: string; title?: string }) {
  const no = locale === "no";
  const admin = isAdmin(session);
  const options: Audience[] = admin ? ["all", ...AREAS] : AREAS.filter((a) => session.areas.includes(a));
  if (!FILES_ON) {
    return <p className="text-[14px] text-muted">{no ? "Opplasting er slått av til fillagring er satt opp (Vercel Blob). Se Innstillinger." : "Uploads are off until file storage is set up (Vercel Blob). See Settings."}</p>;
  }
  return (
    <ActionForm action={uploadDoc} submit={no ? "Last opp" : "Upload"} pending={no ? "Laster opp …" : "Uploading …"} className="grid gap-3">
      <input type="hidden" name="lang" value={locale} />
      {register && <input type="hidden" name="register" value={register} />}
      <label className="grid gap-1.5 text-[13.5px]">
        <span className="font-medium text-ink-2">{no ? "Fil" : "File"}</span>
        <input type="file" name="file" required className="input !py-2 text-[14px] file:mr-3 file:rounded-full file:border-0 file:bg-bg-2 file:px-3 file:py-1.5 file:text-[13px] file:font-medium" />
        <span className="text-[12.5px] text-muted">{no ? `PDF, Excel, Word, bilder og andre filer, inntil ${prettySize(MAX_BYTES)}.` : `PDF, Excel, Word, images and other files, up to ${prettySize(MAX_BYTES, false)}.`}</span>
      </label>
      <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Tittel" : "Title"}</span><input className="input !py-2" name="title" defaultValue={title} placeholder={no ? "Filnavnet brukes hvis feltet står tomt" : "The file name is used if left empty"} /></label>
      <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Kort beskrivelse" : "Short description"}</span><input className="input !py-2" name="description" /></label>
      <label className="grid gap-1.5 text-[13.5px]">
        <span className="font-medium text-ink-2">{no ? "Kategori" : "Category"}</span>
        <select className="input !py-2" name="category" defaultValue={category}>{DOC_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c][locale]}</option>)}</select>
      </label>
      <fieldset className="grid gap-1.5 text-[13.5px]">
        <legend className="font-medium text-ink-2 mb-1">{no ? "Hvem kan se dokumentet" : "Who can see it"}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {options.map((a) => (
            <label key={a} className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="audience" value={a} defaultChecked={audience.includes(a)} />{a === "all" ? (no ? "Alle med konto" : "Everyone with an account") : AREA_LABEL[a][locale]}</label>
          ))}
        </div>
        <span className="text-[12.5px] text-muted">{no ? "Administratorer ser alltid alle dokumenter." : "Administrators always see every document."}</span>
      </fieldset>
      {admin && plots && (
        <label className="grid gap-1.5 text-[13.5px]">
          <span className="font-medium text-ink-2">{no ? "Bare for beboeren på tomt (valgfritt)" : "Only for the resident of plot (optional)"}</span>
          <select className="input !py-2" name="plot" defaultValue=""><option value="">{no ? "Ingen bestemt tomt" : "No particular plot"}</option>{plots.map((p) => <option key={p} value={p}>{no ? "Tomt" : "Plot"} {Number(p.slice(5))}</option>)}</select>
        </label>
      )}
    </ActionForm>
  );
}
