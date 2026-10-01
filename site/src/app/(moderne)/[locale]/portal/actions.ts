"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { actor, can, getRealSession, getSession, isAdmin, type Area, type Session } from "@/lib/auth";
import { AREAS, PREVIEWS, VIEW_COOKIE } from "@/lib/auth-shared";
import { newId, readStore, updateStore } from "@/lib/store";
import { FILES_ON, MAX_BYTES, prettySize, removeFile, saveFile, safeName } from "@/lib/server/files";
import { DOC_CATEGORIES, THREAD_AREAS, docs, meters, parseMeterCsv, residents, rid, threads, workspace, type Audience, type DocCategory, type ThreadArea } from "@/lib/server/records";
import { recordEvent } from "@/lib/server/stats";
import { internalDoc } from "@/lib/docRegister";
import { MAIL_ON, sendMail, siteOrigin } from "@/lib/server/mail";

/**
 * What people do inside the portal: share documents, ask and answer, keep the project's task
 * list, decisions and milestones, save consents, and bring in meter data. Every action checks
 * who is acting and whether they may, on its own; the pages' links are not a lock.
 */
export type ActionState = { error?: string; ok?: string; link?: string } | undefined;

const str = (fd: FormData, k: string, max = 400) => String(fd.get(k) ?? "").trim().slice(0, max);
const en = (fd: FormData) => fd.get("lang") === "en";
const say = (fd: FormData, no: string, eng: string) => (en(fd) ? eng : no);
const refresh = () => revalidatePath("/", "layout");
const who = (s: Session) => s.name || s.email;

/** The person acting, or null when they may not act here (no access, or an administrator's "view as" preview). */
async function tryActor(area: Area | "admin" | "superadmin" | "any") {
  const s = await getSession();
  if (!s || s.preview || (area !== "any" && !can(s, area))) return null;
  return s;
}

/** The answer when tryActor said no: a preview gets its own explanation. */
async function denied(fd: FormData, message: string): Promise<ActionState> {
  if ((await getSession())?.preview) return { error: say(fd, "Forhåndsvisning: du ser portalen som en annen, så endringer er slått av. Avslutt forhåndsvisningen øverst for å gjøre endringer.", "Preview: you are viewing the portal as someone else, so changes are switched off. End the preview at the top to make changes.") };
  return { error: message };
}

// ------------------------------------------------------------------ documents
function audienceFrom(fd: FormData, s: Session): Audience[] {
  const picked = fd.getAll("audience").map(String).filter((a): a is Audience => a === "all" || (AREAS as readonly string[]).includes(a));
  // people who are not administrators share within the areas they have themselves
  const allowed = isAdmin(s) ? picked : picked.filter((a) => a !== "all" && s.areas.includes(a));
  return allowed.length ? allowed : isAdmin(s) ? ["all"] : [s.areas[0] ?? "project"];
}

