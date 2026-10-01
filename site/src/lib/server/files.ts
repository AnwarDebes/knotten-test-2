import { promises as fs } from "fs";
import path from "path";
import { del, get, put } from "@vercel/blob";
import { PRIVATE_DIR, STORAGE } from "./kv";

/**
 * Where uploaded documents are kept. On a normal server: site/data/private/files (not in git).
 * On Vercel: Vercel Blob as private files (set BLOB_READ_WRITE_TOKEN by connecting a Blob store
 * to the project). Files are never linked to directly; every download goes through the portal,
 * which checks who is asking and writes it in the log.
 */
const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
export const FILES_ON = BLOB || STORAGE === "file";
/** Vercel takes at most 4.5 MB in one request; a normal server takes more. */
export const MAX_BYTES = process.env.VERCEL ? 4 * 1024 * 1024 : 25 * 1024 * 1024;
const DIR = path.join(PRIVATE_DIR, "files");

export const safeName = (name: string) => name.normalize("NFC").replace(/[^\p{L}\p{N}.,_ -]/gu, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "fil";

/** Store the file; returns the key to find it again. */
export async function saveFile(id: string, file: File): Promise<string> {
  if (BLOB) {
    const res = await put(`knotten/${id}/${safeName(file.name)}`, file, { access: "private", addRandomSuffix: true, contentType: file.type || "application/octet-stream" });
    return `blob:${res.pathname}`;
  }
  if (STORAGE !== "file") throw new Error("no file storage");
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, id), Buffer.from(await file.arrayBuffer()));
  return `file:${id}`;
}

export async function openFile(key: string): Promise<ReadableStream<Uint8Array> | Uint8Array | null> {
  if (key.startsWith("blob:")) {
    const res = await get(key.slice(5), { access: "private" });
    return res && res.statusCode === 200 ? res.stream : null;
  }
  if (key.startsWith("file:")) {
    try {
      return new Uint8Array(await fs.readFile(path.join(DIR, key.slice(5).replace(/[^a-z0-9-]/gi, ""))));
    } catch {
      return null;
    }
  }
  return null;
}

export async function removeFile(key: string) {
  try {
    if (key.startsWith("blob:")) await del(key.slice(5));
    else if (key.startsWith("file:")) await fs.unlink(path.join(DIR, key.slice(5).replace(/[^a-z0-9-]/gi, "")));
  } catch { /* already gone */ }
}

export function prettySize(bytes: number, no = true) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  const mb = bytes / 1024 / 1024;
  return `${(Number.isInteger(mb) ? String(mb) : mb.toFixed(1)).replace(".", no ? "," : ".")} MB`;
}
