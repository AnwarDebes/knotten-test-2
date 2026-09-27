"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { LEAD_STATUSES, PLOT_STATUSES, newId, updateStore, type LeadStatus, type PlotStatus } from "@/lib/store";

/** Who is acting, and are they allowed to. Admins run the CRM; only super administrators touch users. */
async function actor(min: "admin" | "superadmin" = "admin") {
  const s = await getSession();
  const ok = s && (s.role === "superadmin" || (min === "admin" && s.role === "admin"));
  if (!ok) throw new Error("forbidden");
  return s.name || s.email || s.role;
}
const str = (fd: FormData, k: string, max = 400) => String(fd.get(k) ?? "").trim().slice(0, max);
const done = () => revalidatePath("/", "layout");

export async function setLeadStatus(fd: FormData) {
  const by = await actor();
  const id = str(fd, "id"), status = str(fd, "status") as LeadStatus;
  if (!LEAD_STATUSES.includes(status)) return;
  await updateStore(by, `lead ${id}: ${status}`, (s) => { const l = s.leads.find((x) => x.id === id); if (l) l.status = status; });
  done();
}

export async function addLeadNote(fd: FormData) {
  const by = await actor();
  const id = str(fd, "id"), text = str(fd, "text", 1000);
  if (!text) return;
  await updateStore(by, `note on ${id}`, (s) => { const l = s.leads.find((x) => x.id === id); if (l) l.notes.push({ at: new Date().toISOString(), by, text }); });
  done();
}

export async function deleteLead(fd: FormData) {
  const by = await actor();
  const id = str(fd, "id");
  await updateStore(by, `deleted lead ${id}`, (s) => { s.leads = s.leads.filter((x) => x.id !== id); });
  done();
}

export async function addLead(fd: FormData) {
  const by = await actor();
  const email = str(fd, "email", 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
  const purpose = str(fd, "purpose") as "buy" | "invest" | "partner" | "curious";
  await updateStore(by, `added lead ${email}`, (s) => {
    s.leads.push({ id: newId("lead"), name: str(fd, "name", 120), email, phone: str(fd, "phone", 40), purpose: ["buy", "invest", "partner", "curious"].includes(purpose) ? purpose : "curious", plots: str(fd, "plots", 200).split(/[\s,]+/).filter(Boolean).map((p) => (p.startsWith("plot-") ? p : `plot-${p}`)), consent_updates: true, consent_investor: purpose === "invest", consent_research: false, source: "admin", created: new Date().toISOString(), status: "contacted", notes: str(fd, "note", 1000) ? [{ at: new Date().toISOString(), by, text: str(fd, "note", 1000) }] : [] });
  });
  done();
}

export async function savePlot(fd: FormData) {
  const by = await actor();
  const id = str(fd, "id"), status = str(fd, "status") as PlotStatus;
  if (!PLOT_STATUSES.includes(status)) return;
  const price = Number(String(fd.get("price_nok") ?? "").replace(/[^\d]/g, ""));
  await updateStore(by, `plot ${id}: ${status}${price ? `, ${price} kr` : ""}`, (s) => {
    s.plots[id] = { id, status, price_nok: price || undefined, note: str(fd, "note", 300) || undefined, updated: new Date().toISOString() };
  });
  done();
}

export async function setAllPlots(fd: FormData) {
  const by = await actor();
  const status = str(fd, "status") as PlotStatus;
  const ids = str(fd, "ids", 4000).split(",").filter(Boolean);
  if (!PLOT_STATUSES.includes(status)) return;
  await updateStore(by, `all plots: ${status}`, (s) => {
    for (const id of ids) s.plots[id] = { ...(s.plots[id] ?? { id }), id, status, updated: new Date().toISOString() };
  });
  done();
}

export async function saveNews(fd: FormData) {
  const by = await actor();
  const id = str(fd, "id") || newId("n");
  const item = { id, date: str(fd, "date", 10) || new Date().toISOString().slice(0, 10), title: { no: str(fd, "title_no", 160), en: str(fd, "title_en", 160) }, text: { no: str(fd, "text_no", 2000), en: str(fd, "text_en", 2000) }, published: fd.get("published") === "on" };
  if (!item.title.no && !item.title.en) return;
  if (!item.title.en) item.title.en = item.title.no;
  if (!item.title.no) item.title.no = item.title.en;
  if (!item.text.en) item.text.en = item.text.no;
  if (!item.text.no) item.text.no = item.text.en;
  await updateStore(by, `news: ${item.title.no}`, (s) => {
    const i = s.news.findIndex((n) => n.id === id);
    if (i >= 0) s.news[i] = item; else s.news.unshift(item);
    s.news.sort((a, b) => b.date.localeCompare(a.date));
  });
  done();
}

export async function toggleNews(fd: FormData) {
  const by = await actor();
  const id = str(fd, "id");
  await updateStore(by, `news toggled ${id}`, (s) => { const n = s.news.find((x) => x.id === id); if (n) n.published = !n.published; });
  done();
}

export async function deleteNews(fd: FormData) {
  const by = await actor();
  const id = str(fd, "id");
  await updateStore(by, `news deleted ${id}`, (s) => { s.news = s.news.filter((x) => x.id !== id); });
  done();
}

export async function saveUser(fd: FormData) {
  const by = await actor("superadmin");
  const email = str(fd, "email", 200).toLowerCase();
  const role = str(fd, "role") as "user" | "admin" | "superadmin";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !["user", "admin", "superadmin"].includes(role)) return;
  await updateStore(by, `user ${email}: ${role}`, (s) => {
    const u = s.users.find((x) => x.email === email);
    if (u) { u.role = role; if (str(fd, "name", 80)) u.name = str(fd, "name", 80); }
    else s.users.push({ email, name: str(fd, "name", 80) || email.split("@")[0], role, added: new Date().toISOString().slice(0, 10) });
  });
  done();
}

export async function removeUser(fd: FormData) {
  const by = await actor("superadmin");
  const email = str(fd, "email", 200).toLowerCase();
  await updateStore(by, `user removed ${email}`, (s) => { s.users = s.users.filter((x) => x.email !== email); });
  done();
}

export async function saveSettings(fd: FormData) {
  const by = await actor();
  await updateStore(by, "settings saved", (s) => {
    s.settings = { release_note: { no: str(fd, "release_no", 300), en: str(fd, "release_en", 300) }, contact_email: str(fd, "contact_email", 200), contact_phone: str(fd, "contact_phone", 40), weekly_digest: fd.get("weekly_digest") === "on" };
  });
  done();
}

export async function removeExamples() {
  const by = await actor();
  await updateStore(by, "example leads removed", (s) => { s.leads = s.leads.filter((x) => x.source !== "eksempel"); });
  done();
}