export async function uploadDoc(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await tryActor("any");
  if (!s || !(isAdmin(s) || can(s, "project"))) return denied(fd, say(fd, "Du har ikke tilgang til å laste opp dokumenter.", "You may not upload documents."));
  if (!FILES_ON) return { error: say(fd, "Filer kan ikke lagres før en fillagring er satt opp (Vercel Blob). Se Innstillinger.", "Files cannot be stored until file storage is set up (Vercel Blob). See Settings.") };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: say(fd, "Velg en fil.", "Choose a file.") };
  if (file.size > MAX_BYTES) return { error: say(fd, `Filen er for stor. Største tillatte størrelse er ${prettySize(MAX_BYTES)}.`, `The file is too large. The limit is ${prettySize(MAX_BYTES, false)}.`) };
  // one of the documents the public bank lists: filed under its title, as a new version if it is there already
  const reg = isAdmin(s) ? internalDoc(str(fd, "register", 40)) : undefined;
  const existing = reg ? (await docs.read()).docs.find((d) => d.register === reg.key) : undefined;
  const replace = str(fd, "replace", 60) || existing?.id || "";
  const id = replace || rid("doc");
  const key = await saveFile(`${id}-v${Date.now().toString(36)}`, file);
  const ext = file.name.match(/\.[a-z0-9]{1,6}$/i)?.[0]?.toLowerCase() ?? "";
  const stored = { key, name: reg ? safeName(`${reg.title.no}${ext}`) : safeName(file.name), size: file.size, type: file.type || "application/octet-stream" };
  const title = str(fd, "title", 160) || reg?.title.no || stored.name.replace(/\.[a-z0-9]+$/i, "");
  const category = (DOC_CATEGORIES as readonly string[]).includes(str(fd, "category")) ? (str(fd, "category") as DocCategory) : "other";
  const result = await docs.change((st) => {
    const old = st.docs.find((d) => d.id === replace);
    if (old) {
      if (!isAdmin(s) && old.by !== who(s)) return "forbidden";
      old.previous = [{ ...old.file, version: old.version, uploaded: old.uploaded, by: old.by }, ...old.previous].slice(0, 20);
      old.file = stored;
      old.version += 1;
      old.uploaded = new Date().toISOString();
      old.by = who(s);
      return "version";
    }
    st.docs.unshift({ id, title, description: str(fd, "description", 600) || reg?.what.no || undefined, category, audience: audienceFrom(fd, s), plot: str(fd, "plot", 10) || undefined, register: reg?.key, file: stored, version: 1, previous: [], uploaded: new Date().toISOString(), by: who(s), downloads: 0 });
    return "new";
  });
  if (result === "forbidden") {
    await removeFile(key);
    return { error: say(fd, "Bare den som lastet opp dokumentet, eller en administrator, kan laste opp en ny versjon.", "Only the uploader or an administrator can add a new version.") };
  }
  refresh();
  return { ok: result === "version" ? say(fd, "Ny versjon lastet opp.", "New version uploaded.") : say(fd, `«${title}» er lastet opp.`, `"${title}" is uploaded.`) };
}

export async function updateDoc(fd: FormData) {
  const s = await actor("admin");
  const id = str(fd, "id", 60);
  await docs.change((st) => {
    const d = st.docs.find((x) => x.id === id);
    if (!d) return;
    d.title = str(fd, "title", 160) || d.title;
    d.description = str(fd, "description", 600) || undefined;
    const c = str(fd, "category");
    if ((DOC_CATEGORIES as readonly string[]).includes(c)) d.category = c as DocCategory;
    d.audience = audienceFrom(fd, s);
    d.plot = str(fd, "plot", 10) || undefined;
  });
  refresh();
}

export async function deleteDoc(fd: FormData) {
  await actor("admin");
  const id = str(fd, "id", 60);
  const gone = await docs.change((st) => {
    const d = st.docs.find((x) => x.id === id);
    st.docs = st.docs.filter((x) => x.id !== id);
    return d;
  });
  if (gone) for (const f of [gone.file, ...gone.previous]) await removeFile(f.key);
  refresh();
}

// ------------------------------------------------------------------ questions, comments and requests
const AREA_NAME: Record<ThreadArea, string> = { investor: "datarommet", municipality: "kommunerommet", resident: "beboerportalen", project: "prosjektrommet", research: "forskningsrommet" };

export async function startThread(_: ActionState, fd: FormData): Promise<ActionState> {
  const area = str(fd, "area") as ThreadArea;
  if (!(THREAD_AREAS as readonly string[]).includes(area)) return { error: "?" };
  const s = await tryActor(area);
  if (!s) return denied(fd, say(fd, "Du har ikke tilgang til dette området.", "You do not have access to this area."));
  const subject = str(fd, "subject", 160), text = str(fd, "text", 4000);
  if (!subject || !text) return { error: say(fd, "Skriv både emne og melding.", "Write both a subject and a message.") };
  const at = new Date().toISOString();
  await threads.change((st) => {
    st.threads.unshift({ id: rid("q"), area, subject, plot: area === "resident" ? s.plot : undefined, created: at, uid: s.id, name: who(s), org: s.org, shared: false, lang: en(fd) ? "en" : "no", status: "open", messages: [{ at, uid: s.id, name: who(s), staff: isAdmin(s), text }] });
  });
  await recordEvent(`question_${area}`);
  if (MAIL_ON && !isAdmin(s)) {
    const { settings } = await readStore();
    await sendMail(settings.contact_email, `Ny henvendelse i ${AREA_NAME[area]}: ${subject}`, `${who(s)}${s.org ? ` (${s.org})` : ""} skrev:\n\n${text}\n\nSvar i portalen: ${await siteOrigin()}/no/portal/${area === "investor" ? "investor" : area === "resident" ? "resident" : area}`);
  }
  refresh();
  return { ok: isAdmin(s) ? say(fd, "Lagt inn.", "Posted.") : MAIL_ON ? say(fd, "Sendt. Svaret kommer her, og du får beskjed på e-post.", "Sent. The answer comes here, and you will be told by email.") : say(fd, "Sendt. Svaret kommer her i portalen.", "Sent. The answer comes here in the portal.") };
}

