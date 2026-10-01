"use client";
import { useRef, useState } from "react";
import { track } from "@/components/Track";
import type { Locale } from "@/lib/i18n";
import { plotNo } from "@/lib/format";

export default function InterestForm({ locale, plots, preselect }: { locale: Locale; plots: string[]; preselect?: string }) {
  const no = locale === "no";
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const started = useRef(false);
  const start = () => { if (!started.current) { started.current = true; track("form_start"); } };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"), email: f.get("email"), phone: f.get("phone"), purpose: f.get("purpose"), website: f.get("website"),
          plots: f.getAll("plots"), consent_updates: !!f.get("consent_updates"), consent_investor: !!f.get("consent_investor"), consent_research: !!f.get("consent_research"), source: "web (moderne)",
        }),
      });
      if (res.ok) return setState("done");
      setErr((await res.json().catch(() => ({}))).error ?? "error");
    } catch {
      setErr("error");
    }
    setState("error");
  }
  if (state === "done") {
    return (
      <div className="panel p-6 max-w-[60ch]" role="status">
        <div className="display text-[30px]">{no ? "Registrert." : "Registered."}</div>
        <p className="mt-2">{no ? "Interessen din er lagret. Du hører fra oss når det skjer noe med tomtene." : "Your interest is saved. You will hear from us when something happens with the plots."}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} onFocus={start} className="relative grid gap-4 max-w-[60ch]">
      <label className="grid gap-1 text-[14px]">{no ? "Navn" : "Name"}<input className="input" name="name" autoComplete="name" /></label>
      <label className="grid gap-1 text-[14px]">E-post<input className="input" name="email" type="email" required autoComplete="email" /></label>
      <label className="grid gap-1 text-[14px]">{no ? "Telefon (valgfritt)" : "Phone (optional)"}<input className="input" name="phone" type="tel" autoComplete="tel" /></label>
      <fieldset className="grid gap-1 text-[14px]">
        <legend className="mb-1">{no ? "Jeg er interessert i å" : "I am interested in"}</legend>
        {[["buy", no ? "kjøpe bolig" : "buying a home"], ["invest", no ? "investere" : "investing"], ["partner", no ? "samarbeide (kommune, leverandør, forskning)" : "partnering (municipality, supplier, research)"], ["curious", no ? "følge med" : "following along"]].map(([v, l]) => (
          <label key={v} className="flex items-center gap-2"><input type="radio" name="purpose" value={v} defaultChecked={v === "buy"} /> {l}</label>
        ))}
      </fieldset>
      <fieldset className="text-[14px]">
        <legend className="mb-1">{no ? "Tomter jeg vil høre om" : "Plots I want to hear about"}</legend>
        <div className="flex flex-wrap gap-1">
          {plots.map((p) => (
            <label key={p} className="chip cursor-pointer"><input type="checkbox" name="plots" value={p} defaultChecked={p === preselect} className="mr-1" />{plotNo(p)}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-1 text-[14px]">
        <legend className="mb-1">{no ? "Samtykke" : "Consent"}</legend>
        <label className="flex items-start gap-2"><input type="checkbox" name="consent_updates" required /> {no ? "Dere kan sende meg oppdateringer om Knotten (påkrevd)." : "You may send me updates about Knotten (required)."}</label>
        <label className="flex items-start gap-2"><input type="checkbox" name="consent_investor" /> {no ? "Dere kan kontakte meg om investering." : "You may contact me about investing."}</label>
        <label className="flex items-start gap-2"><input type="checkbox" name="consent_research" /> {no ? "Min interesse kan telles i anonym statistikk som deles med UiA." : "My interest may be counted in anonymous statistics shared with UiA."}</label>
      </fieldset>
      <label className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden>Nettside<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button className="btn btn-amber justify-self-start" disabled={state === "sending"}>{state === "sending" ? "…" : no ? "Meld interesse" : "Register interest"}</button>
      {state === "error" && (
        <div className="text-[14px] text-amber-ink" role="alert">
          {err === "consent_required" ? (no ? "Kryss av for oppdateringer for å sende." : "Tick updates consent to send.")
            : err === "invalid_email" ? (no ? "Sjekk e-postadressen." : "Check the email address.")
            : err === "too_many" ? (no ? "Mange registreringer fra denne adressen på kort tid. Vent noen minutter og prøv igjen." : "Many registrations from this address in a short time. Wait a few minutes and try again.")
            : (no ? "Det gikk ikke å sende. Prøv igjen om litt." : "It could not be sent. Try again shortly.")}
        </div>
      )}
      <div className="provenance">{no ? "Du kan få eksportert eller slettet dine data når som helst." : "You can export or delete your data at any time."}</div>
    </form>
  );
}
