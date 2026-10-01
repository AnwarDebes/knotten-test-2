import { cache } from "react";
import { mutate, readJSON } from "./kv";
import { isAdmin, type Area, type Session } from "@/lib/auth-shared";

/**
 * The portal's working records, apart from the CRM: documents, questions and answers, the
 * project workspace, residents' consents and the meter data for the buildings on the property.
 * Each set is one record under its own key (lib/server/kv), outside git.
 */
const now = () => new Date().toISOString();
export const rid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function store<T>(key: string, seed: () => T) {
  return {
    read: cache(async (): Promise<T> => ({ ...seed(), ...((await readJSON<T>(key)) ?? {}) })),
    change: <R>(fn: (s: T) => R | Promise<R>) => mutate<T, R>(key, seed, async (raw) => {
      const full = { ...seed(), ...raw } as T;
      const out = await fn(full);
      Object.assign(raw as object, full);
      return out;
    }),
  };
}

// ------------------------------------------------------------------ documents
export const DOC_CATEGORIES = ["plan", "energy", "finance", "drawings", "agreements", "reports", "research", "residents", "other"] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<DocCategory, { no: string; en: string }> = {
  plan: { no: "Regulering og plan", en: "Zoning and plan" },
  energy: { no: "Energi", en: "Energy" },
  finance: { no: "Økonomi og investering", en: "Finance and investment" },
  drawings: { no: "Tegninger og kart", en: "Drawings and maps" },
  agreements: { no: "Avtaler", en: "Agreements" },
  reports: { no: "Rapporter", en: "Reports" },
  research: { no: "Forskning", en: "Research" },
  residents: { no: "For beboere", en: "For residents" },
  other: { no: "Annet", en: "Other" },
};
/** Who sees a document: everyone with an account, or the people given one of these areas. Administrators see all. */
export type Audience = Area | "all";
export type StoredFile = { key: string; name: string; size: number; type: string };
export type Doc = {
  id: string;
  title: string;
  description?: string;
  category: DocCategory;
  audience: Audience[];
  /** A resident document for one home only. */
  plot?: string;
  /** One of the working documents the public document bank lists (lib/docRegister.ts). */
  register?: string;
  file: StoredFile;
  version: number;
  previous: (StoredFile & { version: number; uploaded: string; by: string })[];
  uploaded: string;
  by: string;
  downloads: number;
};
type DocsState = { docs: Doc[]; log: { at: string; who: string; doc: string; title: string; version: number }[] };
export const docs = store<DocsState>("docs", () => ({ docs: [], log: [] }));

export function canSeeDoc(s: Session, d: Doc) {
  if (isAdmin(s)) return true;
  if (d.plot && d.plot !== s.plot) return false;
  return d.audience.includes("all") || d.audience.some((a) => a !== "all" && s.areas.includes(a));
}

// ------------------------------------------------------------------ questions, comments and requests
export const THREAD_AREAS = ["investor", "municipality", "resident", "project", "research"] as const;
export type ThreadArea = (typeof THREAD_AREAS)[number];
export type Msg = { at: string; uid: string; name: string; staff: boolean; text: string };
export type Thread = {
  id: string;
  area: ThreadArea;
  subject: string;
  plot?: string;
  created: string;
  uid: string;
  name: string;
  org?: string;
  /** Visible to everyone with the area (an answered investor question for all investors), not just the asker. */
  shared: boolean;
  /** The language the asker wrote from; the email about an answer uses it. */
  lang?: "no" | "en";
  status: "open" | "answered" | "closed";
  messages: Msg[];
};
export const threads = store<{ threads: Thread[] }>("threads", () => ({ threads: [] }));

export function canSeeThread(s: Session, t: Thread) {
  return isAdmin(s) || t.uid === s.id || (t.shared && s.areas.includes(t.area));
}

// ------------------------------------------------------------------ the project workspace
export type Task = { id: string; title: string; owner: string; due?: string; status: "todo" | "doing" | "done"; priority: "high" | "medium" | "low"; topic?: string; created: string; by: string; done_at?: string };
export type Decision = { id: string; date: string; title: string; text: string; by: string; created: string };
export type Milestone = { id: string; date?: string; title: string; detail?: string; status: "done" | "next" | "later"; public: boolean; news_id?: string };
type WorkspaceState = { tasks: Task[]; decisions: Decision[]; milestones: Milestone[] };