export async function replyThread(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await tryActor("any");
  if (!s) return denied(fd, say(fd, "Du har ikke tilgang til denne tråden.", "You do not have access to this thread."));
  const id = str(fd, "id", 60), text = str(fd, "text", 4000);
  if (!text) return { error: say(fd, "Skriv et svar.", "Write a reply.") };
  const asker = await threads.change((st) => {
    const t = st.threads.find((x) => x.id === id);
    if (!t || !(isAdmin(s) || t.uid === s.id)) return null;
    t.messages.push({ at: new Date().toISOString(), uid: s.id, name: who(s), staff: isAdmin(s), text });
    t.status = isAdmin(s) && t.uid !== s.id ? "answered" : "open";
    return t.uid !== s.id ? t : null;
  });
  if (asker && MAIL_ON) {
    const { loadAuth, findById } = await import("@/lib/server/accounts");
    const to = findById(await loadAuth(), asker.uid);
    const origin = await siteOrigin();
    if (to && asker.lang === "en") await sendMail(to.email, `Reply: ${asker.subject}`, `${who(s)} has replied to your message in the Knotten portal:\n\n${text}\n\n${origin}/en/portal`);
    else if (to) await sendMail(to.email, `Svar: ${asker.subject}`, `${who(s)} har svart på henvendelsen din i Knotten-portalen:\n\n${text}\n\n${origin}/no/portal`);
  }
  refresh();
  return { ok: say(fd, "Svaret er lagt inn.", "Reply posted.") };
}

export async function setThread(fd: FormData) {
  await actor("admin");
  const id = str(fd, "id", 60), op = str(fd, "op", 20);
  await threads.change((st) => {
    const t = st.threads.find((x) => x.id === id);
    if (!t) return;
    if (op === "share") t.shared = !t.shared;
    if (op === "close") t.status = "closed";
    if (op === "open") t.status = "open";
    if (op === "delete") st.threads = st.threads.filter((x) => x.id !== id);
  });
  refresh();
}

// ------------------------------------------------------------------ the project workspace
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await tryActor("project");
  if (!s) return denied(fd, say(fd, "Ingen tilgang.", "No access."));
  const title = str(fd, "title", 200);
  if (!title) return { error: say(fd, "Skriv hva som skal gjøres.", "Write what needs doing.") };
  const id = str(fd, "id", 40);
  const pr = str(fd, "priority");
  const priority = pr === "high" || pr === "low" ? pr : "medium";
  const due = DATE.test(str(fd, "due")) ? str(fd, "due") : undefined;
  await workspace.change((w) => {
    const t = w.tasks.find((x) => x.id === id);
    if (t) Object.assign(t, { title, owner: str(fd, "owner", 80) || t.owner, priority, due, topic: str(fd, "topic", 40) || undefined });
    else w.tasks.unshift({ id: rid("t"), title, owner: str(fd, "owner", 80) || who(s), priority, due, topic: str(fd, "topic", 40) || undefined, status: "todo", created: new Date().toISOString(), by: who(s) });
  });
  refresh();
  return { ok: say(fd, "Lagret.", "Saved.") };
}

export async function setTaskStatus(fd: FormData) {
  await actor("project");
  const id = str(fd, "id", 40), st = str(fd, "status");
  if (st !== "todo" && st !== "doing" && st !== "done") return;
  await workspace.change((w) => {
    const t = w.tasks.find((x) => x.id === id);
    if (t) { t.status = st; t.done_at = st === "done" ? new Date().toISOString() : undefined; }
  });
  refresh();
}

export async function deleteTask(fd: FormData) {
  await actor("project");
  const id = str(fd, "id", 40);
  await workspace.change((w) => { w.tasks = w.tasks.filter((x) => x.id !== id); });
  refresh();
}

