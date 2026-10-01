"use server";
import { revalidatePath } from "next/cache";
import { actor, type Session } from "@/lib/auth";
import { AREAS, type AccountRole, type Area } from "@/lib/auth-shared";
import { KPI_KEYS, LEAD_STATUSES, PLOT_STATUSES, newId, readStore, updateStore, type KpiTargets, type LeadStatus, type PlotStatus } from "@/lib/store";
import { buildDigest } from "@/lib/server/digest";
import { audit, changeAuth, findByEmail, findById, issueLink, newAccountId } from "@/lib/server/accounts";
import { MAIL_ON, sendMail, siteOrigin } from "@/lib/server/mail";

/** The administration: leads, plots, news, settings, and who may use the portal. */
export type AdminState = { error?: string; ok?: string; link?: string } | undefined;

const str = (fd: FormData, k: string, max = 400) => String(fd.get(k) ?? "").trim().slice(0, max);
const en = (fd: FormData) => fd.get("lang") === "en";
const say = (fd: FormData, no: string, eng: string) => (en(fd) ? eng : no);
const done = () => revalidatePath("/", "layout");
const by = (s: Session) => s.name || s.email;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ------------------------------------------------------------------ leads
export async function setLeadStatus(fd: FormData) {
  const s = await actor();
  const id = str(fd, "id"), status = str(fd, "status") as LeadStatus;
  if (!LEAD_STATUSES.includes(status)) return;
  await updateStore(by(s), `interessent ${id}: ${status}`, (st) => {
    const l = st.leads.find((x) => x.id === id);
    if (!l) return;
    if (l.status === "new" && status !== "new" && !l.replied) l.replied = new Date().toISOString();
    l.status = status;
  });
  done();
}

export async function addLeadNote(fd: FormData) {
  const s = await actor();
  const id = str(fd, "id"), text = str(fd, "text", 1000);
  if (!text) return;
  await updateStore(by(s), `notat på ${id}`, (st) => {
    const l = st.leads.find((x) => x.id === id);
    if (!l) return;
    l.notes.push({ at: new Date().toISOString(), by: by(s), text });
    l.replied ??= new Date().toISOString();
  });
  done();
}

/** Suppliers, job seekers and spam stay in the list but are left out of the figures. */
export async function toggleExcluded(fd: FormData) {
  const s = await actor();
  const id = str(fd, "id");
  await updateStore(by(s), `interessent ${id}: telles/telles ikke`, (st) => { const l = st.leads.find((x) => x.id === id); if (l) l.excluded = !l.excluded; });
  done();
}

export async function deleteLead(fd: FormData) {
  const s = await actor();
  const id = str(fd, "id");
  await updateStore(by(s), `slettet interessent ${id}`, (st) => { st.leads = st.leads.filter((x) => x.id !== id); });
  done();
}

export async function addLead(fd: FormData) {
  const s = await actor();
  const email = str(fd, "email", 200);
  if (!EMAIL.test(email)) return;
  const purpose = str(fd, "purpose") as "buy" | "invest" | "partner" | "curious";
  const at = new Date().toISOString();
  const note = str(fd, "note", 1000);
  await updateStore(by(s), `la inn interessent ${email}`, (st) => {
    st.leads.push({ id: newId("lead"), name: str(fd, "name", 120), email, phone: str(fd, "phone", 40), purpose: ["buy", "invest", "partner", "curious"].includes(purpose) ? purpose : "curious", plots: str(fd, "plots", 200).split(/[\s,]+/).filter(Boolean).map((p) => (p.startsWith("plot-") ? p : `plot-${p.padStart(2, "0")}`)), consent_updates: true, consent_investor: purpose === "invest", consent_research: false, source: "admin", created: at, status: "contacted", replied: at, notes: note ? [{ at, by: by(s), text: note }] : [] });
  });
  done();
}

export async function removeExamples() {
  const s = await actor();
  await updateStore(by(s), "eksempelinteressenter fjernet", (st) => { st.leads = st.leads.filter((x) => x.source !== "eksempel"); });
  done();
}

// ------------------------------------------------------------------ plots
export async function savePlot(fd: FormData) {
  const s = await actor();
  const id = str(fd, "id"), status = str(fd, "status") as PlotStatus;
  if (!PLOT_STATUSES.includes(status)) return;
  const price = Number(String(fd.get("price_nok") ?? "").replace(/[^\d]/g, ""));
  await updateStore(by(s), `tomt ${id}: ${status}${price ? `, ${price} kr` : ""}`, (st) => {
    st.plots[id] = { id, status, price_nok: price || undefined, note: str(fd, "note", 300) || undefined, updated: new Date().toISOString() };
  });
  done();
}

