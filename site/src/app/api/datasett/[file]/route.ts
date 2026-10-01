import { promises as fs } from "fs";
import path from "path";
import { can, getSession, isAdmin } from "@/lib/auth";
import { DATASETS } from "@/lib/datasets";
import { incrementMany } from "@/lib/server/kv";
import { recordEvent } from "@/lib/server/stats";

/** A dataset download from the research room: counted per dataset, then served as a file. */
export async function GET(_: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const ds = DATASETS.find((d) => d.file === file);
  if (!ds) return new Response("Ukjent datasett.", { status: 404 });
  const session = await getSession();
  if (!session || !(isAdmin(session) || can(session, "research"))) return new Response("Logg inn med tilgang til forskningsrommet.", { status: 401 });
  const body = await fs.readFile(path.join(process.cwd(), "public", "data", ds.file));
  await incrementMany("datasets", { [ds.file]: 1 }, () => ({})).catch(() => undefined);
  await recordEvent("dataset_download");
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="knotten-${ds.file}"`, "Cache-Control": "private, no-store" },
  });
}
