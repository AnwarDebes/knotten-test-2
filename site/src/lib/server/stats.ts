import { addUnique, incrementMany, readCountersMany } from "./kv";
import { sha256 } from "./crypto";
import { authSecret } from "./accounts";

/**
 * Visitor statistics without cookies and without storing anyone's address. A visitor is counted
 * once a day from a one-way code of the day, the address and the browser; the code changes every
 * day and cannot be traced back. What is kept is counts per day: page views, visitors, visits,
 * pages, referring sites, phone or computer, design, and a few named events (form started,
 * interest registered, document downloaded). Logged-in team members, robots and browsers that
 * ask not to be tracked are not counted.
 */
export const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|httpclient|axios|node-fetch/i;

/** The calendar day in Norway, YYYY-MM-DD. */
export function osloDay(d = new Date()) {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

export type Hit = { path: string; ref: string; width: number; design: "klassisk" | "moderne" };

export async function recordPageview(h: Hit, ip: string, ua: string, host: string) {
  const day = osloDay();
  const visitor = sha256(`${await authSecret()}|${day}|${ip}|${ua}`).slice(0, 24);
  const fresh = await addUnique(`uv-${day}`, visitor, 2 * 86400);
  let from = "";
  try { from = h.ref ? new URL(h.ref).hostname.replace(/^www\./, "") : ""; } catch { /* not a URL */ }
  const internal = from && from === host.replace(/^www\./, "").split(":")[0];
  const fields: Record<string, number> = { pv: 1, [`p:${h.path}`]: 1, [`s:${h.design}`]: 1 };
  if (fresh) fields.uv = 1;
  if (!internal) {
    fields.visits = 1;
    fields[`r:${from || "direkte"}`] = 1;
    fields[`d:${h.width && h.width < 768 ? "mobil" : "pc"}`] = 1;
  }
  await incrementMany(`stats-${day}`, fields, () => ({}));
}

/** Named events: form_start, lead, lead_buy, doc_download, dataset_download, question, login. */
export async function recordEvent(name: string, n = 1) {
  try {
    await incrementMany(`stats-${osloDay()}`, { [`e:${name}`]: n }, () => ({}));
  } catch { /* statistics must never break the action that triggered them */ }
}

export type Day = { date: string; c: Record<string, number> };

/** The last `n` days including today, oldest first. */
export async function readDays(n: number): Promise<Day[]> {
  const days = Array.from({ length: n }, (_, i) => osloDay(new Date(Date.now() - (n - 1 - i) * 86400e3)));
  const counts = await readCountersMany(days.map((d) => `stats-${d}`)).catch(() => days.map(() => ({} as Record<string, number>)));
  return days.map((date, i) => ({ date, c: counts[i] }));
}

/** Sum the counters of several days; `prefix` keeps one family (e.g. "p:" for pages) without the prefix. */
export function sum(days: Day[], prefix?: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of days) {
    for (const [k, v] of Object.entries(d.c)) {
      if (prefix ? !k.startsWith(prefix) : k.includes(":")) continue;
      const key = prefix ? k.slice(prefix.length) : k;
      out[key] = (out[key] ?? 0) + v;
    }
  }
  return out;
}

export const total = (days: Day[], key: string) => days.reduce((a, d) => a + (d.c[key] ?? 0), 0);