export async function setAllPlots(fd: FormData) {
  const s = await actor();
  const status = str(fd, "status") as PlotStatus;
  const ids = str(fd, "ids", 4000).split(",").filter(Boolean);
  if (!PLOT_STATUSES.includes(status)) return;
  await updateStore(by(s), `alle tomter: ${status}`, (st) => {
    for (const id of ids) st.plots[id] = { ...(st.plots[id] ?? { id }), id, status, updated: new Date().toISOString() };
  });
  done();
}

// ------------------------------------------------------------------ news
export async function saveNews(fd: FormData) {
  const s = await actor();
  const id = str(fd, "id") || newId("n");
  const item = { id, date: str(fd, "date", 10) || new Date().toISOString().slice(0, 10), title: { no: str(fd, "title_no", 160), en: str(fd, "title_en", 160) }, text: { no: str(fd, "text_no", 2000), en: str(fd, "text_en", 2000) }, published: fd.get("published") === "on" };
  if (!item.title.no && !item.title.en) return;
  if (!item.title.en) item.title.en = item.title.no;
  if (!item.title.no) item.title.no = item.title.en;
  if (!item.text.en) item.text.en = item.text.no;
  if (!item.text.no) item.text.no = item.text.en;
  await updateStore(by(s), `nyhet: ${item.title.no}`, (st) => {
    const i = st.news.findIndex((n) => n.id === id);
    if (i >= 0) st.news[i] = item; else st.news.unshift(item);
    st.news.sort((a, b) => b.date.localeCompare(a.date));
  });
  done();
}

export async function toggleNews(fd: FormData) {
  const s = await actor();
  const id = str(fd, "id");
  await updateStore(by(s), `nyhet vist/skjult ${id}`, (st) => { const n = st.news.find((x) => x.id === id); if (n) n.published = !n.published; });
  done();
}

export async function deleteNews(fd: FormData) {
  const s = await actor();
  const id = str(fd, "id");
  await updateStore(by(s), `nyhet slettet ${id}`, (st) => { st.news = st.news.filter((x) => x.id !== id); });
  done();
}

// ------------------------------------------------------------------ settings and targets
export async function saveSettings(fd: FormData) {
  const s = await actor();
  await updateStore(by(s), "innstillinger lagret", (st) => {
    st.settings = { ...st.settings, release_note: { no: str(fd, "release_no", 300), en: str(fd, "release_en", 300) }, contact_email: str(fd, "contact_email", 200), contact_phone: str(fd, "contact_phone", 40), weekly_digest: fd.get("weekly_digest") === "on", digest_lang: str(fd, "digest_lang") === "en" ? "en" : "no" };
  });
  done();
}

/** Send this week's summary now, to check how it looks in the inbox. */
export async function sendDigestNow(_: AdminState, fd: FormData): Promise<AdminState> {
  await actor();
  if (!MAIL_ON) return { error: say(fd, "E-post er ikke satt opp ennå (RESEND_API_KEY og MAIL_FROM). Forhåndsvisningen over viser innholdet.", "Email is not set up yet (RESEND_API_KEY and MAIL_FROM). The preview above shows the content.") };
  const { settings } = await readStore();
  const lang = settings.digest_lang ?? "no";
  const d = await buildDigest(lang);
  const ok = await sendMail(settings.contact_email, `${lang === "en" ? "[Test]" : "[Prøve]"} ${d.subject}`, d.text);
  return ok ? { ok: say(fd, `Sendt til ${settings.contact_email}.`, `Sent to ${settings.contact_email}.`) } : { error: say(fd, "Sendingen feilet. Sjekk e-postoppsettet.", "Sending failed. Check the email setup.") };
}

/** The owner's targets for the success criteria; an empty field means "not set yet". */
export async function saveTargets(fd: FormData) {
  const s = await actor();
  const kpi: KpiTargets = {};
  for (const k of KPI_KEYS) {
    const v = Number(str(fd, k, 20).replace(",", "."));
    if (str(fd, k) && Number.isFinite(v) && v >= 0) kpi[k] = v;
  }
  await updateStore(by(s), "mål for nøkkeltall lagret", (st) => { st.settings.kpi = kpi; });
  done();
}

// ------------------------------------------------------------------ users and access
/**
 * Who may manage whom: administrators manage users; super administrators also manage
 * administrators and other super administrators. Nobody changes their own role or locks
 * themselves out, and there is always at least one active super administrator.
 */