const SEED_AT = "2026-09-30T12:00:00.000Z";
const seedWorkspace = (): WorkspaceState => ({
  // what the website still needs from the project, as listed in the first portal version
  tasks: [
    { id: "t-1", title: "Georeferert situasjonsplan fra planleggeren", owner: "Prosjekteier", status: "todo", priority: "high", topic: "Regulering", created: SEED_AT, by: "Oppstart" },
    { id: "t-2", title: "Matrikkelgrense for gnr 355 bnr 10 og 368", owner: "Plattformsporet", status: "done", priority: "high", topic: "Kart", created: SEED_AT, by: "Oppstart", done_at: "2026-09-08T12:00:00.000Z" },
    { id: "t-3", title: "Elhub-ID og forbrukshistorikk for kontorbygget og boligen", owner: "Prosjekteier", status: "todo", priority: "high", topic: "Energi", created: SEED_AT, by: "Oppstart" },
    { id: "t-4", title: "Energikontrakt v1: dataformat for målinger fra energisporet", owner: "Energisporet", status: "todo", priority: "high", topic: "Energi", created: SEED_AT, by: "Oppstart" },
    { id: "t-5", title: "Flyfoto i høy oppløsning (Norge i bilder eller drone)", owner: "Markedssporet", status: "todo", priority: "medium", topic: "Kart", created: SEED_AT, by: "Oppstart" },
    { id: "t-6", title: "Originalfoto fra grillbua", owner: "Prosjekteier", status: "todo", priority: "medium", topic: "Nettside", created: SEED_AT, by: "Oppstart" },
    { id: "t-7", title: "Vinterfoto 21. desember klokka 12", owner: "Markedssporet", status: "todo", priority: "low", topic: "Nettside", created: SEED_AT, by: "Oppstart" },
  ],
  decisions: [
    { id: "d-1", date: "2026-09-04", title: "Foreløpig retning for energikonseptet", text: "Batteri og energistyring i hver bolig med mulig felles lager; mikronett undersøkes uten å være en forutsetning; sol på boligene og et fellesanlegg på om lag 600 paneler; vind vurderes som supplement. Målet er et robust og fleksibelt system, ikke et felt bygget rundt én teknologi.", by: "Prosjekteier", created: SEED_AT },
    { id: "d-2", date: "2026-09-27", title: "Sandbatteriet legges bort", text: "Bergvarme krever mindre plass. Sandbatteriet tas ut av konseptet.", by: "Prosjektgruppen", created: SEED_AT },
    { id: "d-3", date: "2026-09-27", title: "Vind vurderes fortsatt som supplement", text: "Energisporet vurderte småskala vind som nei; prosjekteier holder det åpent som supplement, avhengig av lokale vindmålinger.", by: "Prosjektgruppen", created: SEED_AT },
    { id: "d-4", date: "2026-09-27", title: "Feltet planlegges i fire rekker", text: "Tomtene legges i fire rekker, A til D, som i planen. Modellens utlegg v6 følger dette.", by: "Prosjektgruppen", created: SEED_AT },
  ],
  milestones: [
    { id: "m-1", date: "2026-09-05", title: "3D-modell fra Kartverkets laserdata, siktanalyse og solpass per tomt", status: "done", public: false },
    { id: "m-2", date: "2026-09-06", title: "Nettsted og portal, første versjon", status: "done", public: false },
    { id: "m-3", date: "2026-09-30", title: "Modellens utlegg v6 i fire rekker", status: "done", public: true, news_id: "n-2026-09-30" },
    { id: "m-4", title: "Teknisk energirapport fra energisporet", status: "next", public: false },
    { id: "m-5", title: "Reguleringsplan sendes Lindesnes kommune", status: "later", public: false },
    { id: "m-6", title: "Tomtene slippes for salg", status: "later", public: false },
  ],
});
export const workspace = store<WorkspaceState>("workspace", seedWorkspace);

/** English for the starter records above. A record shows it only while it still has its starter text. */
const SEED_EN: Record<string, { title: string; text?: string }> = {
  "t-1": { title: "Georeferenced site plan from the planner" },
  "t-2": { title: "Cadastral boundary for property 355/10 and 355/368" },
  "t-3": { title: "Elhub ID and consumption history for the office building and the house" },
  "t-4": { title: "Energy contract v1: data format for measurements from the energy track" },
  "t-5": { title: "High-resolution aerial photo (Norge i bilder or drone)" },
  "t-6": { title: "Original photo from the grill hut" },
  "t-7": { title: "Winter photo on 21 December at noon" },
  "d-1": { title: "Preliminary direction for the energy concept", text: "A battery and energy management in every home, with possible shared storage; a microgrid is examined without being a prerequisite; solar on the homes and a shared plant of about 600 panels; wind is considered as a supplement. The goal is a robust and flexible system, not a field built around one technology." },
  "d-2": { title: "The sand battery is dropped", text: "Bedrock heat needs less space. The sand battery is taken out of the concept." },
  "d-3": { title: "Wind is still considered as a supplement", text: "The energy track assessed small-scale wind as a no; the project owner keeps it open as a supplement, depending on local wind measurements." },
  "d-4": { title: "The field is planned in four rows", text: "The plots are laid out in four rows, A to D, as in the plan. The model's layout v6 follows this." },
  "m-1": { title: "3D model from Kartverket's laser data, view analysis and a sun passport per plot" },
  "m-2": { title: "Website and portal, first version" },
  "m-3": { title: "The model's layout v6 in four rows" },
  "m-4": { title: "Technical energy report from the energy track" },
  "m-5": { title: "Zoning plan submitted to Lindesnes municipality" },
  "m-6": { title: "The plots are released for sale" },
};
const LABEL_EN: Record<string, string> = {
  Prosjekteier: "Project owner", Prosjektgruppen: "Project group", Energisporet: "Energy track", Markedssporet: "Market track",
  Plattformsporet: "Platform track", Oppstart: "Setup", Regulering: "Zoning", Kart: "Maps", Energi: "Energy", Nettside: "Website",
};

