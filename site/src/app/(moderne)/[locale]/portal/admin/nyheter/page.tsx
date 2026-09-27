import type { Locale } from "@/lib/i18n";
import { readStore } from "@/lib/store";
import { deleteNews, saveNews, toggleNews } from "../actions";

export const dynamic = "force-dynamic";

/** News: what is published on /nyheter. Write in Norwegian, English or both; a missing language copies the other. */
export default async function AdminNews({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { locale: l } = await params;
  const { edit } = await searchParams;
  const locale = l as Locale;
  const no = locale === "no";
  const store = await readStore();
  const editing = store.news.find((n) => n.id === edit);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <h1 className="display text-[clamp(34px,4.5vw,56px)]">{no ? "Nyheter" : "News"}</h1>
        <p className="text-[15px] text-muted mt-2 max-w-[52ch]">{no ? "Det som står her vises på /nyheter når det er publisert. Upubliserte saker ser bare du." : "What is here shows on /nyheter once published. Unpublished items are only visible to you."}</p>
        <div className="mt-6 grid gap-3">
          {store.news.map((n) => (
            <div key={n.id} className="panel p-4 grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-muted">{n.date}</span>
                <span className={`chip ${n.published ? "chip-pine" : "chip-amber"}`}>{n.published ? (no ? "publisert" : "published") : (no ? "utkast" : "draft")}</span>
              </div>
              <div className="font-medium">{n.title[locale]}</div>
              <p className="text-[14px] text-bone-2">{n.text[locale]}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <a className="btn btn-sm btn-ghost btn-plain no-underline" href={`?edit=${n.id}`}>{no ? "Rediger" : "Edit"}</a>
                <form action={toggleNews}><input type="hidden" name="id" value={n.id} /><button className="btn btn-sm btn-ghost btn-plain">{n.published ? (no ? "Avpubliser" : "Unpublish") : (no ? "Publiser" : "Publish")}</button></form>
                <form action={deleteNews}><input type="hidden" name="id" value={n.id} /><button className="btn btn-sm btn-ghost btn-plain text-amber">{no ? "Slett" : "Delete"}</button></form>
              </div>
            </div>
          ))}
        </div>
      </div>
      <form action={saveNews} className="panel p-5 md:p-6 grid gap-3 content-start" key={editing?.id ?? "new"}>
        <div className="display text-[24px]">{editing ? (no ? "Rediger sak" : "Edit item") : (no ? "Ny sak" : "New item")}</div>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <label className="grid gap-1 text-[13px]">{no ? "Dato" : "Date"}<input className="input !py-2" name="date" type="date" defaultValue={editing?.date ?? new Date().toISOString().slice(0, 10)} /></label>
        <label className="grid gap-1 text-[13px]">{no ? "Tittel (norsk)" : "Title (Norwegian)"}<input className="input !py-2" name="title_no" defaultValue={editing?.title.no ?? ""} /></label>
        <label className="grid gap-1 text-[13px]">{no ? "Tekst (norsk)" : "Text (Norwegian)"}<textarea className="input" name="text_no" rows={4} defaultValue={editing?.text.no ?? ""} /></label>
        <label className="grid gap-1 text-[13px]">{no ? "Tittel (engelsk)" : "Title (English)"}<input className="input !py-2" name="title_en" defaultValue={editing?.title.en ?? ""} /></label>
        <label className="grid gap-1 text-[13px]">{no ? "Tekst (engelsk)" : "Text (English)"}<textarea className="input" name="text_en" rows={4} defaultValue={editing?.text.en ?? ""} /></label>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="published" defaultChecked={editing?.published ?? true} /> {no ? "Publiser på nettsiden" : "Publish on the website"}</label>
        <div className="flex gap-2">
          <button className="btn btn-amber btn-sm">{no ? "Lagre" : "Save"}</button>
          {editing && <a className="btn btn-ghost btn-sm btn-plain no-underline" href="?">{no ? "Avbryt" : "Cancel"}</a>}
        </div>
      </form>
    </div>
  );
}