export async function saveDecision(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await tryActor("project");
  if (!s) return denied(fd, say(fd, "Ingen tilgang.", "No access."));
  const title = str(fd, "title", 200);
  if (!title) return { error: say(fd, "Skriv beslutningen.", "Write the decision.") };
  await workspace.change((w) => {
    w.decisions.unshift({ id: rid("d"), date: DATE.test(str(fd, "date")) ? str(fd, "date") : new Date().toISOString().slice(0, 10), title, text: str(fd, "text", 2000), by: str(fd, "by", 80) || who(s), created: new Date().toISOString() });
    w.decisions.sort((a, b) => b.date.localeCompare(a.date));
  });
  refresh();
  return { ok: say(fd, "Beslutningen er ført i loggen.", "The decision is logged.") };
}

export async function deleteDecision(fd: FormData) {
  await actor("admin");
  const id = str(fd, "id", 40);
  await workspace.change((w) => { w.decisions = w.decisions.filter((x) => x.id !== id); });
  refresh();
}

export async function saveMilestone(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await tryActor("project");
  if (!s) return denied(fd, say(fd, "Ingen tilgang.", "No access."));
  const title = str(fd, "title", 200);
  if (!title) return { error: say(fd, "Skriv milepælen.", "Write the milestone.") };
  const st = str(fd, "status");
  const status = st === "done" || st === "next" ? st : "later";
  const id = str(fd, "id", 40);
  await workspace.change((w) => {
    const m = w.milestones.find((x) => x.id === id);
    const date = DATE.test(str(fd, "date")) ? str(fd, "date") : undefined;
    if (m) Object.assign(m, { title, detail: str(fd, "detail", 600) || undefined, status, date });
    else w.milestones.push({ id: rid("m"), title, detail: str(fd, "detail", 600) || undefined, status, date, public: false });
  });
  refresh();
  return { ok: say(fd, "Lagret.", "Saved.") };
}

export async function deleteMilestone(fd: FormData) {
  await actor("project");
  const id = str(fd, "id", 40);
  await workspace.change((w) => { w.milestones = w.milestones.filter((x) => x.id !== id); });
  refresh();
}

/** Put a reached milestone on the website's news page, or take it down again. Administrators only. */
export async function publishMilestone(fd: FormData) {
  const s = await actor("admin");
  const id = str(fd, "id", 40);
  const w = await workspace.read();
  const m = w.milestones.find((x) => x.id === id);
  if (!m) return;
  if (m.news_id) {
    const newsId = m.news_id;
    await updateStore(who(s), `nyhet tatt ned: ${m.title}`, (st) => { const n = st.news.find((x) => x.id === newsId); if (n) n.published = !n.published; });
  } else {
    const newsId = newId("n");
    const date = m.date ?? new Date().toISOString().slice(0, 10);
    await updateStore(who(s), `milepæl publisert: ${m.title}`, (st) => {
      st.news.unshift({ id: newsId, date, published: true, title: { no: m.title, en: m.title }, text: { no: m.detail ?? m.title, en: m.detail ?? m.title } });
      st.news.sort((a, b) => b.date.localeCompare(a.date));
    });
    await workspace.change((ws) => { const x = ws.milestones.find((y) => y.id === id); if (x) { x.news_id = newsId; x.public = true; } });
  }
  refresh();
}

// ------------------------------------------------------------------ residents
export async function saveConsents(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await tryActor("resident");
  if (!s) return denied(fd, say(fd, "Ingen tilgang.", "No access."));
  await residents.change((r) => {
    r.consents[s.id] = { share_field: fd.get("share_field") === "on", share_uia: fd.get("share_uia") === "on", allow_control: fd.get("allow_control") === "on", updated: new Date().toISOString() };
  });
  refresh();
  return { ok: say(fd, "Samtykkene er lagret. Du kan endre dem når som helst.", "Your consents are saved. You can change them at any time.") };
}