/**
 * The workspace as the English pages show it: the starter records in English, the common owner and topic
 * names too. What people have written or edited is shown as written.
 */
export function localizeWorkspace(ws: WorkspaceState, locale: "no" | "en"): WorkspaceState {
  if (locale === "no") return ws;
  const seed = seedWorkspace();
  const orig = new Map<string, { title: string; text?: string }>([...seed.tasks, ...seed.decisions, ...seed.milestones].map((x) => [x.id, x]));
  const tr = <R extends { id: string; title: string; text?: string }>(x: R): R => {
    const en = SEED_EN[x.id], o = orig.get(x.id);
    if (!en || !o) return x;
    return { ...x, title: x.title === o.title ? en.title : x.title, ...(en.text && x.text === o.text ? { text: en.text } : {}) };
  };
  const label = (s: string) => LABEL_EN[s] ?? s;
  return {
    tasks: ws.tasks.map((t) => ({ ...tr(t), owner: label(t.owner), topic: t.topic && label(t.topic) })),
    decisions: ws.decisions.map((d) => ({ ...tr(d), by: label(d.by) })),
    milestones: ws.milestones.map((m) => tr(m)),
  };
}

// ------------------------------------------------------------------ residents
export type Consents = { share_field: boolean; share_uia: boolean; allow_control: boolean; updated: string };
export const residents = store<{ consents: Record<string, Consents> }>("residents", () => ({ consents: {} }));

// ------------------------------------------------------------------ the buildings that stand today
export type Reading = { month: string; kwh: number };
export type Upgrade = { id: string; date: string; title: string; detail?: string; cost_nok?: number };
export type Building = { id: string; name: { no: string; en: string }; area_m2?: number; readings: Reading[]; upgrades: Upgrade[]; source?: string; updated?: string; public: boolean };
export const meters = store<{ buildings: Building[] }>("meters", () => ({
  buildings: [
    // shown on the public pages only when the owner ticks it: the house is a home, its use is personal
    { id: "office", name: { no: "Kontorbygget", en: "The office building" }, readings: [], upgrades: [], public: false },
    { id: "house", name: { no: "Boligen", en: "The house" }, readings: [], upgrades: [], public: false },
  ],
}));

/**
 * Reads a meter export (Elhub's "Måleverdier" download, a supplier's CSV, or a plain list of
 * months) and sums it per month. Accepts ; or , between columns and decimal commas. The date is
 * the first column that looks like one (31.12.2025, 2025-12-31 or 2025-12), the value the last
 * number on the line.
 */
export function parseMeterCsv(text: string): { readings: Reading[]; rows: number; skipped: number } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const sep = (lines.find((l) => /\d/.test(l)) ?? "").includes(";") ? ";" : lines.some((l) => l.includes("\t")) ? "\t" : ",";
  const sums = new Map<string, number>();
  let rows = 0, skipped = 0;
  for (const line of lines) {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    let month = "";
    for (const c of cells) {
      const no = c.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      const iso = c.match(/^(\d{4})-(\d{2})(-\d{2})?/);
      if (no) { month = `${no[3]}-${no[2].padStart(2, "0")}`; break; }
      if (iso) { month = `${iso[1]}-${iso[2]}`; break; }
    }
    const nums = cells.map((c) => c.replace(/\s/g, "")).filter((c) => /^-?\d+([.,]\d+)?$/.test(c) && !/^\d{4}$/.test(c));
    const value = nums.length ? Number(nums[nums.length - 1].replace(",", ".")) : NaN;
    if (!month || !Number.isFinite(value)) { skipped++; continue; }
    sums.set(month, (sums.get(month) ?? 0) + value);
    rows++;
  }
  const readings = [...sums.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, kwh]) => ({ month, kwh: Math.round(kwh) }));
  return { readings, rows, skipped };
}

/** Twelve months before and after a date: the honest first comparison, not corrected for weather. */
export function beforeAfter(readings: Reading[], date: string) {
  const m = date.slice(0, 7);
  const byMonth = new Map(readings.map((r) => [r.month, r.kwh]));
  const shift = (ym: string, d: number) => { const [y, mo] = ym.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return t.toISOString().slice(0, 7); };
  let before = 0, after = 0, pairs = 0;
  // twelve whole months after the work against the twelve before it; each window holds every calendar month once
  for (let i = 1; i <= 12; i++) {
    const a = byMonth.get(shift(m, i)), b = byMonth.get(shift(m, i - 13));
    if (a === undefined || b === undefined) continue;
    after += a; before += b; pairs++;
  }
  return pairs ? { before, after, pairs, change_pct: before ? ((after - before) / before) * 100 : 0 } : null;
}

export { now as nowIso };
