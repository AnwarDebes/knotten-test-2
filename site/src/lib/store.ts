import { promises as fs } from "fs";
import path from "path";
import type { Role } from "./auth-shared";

/**
 * The project's working records: leads, plot status and prices, news, users and settings.
 * Preview storage is one JSON file (site/data/crm.json), read and written by the admin's server
 * actions. Production swaps this module for Supabase tables with the same shapes; every function
 * here is the adapter surface, nothing else in the site touches the file.
 */
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";
export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  purpose: "buy" | "invest" | "partner" | "curious";
  plots: string[];
  consent_updates: boolean;
  consent_investor: boolean;
  consent_research: boolean;
  source: string;
  created: string;
  status: LeadStatus;
  notes: { at: string; by: string; text: string }[];
};
export type PlotStatus = "unreleased" | "available" | "reserved" | "sold";
export type PlotState = { id: string; status: PlotStatus; price_nok?: number; note?: string; updated?: string };
export type NewsItem = { id: string; date: string; title: { no: string; en: string }; text: { no: string; en: string }; published: boolean };
export type User = { email: string; name: string; role: Exclude<Role, "public">; added: string };
export type Settings = { release_note: { no: string; en: string }; contact_email: string; contact_phone: string; weekly_digest: boolean };
export type Activity = { at: string; by: string; what: string };
export type Store = { leads: Lead[]; plots: Record<string, PlotState>; news: NewsItem[]; users: User[]; settings: Settings; activity: Activity[] };

/**
 * Where the records live. Locally: site/data/crm.json. On Vercel the project folder is read-only,
 * so the file goes to /tmp: it works for a demo and survives while the instance is warm, but a
 * real deployment must move this to Vercel Blob, KV or Supabase (same shapes, this file only).
 */
const ON_VERCEL = !!process.env.VERCEL;
const DIR = ON_VERCEL ? "/tmp/knotten" : path.join(process.cwd(), "data");
const FILE = path.join(DIR, "crm.json");
const LEGACY = path.join(process.cwd(), "data", "leads.json");

export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];
export const PLOT_STATUSES: PlotStatus[] = ["unreleased", "available", "reserved", "sold"];

/** Five made-up people so the owner can see how the pipeline works before the form is in use. Removed with one click in the admin. */
const ago = (days: number, h = 10) => new Date(Date.now() - days * 86400e3 - h * 3600e3).toISOString();
const EXAMPLE_LEADS: Lead[] = [
  { id: "ex-1", name: "Kari Eksempel", email: "kari@example.com", phone: "+47 900 00 001", purpose: "buy", plots: ["plot-12", "plot-14"], consent_updates: true, consent_investor: false, consent_research: true, source: "eksempel", created: ago(1, 3), status: "new", notes: [] },
  { id: "ex-2", name: "Ola Eksempel", email: "ola@example.com", phone: "+47 900 00 002", purpose: "buy", plots: ["plot-12"], consent_updates: true, consent_investor: false, consent_research: false, source: "eksempel", created: ago(3), status: "contacted", notes: [{ at: ago(2), by: "Sigve Simonsen", text: "Ringte. Vil se tomten i oktober, helst 12 eller 16." }] },
  { id: "ex-3", name: "Nordfjord Invest (eksempel)", email: "post@example.com", phone: "", purpose: "invest", plots: [], consent_updates: true, consent_investor: true, consent_research: false, source: "eksempel", created: ago(6), status: "qualified", notes: [{ at: ago(5), by: "Sigve Simonsen", text: "Ba om dataromet etter NDA. Sendt utkast." }] },
  { id: "ex-4", name: "Lindesnes kommune (eksempel)", email: "plan@example.com", phone: "", purpose: "partner", plots: [], consent_updates: true, consent_investor: false, consent_research: false, source: "eksempel", created: ago(9), status: "contacted", notes: [] },
  { id: "ex-5", name: "Per Eksempel", email: "per@example.com", phone: "+47 900 00 005", purpose: "curious", plots: ["plot-05"], consent_updates: true, consent_investor: false, consent_research: true, source: "eksempel", created: ago(12), status: "lost", notes: [{ at: ago(10), by: "Sigve Simonsen", text: "Ville ha tomt på flaten med sjøutsikt. Finnes ikke." }] },
];

