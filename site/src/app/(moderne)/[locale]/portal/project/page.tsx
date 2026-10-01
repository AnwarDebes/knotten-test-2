import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { canSeeDoc, canSeeThread, docs, localizeWorkspace, threads, workspace, type Task } from "@/lib/server/records";
import { deleteDecision, deleteMilestone, deleteTask, publishMilestone, saveDecision, saveMilestone, saveTask, setTaskStatus } from "../actions";
import NoAccess from "@/components/portal/NoAccess";
import { DocList, UploadForm } from "@/components/portal/Docs";
import { Threads } from "@/components/portal/Threads";
import { ActionForm, ConfirmButton } from "@/components/portal/forms";
import { PageHead, when } from "@/components/portal/ui";
import { osloDate } from "@/lib/server/live";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Prosjektrom", "Project room");

const TABS = ["oppgaver", "beslutninger", "milepaeler", "dokumenter", "diskusjon"] as const;
type Tab = (typeof TABS)[number];

/**
 * The project room: the task list, the decision log and the milestones, the project's documents
 * and a place to discuss. A reached milestone goes to the website's news page with one click.
 */
export default async function ProjectRoom({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/project", "project");
  if (!ok) return <NoAccess locale={locale} session={session} area="project" />;
  const { tab: t } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(t ?? "") ? (t as Tab) : "oppgaver";
  const admin = isAdmin(session);
  const [ws, docState, threadState] = await Promise.all([workspace.read().then((w) => localizeWorkspace(w, locale)), docs.read(), threads.read()]);
  const label: Record<Tab, string> = no
    ? { oppgaver: "Oppgaver", beslutninger: "Beslutninger", milepaeler: "Milepæler", dokumenter: "Dokumenter", diskusjon: "Diskusjon" }
    : { oppgaver: "Tasks", beslutninger: "Decisions", milepaeler: "Milestones", dokumenter: "Documents", diskusjon: "Discussion" };
  const open = ws.tasks.filter((x) => x.status !== "done").length;
  const projectDocs = docState.docs.filter((d) => canSeeDoc(session, d) && (d.audience.includes("project") || d.audience.includes("all")));
  const talk = threadState.threads.filter((x) => x.area === "project" && canSeeThread(session, x));
  const L = { no, locale };

  return (
    <>
      <PageHead
        eyebrow={no ? "Prosjektgruppen" : "The project group"}
        title={no ? "Prosjektrom" : "Project room"}
        lede={no ? "Det prosjektgruppen jobber med: oppgaver med eier og frist, beslutningene som er tatt, milepælene, og dokumentene. Det som er klart for offentligheten, publiseres til nyhetssiden herfra." : "What the project group works on: tasks with owner and deadline, the decisions taken, the milestones, and the documents. What is ready for the public is published to the news page from here."}
      />
      <nav className="pt-tabs" aria-label={no ? "Deler av prosjektrommet" : "Parts of the project room"}>
        {TABS.map((x) => (
          <Link key={x} href={`?tab=${x}`} scroll={false} aria-current={x === tab ? "page" : undefined}>
            {label[x]}
            {x === "oppgaver" && open > 0 && <span className="ml-1.5 text-muted">{open}</span>}
            {x === "dokumenter" && projectDocs.length > 0 && <span className="ml-1.5 text-muted">{projectDocs.length}</span>}
          </Link>
        ))}
      </nav>

      {tab === "oppgaver" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px] items-start">
          <div className="grid gap-4 lg:grid-cols-3 items-start">
            {(["todo", "doing", "done"] as const).map((st) => {
              const list = ws.tasks.filter((x) => x.status === st).sort((a, b) => (a.priority === b.priority ? (a.due ?? "9").localeCompare(b.due ?? "9") : a.priority === "high" ? -1 : b.priority === "high" ? 1 : a.priority === "medium" ? -1 : 1));
              return (
                <div key={st} className="rounded-[var(--radius-lg)] bg-bg-2/70 border line p-3 grid gap-2.5">
                  <div className="flex items-center justify-between px-1.5 pt-1">
                    <span className="font-medium text-[14.5px]">{no ? { todo: "Å gjøre", doing: "Pågår", done: "Ferdig" }[st] : { todo: "To do", doing: "In progress", done: "Done" }[st]}</span>
                    <span className="text-[13px] text-muted">{list.length}</span>
                  </div>
                  {list.map((task) => <TaskCard key={task.id} task={task} {...L} />)}
                  {list.length === 0 && <p className="text-[13.5px] text-muted px-1.5 pb-2">{no ? "Ingenting her." : "Nothing here."}</p>}
                </div>
              );
            })}
          </div>
          <div className="panel p-5 grid gap-3">
            <div className="font-medium">{no ? "Ny oppgave" : "New task"}</div>
            <TaskFields {...L} />
          </div>
        </div>
      )}

      {tab === "beslutninger" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px] items-start">
          <ol className="panel divide-y divide-[var(--line)]">
            {ws.decisions.map((d) => (
              <li key={d.id} className="p-4 md:p-5 grid gap-1.5 md:grid-cols-[120px_1fr]">
                <div className="text-[13px] text-muted">{when(d.date, locale, false)}</div>
                <div>
                  <div className="font-medium">{d.title}</div>
                  {d.text && <p className="text-[14.5px] text-ink-2 mt-1">{d.text}</p>}
                  <div className="flex flex-wrap items-center gap-4 mt-1.5 text-[12.5px] text-muted">
                    <span>{no ? "Besluttet av" : "Decided by"} {d.by}</span>
                    {admin && <ConfirmButton action={deleteDecision} fields={{ id: d.id }} label={no ? "Slett" : "Delete"} question={no ? "Slette beslutningen fra loggen?" : "Delete the decision from the log?"} className="text-[12.5px] text-amber-ink hover:underline" />}
                  </div>
                </div>
              </li>
            ))}
            {ws.decisions.length === 0 && <li className="p-5 text-muted">{no ? "Ingen beslutninger ført ennå." : "No decisions logged yet."}</li>}
          </ol>
          <div className="panel p-5 grid gap-3">
            <div className="font-medium">{no ? "Før en beslutning" : "Log a decision"}</div>
            <ActionForm action={saveDecision} submit={no ? "Før i loggen" : "Log it"}>
              <input type="hidden" name="lang" value={locale} />
              <input name="title" required className="input !py-2" placeholder={no ? "Hva ble bestemt" : "What was decided"} />
              <textarea name="text" rows={4} className="input !text-[15px]" placeholder={no ? "Begrunnelse og konsekvenser" : "Reasons and consequences"} />
              <div className="grid grid-cols-2 gap-2"><input name="date" type="date" className="input !py-2" aria-label={no ? "Dato" : "Date"} /><input name="by" className="input !py-2" placeholder={no ? "Hvem besluttet" : "Who decided"} /></div>
            </ActionForm>
          </div>
        </div>
      )}

      {tab === "milepaeler" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_340px] items-start">
          <ol className="relative grid gap-3 pl-6 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--line-strong)]">
            {[...ws.milestones].sort((a, b) => (a.status === b.status ? (a.date ?? "9").localeCompare(b.date ?? "9") : ["done", "next", "later"].indexOf(a.status) - ["done", "next", "later"].indexOf(b.status))).map((m) => (
              <li key={m.id} className="relative">
                <span className={`absolute -left-6 top-4 w-[19px] h-[19px] rounded-full border-[3px] border-bg ${m.status === "done" ? "bg-pine" : m.status === "next" ? "bg-amber" : "bg-[var(--line-strong)]"}`} />
                <div className="panel p-4 grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium flex-1 min-w-[16ch]">{m.title}</span>
                    {m.public && <span className="chip chip-pine">{no ? "På nyhetssiden" : "On the news page"}</span>}
                    <span className="text-[12.5px] text-muted">{m.date ? when(m.date, locale, false) : m.status === "next" ? (no ? "neste" : "next") : (no ? "senere" : "later")}</span>
                  </div>
                  {m.detail && <p className="text-[14px] text-ink-2">{m.detail}</p>}
                  <div className="flex flex-wrap items-center gap-4 text-[13px]">
                    <details className="group">
                      <summary className="cursor-pointer text-fjord list-none">{no ? "Endre" : "Edit"}</summary>
                      <div className="mt-2"><MilestoneFields m={m} {...L} /></div>
                    </details>
                    {admin && m.status === "done" && (
                      <form action={publishMilestone}><input type="hidden" name="id" value={m.id} /><button className="text-fjord hover:underline">{m.news_id ? (no ? "Vis eller skjul på nyhetssiden" : "Show or hide on the news page") : (no ? "Publiser som nyhet" : "Publish as news")}</button></form>
                    )}
                    <ConfirmButton action={deleteMilestone} fields={{ id: m.id }} label={no ? "Slett" : "Delete"} question={no ? "Slette milepælen?" : "Delete the milestone?"} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="panel p-5 grid gap-3">
            <div className="font-medium">{no ? "Ny milepæl" : "New milestone"}</div>
            <MilestoneFields {...L} />
            {!admin && <p className="text-[12.5px] text-muted">{no ? "Administratorer publiserer nådde milepæler til nyhetssiden." : "Administrators publish reached milestones to the news page."}</p>}
          </div>
        </div>
      )}

      {tab === "dokumenter" && (
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr] items-start">
          <DocList items={projectDocs} session={session} locale={locale} empty={no ? "Last opp tegninger, rapporter og avtaler prosjektgruppen skal dele." : "Upload drawings, reports and agreements the project group should share."} />
          <div className="panel p-5 md:p-6"><div className="font-medium mb-3">{no ? "Last opp til prosjektrommet" : "Upload to the project room"}</div><UploadForm session={session} locale={locale} audience={["project"]} category="reports" /></div>
        </div>
      )}

      {tab === "diskusjon" && (
        <Threads area="project" items={talk} session={session} locale={locale} askTitle={no ? "Start en tråd" : "Start a thread"} askHint={no ? "Synlig for deg og administratorene; en administrator kan dele den med hele prosjektgruppen." : "Visible to you and the administrators; an administrator can share it with the whole project group."} empty={no ? "Ingen tråder ennå." : "No threads yet."} />
      )}
    </>
  );
}