function mayManage(me: Session, target: { role: AccountRole }, newRole?: AccountRole) {
  if (me.role === "superadmin") return true;
  return target.role === "user" && (!newRole || newRole === "user");
}

function areasFrom(fd: FormData): Area[] {
  return fd.getAll("areas").map(String).filter((a): a is Area => (AREAS as readonly string[]).includes(a));
}

async function linkFor(uid: string, kind: "invite" | "reset", me: Session, locale: string) {
  const { token, hours } = await issueLink(uid, kind, me.email);
  return { url: `${await siteOrigin()}/${locale === "en" ? "en" : "no"}/login/passord?token=${token}`, hours };
}

export async function inviteUser(_: AdminState, fd: FormData): Promise<AdminState> {
  const me = await actor();
  const email = str(fd, "email", 200).toLowerCase();
  const name = str(fd, "name", 80);
  const role = (["user", "admin", "superadmin"].includes(str(fd, "role")) ? str(fd, "role") : "user") as AccountRole;
  if (!EMAIL.test(email)) return { error: say(fd, "Skriv en gyldig e-postadresse.", "Enter a valid email address.") };
  if (!name) return { error: say(fd, "Skriv navnet.", "Enter the name.") };
  if (!mayManage(me, { role }, role)) return { error: say(fd, "Bare en superadministrator kan invitere administratorer.", "Only a super administrator can invite administrators.") };
  const areas = role === "user" ? areasFrom(fd) : [...AREAS];
  if (role === "user" && !areas.length) return { error: say(fd, "Velg minst ett område personen skal ha tilgang til.", "Choose at least one area.") };
  const plot = /^plot-\d{2}$/.test(str(fd, "plot")) ? str(fd, "plot") : undefined;
  const result = await changeAuth((st) => {
    const existing = findByEmail(st, email);
    if (existing && existing.status !== "invited") return { taken: true as const };
    if (existing) {
      Object.assign(existing, { name, role, areas, plot, org: str(fd, "org", 120) || undefined });
      audit(st, me.email, `invitasjon fornyet for ${email}`);
      return { id: existing.id };
    }
    const id = newAccountId();
    st.accounts.push({ id, email, name, role, areas, plot, org: str(fd, "org", 120) || undefined, status: "invited", created: new Date().toISOString(), created_by: me.email, logins: 0, sv: 1 });
    audit(st, me.email, `inviterte ${email} som ${role}${role === "user" ? ` (${areas.join(", ")})` : ""}`);
    return { id };
  });
  if ("taken" in result) return { error: say(fd, "Det finnes allerede en aktiv konto med denne e-postadressen.", "An active account with this email already exists.") };
  const { url, hours } = await linkFor(result.id, "invite", me, str(fd, "lang") || "no");
  const days = Math.round(hours / 24);
  // the email is in the language the invitation was sent from, like the link it carries
  const first = name.split(" ")[0];
  const mailed = MAIL_ON && (await sendMail(
    email,
    say(fd, "Invitasjon til Knotten-portalen", "Invitation to the Knotten portal"),
    say(fd,
      `Hei ${first},\n\n${by(me)} har gitt deg tilgang til prosjektportalen for Knotten.\n\nVelg passord her (lenken gjelder i ${days} dager):\n${url}\n\nVennlig hilsen\nKnotten`,
      `Hi ${first},\n\n${by(me)} has given you access to the Knotten project portal.\n\nChoose a password here (the link lasts ${days} days):\n${url}\n\nKind regards\nKnotten`),
  ));
  done();
  return mailed
    ? { ok: say(fd, `Invitasjonen er sendt til ${email}.`, `The invitation is emailed to ${email}.`) }
    : { ok: say(fd, `${name} er lagt inn. Send lenken under til ${email}; den gjelder i ${days} dager og vises bare nå.`, `${name} is added. Send the link below to ${email}; it lasts ${days} days and is shown only now.`), link: url };
}

