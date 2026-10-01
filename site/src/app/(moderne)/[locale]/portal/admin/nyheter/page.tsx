import { pageTitle, portalPage } from "@/lib/server/portal";
import { readStore } from "@/lib/store";
import { osloDate } from "@/lib/server/live";
import { deleteNews, saveNews, toggleNews } from "../actions";
import NoAccess from "@/components/portal/NoAccess";
import { ConfirmButton } from "@/components/portal/forms";
import { PageHead, when } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Nyheter", "News");

/** News: what is published on /nyheter. Write in Norwegian, English or both; a missing language copies the other. */
export default async function AdminNews({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/admin/nyheter", "admin");
  if (!ok) return <NoAccess locale={locale} session={session} area="admin" />;
  const { edit } = await searchParams;
  const store = await readStore();
  const editing = store.news.find((n) => n.id === edit);
  return (
    <>
    <PageHead eyebrow={no ? "Administrasjon" : "Administration"} title={no ? "Nyheter" : "News"} lede={no ? "Det som står her, vises på nyhetssiden når det er publisert. Skriv på norsk, engelsk eller begge; mangler ett språk, brukes det andre. Nådde milepæler kan også publiseres fra prosjektrommet." : "What is here shows on the news page once published. Write in Norwegian, English or both; a missing language copies the other. Reached milestones can also be published from the project room."} />
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr] items-start">
      <div>
        <div className="grid gap-3">
          {store.news.map((n) => (
            <div key={n.id} className="panel p-4 grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-muted">{when(n.date, locale, false)}</span>
                <span className={`chip ${n.published ? "chip-pine" : "chip-amber"}`}>{n.published ? (no ? "publisert" : "published") : (no ? "utkast" : "draft")}</span>
              </div>
              <div className="font-medium">{n.title[locale]}</div>
              <p className="text-[14px] text-ink-2 line-clamp-3">{n.text[locale]}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <a className="btn btn-sm btn-ghost btn-plain no-underline" href={`?edit=${n.id}`}>{no ? "Rediger" : "Edit"}</a>
                <form action={toggleNews}><input type="hidden" name="id" value={n.id} /><button className="btn btn-sm btn-ghost btn-plain">{n.published ? (no ? "Avpubliser" : "Unpublish") : (no ? "Publiser" : "Publish")}</button></form>
                <ConfirmButton action={deleteNews} fields={{ id: n.id }} label={no ? "Slett" : "Delete"} question={no ? "Slette saken?" : "Delete the item?"} className="btn btn-sm btn-ghost btn-plain !text-amber-ink" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <form action={saveNews} className="panel p-5 md:p-6 grid gap-3 content-start" key={editing?.id ?? "new"}>
        <div className="font-medium text-[17px]">{editing ? (no ? "Rediger sak" : "Edit item") : (no ? "Ny sak" : "New item")}</div>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <label className="grid gap-1 text-[13px]">{no ? "Dato" : "Date"}<input className="input !py-2" name="date" type="date" defaultValue={editing?.date ?? osloDate()} /></label>
        <label className="grid gap-1 text-[13px]">{no ? "Tittel (norsk)" : "Title (Norwegian)"}<input className="input !py-2" name="title_no" defaultValue={editing?.title.no ?? ""} /></label>
        <label className="grid gap-1 text-[13px]">{no ? "Tekst (norsk)" : "Text (Norwegian)"}<textarea className="input" name="text_no" rows={4} defaultValue={editing?.text.no ?? ""} /></label>
        <label className="grid gap-1 text-[13px]">{no ? "Tittel (engelsk)" : "Title (English)"}<input className="input !py-2" name="title_en" defaultValue={editing?.title.en ?? ""} /></label>
        <label className="grid gap-1 text-[13px]">{no ? "Tekst (engelsk)" : "Text (English)"}<textarea className="input" name="text_en" rows={4} defaultValue={editing?.text.en ?? ""} /></label>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="published" defaultChecked={editing?.published ?? true} /> {no ? "Publiser på nettsiden" : "Publish on the website"}</label>
        <div className="flex gap-2">
          <button className="btn btn-sm">{no ? "Lagre" : "Save"}</button>
          {editing && <a className="btn btn-ghost btn-sm btn-plain no-underline" href="?">{no ? "Avbryt" : "Cancel"}</a>}
        </div>
      </form>
    </div>
    </>
  );
}