function TaskCard({ task, no, locale }: { task: Task; no: boolean; locale: "no" | "en" }) {
  const pr = { high: no ? "høy" : "high", medium: no ? "middels" : "medium", low: no ? "lav" : "low" }[task.priority];
  const late = task.due && task.status !== "done" && task.due < osloDate();
  const move = (status: Task["status"], text: string) => (
    <form action={setTaskStatus}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="status" value={status} /><button className="text-fjord hover:underline">{text}</button></form>
  );
  return (
    <div className="bg-white border line rounded-[var(--radius)] p-3.5 grid gap-2 shadow-[0_1px_0_rgba(23,40,58,.04)]">
      <div className={`text-[14.5px] leading-snug ${task.status === "done" ? "text-muted line-through decoration-[var(--line-strong)]" : "font-medium"}`}>{task.title}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className={`chip !py-0.5 ${task.priority === "high" ? "chip-amber" : ""}`}>{pr}</span>
        {task.topic && <span className="chip !py-0.5 chip-fjord">{task.topic}</span>}
        <span className="text-muted">{task.owner}</span>
        {task.due && <span className={late ? "text-amber-ink font-medium" : "text-muted"}>· {when(task.due, locale, false)}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[12.5px] pt-0.5">
        {task.status === "todo" && move("doing", no ? "Start" : "Start")}
        {task.status !== "done" && move("done", no ? "Ferdig" : "Done")}
        {task.status === "doing" && move("todo", no ? "Tilbake" : "Back")}
        {task.status === "done" && move("todo", no ? "Åpne igjen" : "Reopen")}
        <ConfirmButton action={deleteTask} fields={{ id: task.id }} label={no ? "Slett" : "Delete"} question={no ? "Slette oppgaven?" : "Delete the task?"} className="text-[12.5px] text-amber-ink hover:underline ml-auto" />
      </div>
      <details className="text-[12.5px]">
        <summary className="cursor-pointer text-ink-2 hover:underline list-none">{no ? "Endre" : "Edit"}</summary>
        <div className="mt-2"><TaskFields task={task} no={no} locale={locale} /></div>
      </details>
    </div>
  );
}

function TaskFields({ task, no, locale }: { task?: Task; no: boolean; locale: "no" | "en" }) {
  return (
    <ActionForm action={saveTask} submit={task ? (no ? "Lagre" : "Save") : (no ? "Legg til" : "Add")} className="grid gap-2.5">
      <input type="hidden" name="lang" value={locale} />
      {task && <input type="hidden" name="id" value={task.id} />}
      <input name="title" required defaultValue={task?.title} className="input !py-2" placeholder={no ? "Hva skal gjøres" : "What needs doing"} />
      <div className="grid grid-cols-2 gap-2">
        <input name="owner" defaultValue={task?.owner} className="input !py-2" placeholder={no ? "Ansvarlig" : "Owner"} />
        <input name="topic" defaultValue={task?.topic} className="input !py-2" placeholder={no ? "Tema" : "Topic"} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="due" type="date" defaultValue={task?.due} className="input !py-2" aria-label={no ? "Frist" : "Deadline"} />
        <select name="priority" defaultValue={task?.priority ?? "medium"} className="input !py-2" aria-label={no ? "Prioritet" : "Priority"}>
          <option value="high">{no ? "Høy prioritet" : "High priority"}</option>
          <option value="medium">{no ? "Middels" : "Medium"}</option>
          <option value="low">{no ? "Lav" : "Low"}</option>
        </select>
      </div>
    </ActionForm>
  );
}

function MilestoneFields({ m, no, locale }: { m?: { id: string; title: string; detail?: string; date?: string; status: "done" | "next" | "later" }; no: boolean; locale: "no" | "en" }) {
  return (
    <ActionForm action={saveMilestone} submit={m ? (no ? "Lagre" : "Save") : (no ? "Legg til" : "Add")} className="grid gap-2.5">
      <input type="hidden" name="lang" value={locale} />
      {m && <input type="hidden" name="id" value={m.id} />}
      <input name="title" required defaultValue={m?.title} className="input !py-2" placeholder={no ? "Milepæl" : "Milestone"} />
      <input name="detail" defaultValue={m?.detail} className="input !py-2" placeholder={no ? "Kort forklaring (brukes som nyhetstekst)" : "Short explanation (used as news text)"} />
      <div className="grid grid-cols-2 gap-2">
        <input name="date" type="date" defaultValue={m?.date} className="input !py-2" aria-label={no ? "Dato" : "Date"} />
        <select name="status" defaultValue={m?.status ?? "later"} className="input !py-2" aria-label="Status">
          <option value="done">{no ? "Nådd" : "Reached"}</option>
          <option value="next">{no ? "Neste" : "Next"}</option>
          <option value="later">{no ? "Senere" : "Later"}</option>
        </select>
      </div>
    </ActionForm>
  );
}