export async function updateUser(_: AdminState, fd: FormData): Promise<AdminState> {
  const me = await actor();
  const id = str(fd, "id", 40);
  const role = (["user", "admin", "superadmin"].includes(str(fd, "role")) ? str(fd, "role") : "user") as AccountRole;
  const out = await changeAuth((st) => {
    const a = findById(st, id);
    if (!a) return "missing";
    if (a.id === me.id && role !== a.role) return "self";
    if (!mayManage(me, a, role)) return "forbidden";
    if (a.role === "superadmin" && role !== "superadmin" && st.accounts.filter((x) => x.role === "superadmin" && x.status === "active").length <= 1 && a.status === "active") return "last";
    const areas = role === "user" ? areasFrom(fd) : [...AREAS];
    a.role = role;
    a.areas = areas;
    a.name = str(fd, "name", 80) || a.name;
    a.org = str(fd, "org", 120) || undefined;
    a.plot = /^plot-\d{2}$/.test(str(fd, "plot")) ? str(fd, "plot") : undefined;
    audit(st, me.email, `endret ${a.email}: ${role}${role === "user" ? ` (${areas.join(", ") || "ingen områder"})` : ""}`);
    return "ok";
  });
  if (out === "self") return { error: say(fd, "Du kan ikke endre din egen rolle.", "You cannot change your own role.") };
  if (out === "forbidden") return { error: say(fd, "Bare en superadministrator kan endre administratorer.", "Only a super administrator can change administrators.") };
  if (out === "last") return { error: say(fd, "Det må finnes minst én aktiv superadministrator.", "There must be at least one active super administrator.") };
  if (out === "missing") return { error: "?" };
  done();
  return { ok: say(fd, "Lagret.", "Saved.") };
}

export async function setUserStatus(fd: FormData) {
  const me = await actor();
  const id = str(fd, "id", 40), op = str(fd, "op", 20);
  await changeAuth((st) => {
    const a = findById(st, id);
    if (!a || a.id === me.id || !mayManage(me, a)) return;
    if (op === "disable") {
      if (a.role === "superadmin" && st.accounts.filter((x) => x.role === "superadmin" && x.status === "active").length <= 1) return;
      a.status = "disabled";
      a.sv += 1; // ends the person's sessions at once
      st.tokens = st.tokens.filter((t) => t.uid !== a.id);
      audit(st, me.email, `deaktiverte ${a.email}`);
    }
    if (op === "enable" && a.status === "disabled") {
      a.status = a.password ? "active" : "invited";
      audit(st, me.email, `aktiverte ${a.email} igjen`);
    }
    if (op === "delete") {
      if (a.role === "superadmin" && st.accounts.filter((x) => x.role === "superadmin" && x.status === "active").length <= 1 && a.status === "active") return;
      st.accounts = st.accounts.filter((x) => x.id !== a.id);
      st.tokens = st.tokens.filter((t) => t.uid !== a.id);
      audit(st, me.email, `slettet kontoen til ${a.email}`);
    }
  });
  done();
}

/** A new link: an invitation for someone who never chose a password, a password link otherwise. */
export async function userLink(_: AdminState, fd: FormData): Promise<AdminState> {
  const me = await actor();
  const id = str(fd, "id", 40);
  const { loadAuth } = await import("@/lib/server/accounts");
  const a = findById(await loadAuth(), id);
  if (!a || !mayManage(me, a) || a.status === "disabled") return { error: say(fd, "Ikke mulig for denne kontoen.", "Not possible for this account.") };
  const kind = a.status === "invited" ? "invite" : "reset";
  const { url, hours } = await linkFor(a.id, kind, me, str(fd, "lang") || "no");
  if (kind === "reset") await changeAuth((st) => { st.reset_requests = st.reset_requests.filter((r) => r.email !== a.email); });
  const first = a.name.split(" ")[0];
  const valid = hours >= 48 ? say(fd, `${Math.round(hours / 24)} dager`, `${Math.round(hours / 24)} days`) : say(fd, `${hours} timer`, `${hours} hours`);
  const mailed = MAIL_ON && (await sendMail(
    a.email,
    kind === "invite" ? say(fd, "Invitasjon til Knotten-portalen", "Invitation to the Knotten portal") : say(fd, "Nytt passord i Knotten-portalen", "New password for the Knotten portal"),
    say(fd,
      `Hei ${first},\n\n${kind === "invite" ? "Velg passord her" : "Velg nytt passord her"} (lenken gjelder i ${valid}):\n${url}\n\nKnotten`,
      `Hi ${first},\n\n${kind === "invite" ? "Choose a password here" : "Choose a new password here"} (the link lasts ${valid}):\n${url}\n\nKnotten`),
  ));
  done();
  return mailed ? { ok: say(fd, `Lenken er sendt til ${a.email}.`, `The link is emailed to ${a.email}.`) } : { ok: say(fd, `Send lenken til ${a.email}. Den vises bare nå.`, `Send the link to ${a.email}. It is shown only now.`), link: url };
}

export async function dismissResetRequest(fd: FormData) {
  const me = await actor();
  const email = str(fd, "email", 200);
  await changeAuth((st) => { st.reset_requests = st.reset_requests.filter((r) => r.email !== email); audit(st, me.email, `avviste forespørsel om nytt passord fra ${email}`); });
  done();
}
