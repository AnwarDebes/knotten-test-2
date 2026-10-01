import { getSession } from "@/lib/auth";
import { canSeeDoc, docs } from "@/lib/server/records";
import { openFile } from "@/lib/server/files";
import { recordEvent } from "@/lib/server/stats";

/**
 * Every document download goes through here: the person must be logged in and allowed to see the
 * document, and the download is counted and logged. `?v=2` fetches an earlier version.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Logg inn for å laste ned dokumentet.", { status: 401 });
  const all = await docs.read();
  const doc = all.docs.find((d) => d.id === id);
  if (!doc || !canSeeDoc(session, doc)) return new Response("Fant ikke dokumentet.", { status: 404 });
  const v = Number(new URL(req.url).searchParams.get("v")) || doc.version;
  const file = v === doc.version ? doc.file : doc.previous.find((p) => p.version === v);
  if (!file) return new Response("Fant ikke versjonen.", { status: 404 });
  const body = await openFile(file.key);
  if (!body) return new Response("Filen mangler i lagringen.", { status: 410 });
  await docs.change((st) => {
    const d = st.docs.find((x) => x.id === id);
    if (d) d.downloads += 1;
    st.log = [{ at: new Date().toISOString(), who: session.email, doc: id, title: doc.title, version: v }, ...st.log].slice(0, 500);
  });
  await recordEvent("doc_download");
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