// ------------------------------------------------------------------ meters for the buildings on the property
export async function importReadings(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await tryActor("admin");
  if (!s) return denied(fd, say(fd, "Bare administratorer kan legge inn målerdata.", "Only administrators can add meter data."));
  const id = str(fd, "building", 40);
  const file = fd.get("file");
  const text = file instanceof File && file.size ? await file.text() : String(fd.get("text") ?? "");
  if (!text.trim()) return { error: say(fd, "Velg en fil eller lim inn tallene.", "Choose a file or paste the figures.") };
  if (text.length > 8_000_000) return { error: say(fd, "Filen er for stor.", "The file is too large.") };
  const { readings, rows, skipped } = parseMeterCsv(text);
  if (!readings.length) return { error: say(fd, "Fant ingen datoer og tall i filen. Forventet format: dato og kWh per linje, for eksempel 01.01.2025;1234,5.", "Found no dates and figures. Expected: a date and kWh per line, e.g. 2025-01-01,1234.5.") };
  const ok = await meters.change((m) => {
    const b = m.buildings.find((x) => x.id === id);
    if (!b) return false;
    const map = new Map(b.readings.map((r) => [r.month, r.kwh]));
    for (const r of readings) map.set(r.month, r.kwh);
    b.readings = [...map.entries()].sort((a, c) => a[0].localeCompare(c[0])).map(([month, kwh]) => ({ month, kwh }));
    b.source = str(fd, "source", 160) || (file instanceof File ? file.name : say(fd, "lagt inn for hånd", "entered by hand"));
    b.updated = new Date().toISOString();
    return true;
  });
  if (!ok) return { error: "?" };
  refresh();
  const first = readings[0].month, last = readings[readings.length - 1].month;
  return { ok: say(fd, `${readings.length} måneder lest inn (${first} til ${last}) fra ${rows} linjer${skipped ? `; ${skipped} linjer uten dato eller tall ble hoppet over` : ""}.`, `${readings.length} months read (${first} to ${last}) from ${rows} lines${skipped ? `; ${skipped} lines without a date or figure were skipped` : ""}.`) };
}

export async function addUpgrade(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await tryActor("admin");
  if (!s) return denied(fd, say(fd, "Bare administratorer kan registrere tiltak.", "Only administrators can register upgrades."));
  const id = str(fd, "building", 40), title = str(fd, "title", 160), date = str(fd, "date", 10);
  if (!title || !DATE.test(date)) return { error: say(fd, "Skriv hva som ble gjort og når.", "Write what was done and when.") };
  const cost = Number(str(fd, "cost").replace(/[^\d]/g, "")) || undefined;
  await meters.change((m) => {
    const b = m.buildings.find((x) => x.id === id);
    if (b) { b.upgrades.push({ id: rid("u"), date, title, detail: str(fd, "detail", 600) || undefined, cost_nok: cost }); b.upgrades.sort((a, c) => a.date.localeCompare(c.date)); }
  });
  refresh();
  return { ok: say(fd, "Tiltaket er lagt inn.", "The upgrade is added.") };
}

export async function removeUpgrade(fd: FormData) {
  await actor("admin");
  const id = str(fd, "building", 40), uid = str(fd, "id", 40);
  await meters.change((m) => { const b = m.buildings.find((x) => x.id === id); if (b) b.upgrades = b.upgrades.filter((u) => u.id !== uid); });
  refresh();
}

export async function saveBuilding(fd: FormData) {
  await actor("admin");
  const id = str(fd, "building", 40);
  const area = Number(str(fd, "area_m2").replace(",", ".")) || undefined;
  await meters.change((m) => { const b = m.buildings.find((x) => x.id === id); if (b) { b.area_m2 = area; b.public = fd.get("public") === "on"; } });
  refresh();
}

export async function clearReadings(fd: FormData) {
  await actor("admin");
  const id = str(fd, "building", 40);
  await meters.change((m) => { const b = m.buildings.find((x) => x.id === id); if (b) { b.readings = []; b.source = undefined; b.updated = new Date().toISOString(); } });
  refresh();
}

// ------------------------------------------------------------------ "view as": see the portal as someone else
/** An administrator looks at the portal as an investor, the municipality, a researcher, the project group or a resident. */
export async function startPreview(fd: FormData) {
  const real = await getRealSession();
  if (!real || !isAdmin(real)) throw new Error("forbidden");
  const id = str(fd, "id", 20);
  const p = PREVIEWS.find((x) => x.id === id);
  const locale = str(fd, "lang") === "en" ? "en" : "no";
  if (!p) return;
  const plot = /^plot-\d{2}$/.test(str(fd, "plot", 10)) ? str(fd, "plot", 10) : undefined;
  (await cookies()).set(VIEW_COOKIE, JSON.stringify({ id: p.id, plot }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 2 * 3600 });
  redirect(`/${locale}/portal${p.path}`);
}

export async function endPreview(fd: FormData) {
  (await cookies()).delete(VIEW_COOKIE);
  const locale = str(fd, "lang") === "en" ? "en" : "no";
  redirect(`/${locale}/portal`);
}