const SEED: Store = {
  leads: EXAMPLE_LEADS,
  plots: {},
  news: [
    { id: "n-2026-09-14", date: "2026-09-14", published: true, title: { no: "Utlegg v5: terrasser, rekke under rekke, sjøutsikt fra alle 30", en: "Layout v5: terraces, row under row, a sea view from all 30" }, text: { no: "Tomtene ligger nå i terrasser over sørhellingen: en rekke på hvert nivå, hver rekke rett under den over, slik prosjekteier vil forme terrenget. Hver av de 30 tomtene er sjekket mot vannet med nabohusene stående; 28 ser åpent hav. Ingen tomter på flaten ved Rødbergsveien.", en: "The plots now sit in terraces across the south face: a row on every level, each row right under the one above, the way the project owner intends to shape the ground. Each of the 30 plots is checked against the water with the neighbouring houses standing; 28 see open sea. No plots on the flat by Rødbergsveien." } },
    { id: "n-2026-09-13", date: "2026-09-13", published: true, title: { no: "Utlegg v3: sjøutsikt fra alle tomtene på åsen", en: "Layout v3: a sea view from every plot on the hill" }, text: { no: "Tomtene er lagt om slik at alle tomtene på sørhellingen har målt sjøutsikt, de fleste med åpent hav. Tomtene på flaten ved Rødbergsveien er uten sjøutsikt. Til sammen 30 tomter.", en: "The plots were relaid so that every plot on the south slope has a measured sea view, most of them with open sea. The plots on the flat by Rødbergsveien are without a sea view. Thirty plots in all." } },
    { id: "n-2026-09-04", date: "2026-09-04", published: true, title: { no: "Retning for energikonseptet", en: "Direction for the energy concept" }, text: { no: "Prosjekteier satte retningen: eget batteri og energistyring i hver bolig, bergvarme, optimaliserte tak pluss et fellesanlegg for sol, vind som supplement, og et robust, fleksibelt system framfor ett felt bygget rundt én teknologi.", en: "The project owner set the direction: a battery and energy management in every home, bedrock heat, optimised roofs plus a shared solar plant, wind as a supplement, and a robust, flexible system rather than a field built around one technology." } },
    { id: "n-2026-08-25", date: "2026-08-25", published: true, title: { no: "Praksisperioden med Universitetet i Agder er i gang", en: "The internship with the University of Agder has started" }, text: { no: "Studenter arbeider i to spor fram til desember: energi og teknikk, og profilering og marked. Nettsiden er første leveranse.", en: "Students work in two tracks until December: energy and technology, and profile and market. The website is the first deliverable." } },
  ],
  users: [
    { email: "sigve.simonsen@hotmail.com", name: "Sigve Simonsen", role: "superadmin", added: "2026-09-13" },
  ],
  settings: { release_note: { no: "Tomtene slippes etter at reguleringsplanen er vedtatt.", en: "The plots are released once the zoning plan is adopted." }, contact_email: "sigve.simonsen@hotmail.com", contact_phone: "+47 954 95 152", weekly_digest: true },
  activity: [],
};

let lock: Promise<unknown> = Promise.resolve();

export async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const s = JSON.parse(raw) as Partial<Store>;
    return { ...SEED, ...s, settings: { ...SEED.settings, ...(s.settings ?? {}) } };
  } catch {
    // first run: take over any leads the old form wrote
    const store: Store = { ...SEED, leads: [...EXAMPLE_LEADS] };
    try {
      const old = JSON.parse(await fs.readFile(LEGACY, "utf-8")) as Omit<Lead, "id" | "status" | "notes">[];
      store.leads.push(...old.map((l, i) => ({ id: `lead-${Date.parse(l.created) || i}`, status: "new" as const, notes: [], ...l })));
    } catch { /* nothing to migrate */ }
    await writeRaw(store);
    return store;
  }
}

async function writeRaw(store: Store) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 1), "utf-8");
}

/** Read, change, write, one at a time. Returns what the mutator returns. */
export async function updateStore<T>(by: string, what: string, fn: (s: Store) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const s = await readStore();
    const out = await fn(s);
    s.activity = [{ at: new Date().toISOString(), by, what }, ...s.activity].slice(0, 200);
    await writeRaw(s);
    return out;
  };
  const p = lock.then(run, run);
  lock = p.catch(() => undefined);
  return p;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
