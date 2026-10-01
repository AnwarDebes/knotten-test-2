"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { keepValues } from "@/components/keepValues";

type State = { error?: string; ok?: string; link?: string } | undefined;

/**
 * A portal form with an answer: runs a server action, shows what happened under the fields, and
 * a link to copy when the action made one (invitations, password links). The fields are passed
 * in as children, so the page around it stays a server component.
 */
export function ActionForm({ action, children, submit, pending, className = "grid gap-3", buttonClass = "btn btn-sm justify-self-start", footer, resetOnSuccess = true }: {
  action: (state: State, fd: FormData) => Promise<State>;
  children: React.ReactNode;
  submit: string;
  pending?: string;
  className?: string;
  buttonClass?: string;
  footer?: React.ReactNode;
  /** Clear the fields after a successful save (new task, new question). Edit forms show the saved values again. */
  resetOnSuccess?: boolean;
}) {
  const [state, run, busy] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={run} onSubmit={keepValues(run)} className={className}>
      {children}
      {state?.error && <div role="alert" className="rounded-[var(--radius)] px-3.5 py-2.5 text-[14px] bg-[rgba(226,162,59,.16)] text-[#6b4710]">{state.error}</div>}
      {state?.ok && <div role="status" className="rounded-[var(--radius)] px-3.5 py-2.5 text-[14px] bg-[rgba(79,113,86,.12)] text-[#2f4f38]">{state.ok}</div>}
      {state?.link && <CopyLink url={state.link} />}
      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonClass} disabled={busy} aria-busy={busy}>{busy ? (pending ?? `${submit} …`) : submit}</button>
        {footer}
      </div>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const no = useParams<{ locale?: string }>()?.locale !== "en";
  return (
    <div className="flex items-stretch gap-2">
      <input className="input !py-2 !text-[13.5px] font-mono" value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label={no ? "Lenke" : "Link"} />
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-plain"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch { /* the field is selectable as a fallback */ }
        }}
      >
        {copied ? (no ? "Kopiert" : "Copied") : (no ? "Kopier" : "Copy")}
      </button>
    </div>
  );
}

/** A small button form for one-click actions that cannot be undone, with a confirmation question. */
export function ConfirmButton({ action, fields, label, question, className = "text-[13px] text-amber-ink hover:underline" }: { action: (fd: FormData) => Promise<void>; fields: Record<string, string>; label: string; question: string; className?: string }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(question)) e.preventDefault(); }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={className}>{label}</button>
    </form>
  );
}
