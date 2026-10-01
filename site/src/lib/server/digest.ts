import { readStore } from "@/lib/store";
import { loadAuth } from "./accounts";
import { docs, localizeWorkspace, threads, workspace } from "./records";
import { readDays, sum, total } from "./stats";
import { siteOrigin } from "./mail";

/**
 * The weekly summary for the project owner: what came in, who is waiting, how the website did,
 * and what is next in the project. Plain text, so it reads well in any mail program. Sent on
 * Monday mornings by the cron job (/api/cron/digest) when it is switched on in the settings, in
 * the language chosen there.
 */
export type Digest = { subject: string; text: string; empty: boolean };

const WEEK = 7 * 86400e3;

export async function buildDigest(lang: "no" | "en" = "no", now = Date.now()): Promise<Digest> {
  const [store, auth, days, prevDays, docState, threadState, ws, origin] = await Promise.all([
    readStore(), loadAuth(), readDays(7), readDays(14), docs.read(), threads.read(), workspace.read().then((w) => localizeWorkspace(w, lang)), siteOrigin().catch(() => process.env.SITE_URL ?? ""),
  ]);
  const no = lang === "no";
  const t = (n: string, e: string) => (no ? n : e);
  const nf = (v: number) => Math.round(v).toLocaleString(no ? "nb-NO" : "en-GB");
  /** "1 dag" or "3 dager": the count with the right form of the word. */
  const pl = (v: number, one: string, many: string) => `${nf(v)} ${Math.round(v) === 1 ? one : many}`;

  const since = now - WEEK;
  const real = store.leads.filter((l) => !l.excluded && l.source !== "eksempel");
  const fresh = real.filter((l) => Date.parse(l.created) >= since);
  const waiting = real.filter((l) => l.status === "new");
  const oldest = waiting.length ? Math.max(...waiting.map((l) => (now - Date.parse(l.created)) / 86400e3)) : 0;
  // what each lead wants: [Norwegian, English for one, English for several]
  const purpose = { buy: ["vil kjøpe", "wants to buy", "want to buy"], invest: ["vil investere", "wants to invest", "want to invest"], partner: ["vil samarbeide", "wants to partner", "want to partner"], curious: ["følger med", "is following along", "are following along"] } as const;
  const byPurpose = (Object.keys(purpose) as (keyof typeof purpose)[]).map((p) => [p, fresh.filter((l) => l.purpose === p).length] as const).filter(([, n]) => n > 0);
  const visitors = total(days, "uv"), views = total(days, "pv");
  const lastWeek = prevDays.slice(0, 7);
  const visitorsBefore = total(lastWeek, "uv");
  const pages = Object.entries(sum(days, "p:")).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const refs = Object.entries(sum(days, "r:")).filter(([r]) => r !== "direkte").sort((a, b) => b[1] - a[1]).slice(0, 3);
  const logins = auth.accounts.filter((a) => a.role === "user" && a.last_login && Date.parse(a.last_login) >= since);
  const open = threadState.threads.filter((x) => x.status === "open");
  const newQuestions = threadState.threads.filter((x) => Date.parse(x.created) >= since);
  const downloads = docState.log.filter((l) => Date.parse(l.at) >= since).length;
  const due = ws.tasks.filter((x) => x.status !== "done" && x.due && Date.parse(x.due) <= now + WEEK).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const next = ws.milestones.find((m) => m.status === "next");
  const week = isoWeek(new Date(now));
  const quote = (s: string) => (no ? `«${s}»` : `"${s}"`);

  const lines: string[] = [];
  lines.push(t(`Uke ${week} for Knotten.`, `Week ${week} for Knotten.`), "");
  lines.push(t("INTERESSENTER", "LEADS"));
  lines.push(fresh.length
    ? `${t(`${fresh.length} nye`, `${fresh.length} new`)}: ${byPurpose.map(([p, n]) => `${n} ${no ? purpose[p][0] : purpose[p][n === 1 ? 1 : 2]}`).join(", ")}.`
    : t("Ingen nye denne uken.", "None new this week."));
  lines.push(waiting.length
    ? t(`${waiting.length} venter på svar, den eldste i ${pl(oldest, "dag", "dager")}.`, `${waiting.length} waiting for an answer, the oldest for ${pl(oldest, "day", "days")}.`)
    : t("Ingen venter på svar.", "Nobody is waiting for an answer."));
  for (const l of fresh.slice(-5).reverse()) lines.push(`  ${l.name || l.email}, ${no ? purpose[l.purpose][0] : purpose[l.purpose][1]}${l.plots.length ? `, ${t("tomt", "plot")} ${l.plots.map((p) => Number(p.slice(5))).join(t(" og ", " and "))}` : ""}`);
  lines.push("");
  lines.push(t("NETTSIDEN", "THE WEBSITE"));
  lines.push(t(
    `${nf(visitors)} besøkende og ${nf(views)} sidevisninger${visitorsBefore ? ` (uken før: ${nf(visitorsBefore)} besøkende)` : ""}.`,
    `${pl(visitors, "visitor", "visitors")} and ${pl(views, "page view", "page views")}${visitorsBefore ? ` (the week before: ${pl(visitorsBefore, "visitor", "visitors")})` : ""}.`,
  ));
  if (pages.length) lines.push(`${t("Mest lest", "Most read")}: ${pages.map(([p, n]) => `${p} (${n})`).join(", ")}.`);
  if (refs.length) lines.push(`${t("Kom fra", "Came from")}: ${refs.map(([r, n]) => `${r} (${n})`).join(", ")}.`);
  lines.push("");
  lines.push(t("PORTALEN", "THE PORTAL"));
  lines.push(t(
    `${pl(logins.length, "interessent", "interessenter")} logget inn, ${pl(downloads, "dokument", "dokumenter")} lastet ned, ${pl(newQuestions.length, "ny henvendelse", "nye henvendelser")}.`,
    `${pl(logins.length, "stakeholder", "stakeholders")} logged in, ${pl(downloads, "document", "documents")} downloaded, ${pl(newQuestions.length, "new question", "new questions")}.`,
  ));
  if (open.length) lines.push(`${t(pl(open.length, "henvendelse venter på svar", "henvendelser venter på svar"), pl(open.length, "question is waiting for an answer", "questions are waiting for an answer"))}: ${open.slice(0, 3).map((x) => quote(x.subject)).join(", ")}.`);
  lines.push("");
  lines.push(t("PROSJEKTET", "THE PROJECT"));
  if (due.length) for (const x of due.slice(0, 5)) lines.push(`  ${x.due}: ${x.title} (${x.owner})${Date.parse(x.due!) < now ? t(", forfalt", ", overdue") : ""}`);
  else lines.push(t("Ingen oppgaver med frist den neste uken.", "No tasks due in the coming week."));
  if (next) lines.push(`${t("Neste milepæl", "Next milestone")}: ${next.title}.`);
  lines.push("", `${t("Alt i portalen", "Everything in the portal")}: ${origin}/${lang}/portal/admin`, "", t("Sammendraget kan slås av under Innstillinger i portalen.", "The summary can be switched off under Settings in the portal."));

  const empty = !fresh.length && !waiting.length && !visitors && !open.length && !due.length && !downloads;
  const subject = t(
    `Knotten, uke ${week}: ${pl(fresh.length, "ny interessent", "nye interessenter")}, ${nf(visitors)} besøkende`,
    `Knotten, week ${week}: ${pl(fresh.length, "new lead", "new leads")}, ${pl(visitors, "visitor", "visitors")}`,
  );
  return { subject, text: lines.join("\n"), empty };
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - year.getTime()) / 86400e3 + 1) / 7);
}
