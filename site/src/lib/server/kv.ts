import { promises as fs } from "fs";
import path from "path";

/**
 * Where the site keeps its working records (CRM, accounts, workspace, documents, statistics).
 *
 * - "kv": a Redis database over HTTPS (Upstash, or Vercel's Redis/KV integration). Used as soon as
 *   KV_REST_API_URL and KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST_* pair) are set. This is the
 *   storage to use on Vercel, where the project folder is read-only.
 * - "file": JSON files under site/data. For running the site on a computer or a normal server.
 * - "temp": on Vercel without a database the files go to /tmp. That works for a demonstration,
 *   but /tmp is emptied when the server sleeps, so the admin shows a warning until KV is set up.
 *
 * Every record set is one JSON document under one key. Changes go through `mutate`, which reads,
 * changes and writes one key at a time inside this server process.
 */
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const STORAGE: "kv" | "file" | "temp" = KV_URL && KV_TOKEN ? "kv" : process.env.VERCEL ? "temp" : "file";

const ROOT = STORAGE === "temp" ? "/tmp/knotten" : path.join(process.cwd(), "data");
/** The CRM file predates this module and stays where it was; everything newer lives in data/private (not in git). */
export function fileFor(key: string) {
  return key === "crm" && STORAGE === "file" ? path.join(ROOT, "crm.json") : path.join(ROOT, "private", `${key.replace(/[^a-z0-9._-]/gi, "_")}.json`);
}
export const PRIVATE_DIR = path.join(ROOT, "private");

async function redis(command: (string | number)[]) {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || json.error) throw new Error(`kv ${command[0]} failed: ${json.error ?? res.status}`);
  return json.result;
}

export async function readJSON<T>(key: string): Promise<T | null> {
  if (STORAGE === "kv") {
    const raw = (await redis(["GET", `knotten:${key}`])) as string | null;
    return raw ? (JSON.parse(raw) as T) : null;
  }
  try {
    return JSON.parse(await fs.readFile(fileFor(key), "utf-8")) as T;
  } catch {
    return null;
  }
}

export async function writeJSON(key: string, value: unknown) {
  if (STORAGE === "kv") {
    await redis(["SET", `knotten:${key}`, JSON.stringify(value)]);
    return;
  }
  const file = fileFor(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  // write to a side file and rename, so a crash never leaves half a file behind
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, key === "crm" ? JSON.stringify(value, null, 1) : JSON.stringify(value), "utf-8");
  await fs.rename(tmp, file);
}

const locks = new Map<string, Promise<unknown>>();

/** Read the record set, let `fn` change it, write it back; one change per key at a time. */
export async function mutate<T, R>(key: string, seed: () => T, fn: (value: T) => R | Promise<R>): Promise<R> {
  const run = async () => {
    const value = (await readJSON<T>(key)) ?? seed();
    const out = await fn(value);
    await writeJSON(key, value);
    return out;
  };
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(run, run);
  locks.set(key, next.catch(() => undefined));
  return next;
}

/** Counters for the visitor statistics: atomic in Redis, in the JSON file otherwise. */
export async function incrementMany(key: string, fields: Record<string, number>, seed: () => Record<string, number>) {
  if (STORAGE === "kv") {
    const cmds = Object.entries(fields).map(([f, n]) => ["HINCRBY", `knotten:${key}`, f, n]);
    const res = await fetch(`${KV_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`kv pipeline failed: ${res.status}`);
    return;
  }
  await mutate<Record<string, number>, void>(key, seed, (v) => {
    for (const [f, n] of Object.entries(fields)) v[f] = (v[f] ?? 0) + n;
  });
}

/** Many counter sets at once: one request to Redis however many days are asked for. */
export async function readCountersMany(keys: string[]): Promise<Record<string, number>[]> {
  if (STORAGE !== "kv" || keys.length === 0) return Promise.all(keys.map((k) => readCounters(k).catch(() => ({}))));
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(keys.map((k) => ["HGETALL", `knotten:${k}`])),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`kv pipeline failed: ${res.status}`);
  const out = (await res.json()) as { result?: string[] | null }[];
  return out.map((r) => {
    const flat = r.result ?? [];
    const o: Record<string, number> = {};
    for (let i = 0; i + 1 < flat.length; i += 2) o[flat[i]] = Number(flat[i + 1]) || 0;
    return o;
  });
}

export async function readCounters(key: string): Promise<Record<string, number>> {
  if (STORAGE === "kv") {
    const flat = ((await redis(["HGETALL", `knotten:${key}`])) as string[] | null) ?? [];
    const out: Record<string, number> = {};
    for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = Number(flat[i + 1]) || 0;
    return out;
  }
  return (await readJSON<Record<string, number>>(key)) ?? {};
}

/** Add a member to a set that forgets itself after `ttlSec`; true when the member was new. */
export async function addUnique(key: string, member: string, ttlSec: number): Promise<boolean> {
  if (STORAGE === "kv") {
    const res = await fetch(`${KV_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([["SADD", `knotten:${key}`, member], ["EXPIRE", `knotten:${key}`, ttlSec]]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`kv pipeline failed: ${res.status}`);
    const out = (await res.json()) as { result?: number }[];
    return out[0]?.result === 1;
  }
  return mutate<{ until: number; members: string[] }, boolean>(key, () => ({ until: Date.now() + ttlSec * 1000, members: [] }), (v) => {
    if (v.until < Date.now()) { v.until = Date.now() + ttlSec * 1000; v.members = []; }
    if (v.members.includes(member)) return false;
    v.members.push(member);
    return true;
  });
}
