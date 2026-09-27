"use client";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export default function InterestForm({ locale, plots, preselect }: { locale: Locale; plots: string[]; preselect?: string }) {
  const no = locale === "no";
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: f.get("name"), email: f.get("email"), phone: f.get("phone"), purpose: f.get("purpose"),
        plots: f.getAll("plots"), consent_updates: !!f.get("consent_updates"), consent_investor: !!f.get("consent_investor"), consent_research: !!f.get("consent_research"), source: "web (moderne)",
      }),
    });
    if (res.ok) setState("done");
    else { setState("error"); setErr((await res.json()).error ?? "error"); }
  }
  if (state === "done") {
    return (
      <div className="bg-bone border line rounded-[2px] p-6 max-w-[60ch]">
        <div className="display text-[30px]">{no ? "Registrert." : "Registered."}</div>
        <p className="mt-2">{no ? "Du får en e-post for å bekrefte adressen. Deretter hører du fra oss når det skjer noe med tomtene." : "You will get an email to confirm the address. After that you hear from us when something happens with the plots."}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-4 max-w-[60ch]">
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
            <label key={p} className="chip cursor-pointer"><input type="checkbox" name="plots" value={p} defaultChecked={p === preselect} className="mr-1" />{p.replace("plot-", "")}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-1 text-[14px]">
        <legend className="mb-1">{no ? "Samtykke" : "Consent"}</legend>
        <label className="flex items-start gap-2"><input type="checkbox" name="consent_updates" required /> {no ? "Dere kan sende meg oppdateringer om Knotten (påkrevd)." : "You may send me updates about Knotten (required)."}</label>
        <label className="flex items-start gap-2"><input type="checkbox" name="consent_investor" /> {no ? "Dere kan kontakte meg om investering." : "You may contact me about investing."}</label>
        <label className="flex items-start gap-2"><input type="checkbox" name="consent_research" /> {no ? "Min interesse kan telles i anonym statistikk som deles med UiA." : "My interest may be counted in anonymous statistics shared with UiA."}</label>
      </fieldset>
      <button className="btn btn-amber justify-self-start" disabled={state === "sending"}>{state === "sending" ? "…" : no ? "Meld interesse" : "Register interest"}</button>
      {state === "error" && <div className="text-[14px] text-amber-deep">{err === "consent_required" ? (no ? "Kryss av for oppdateringer for å sende." : "Tick updates consent to send.") : (no ? "Sjekk e-postadressen." : "Check the email address.")}</div>}
      <div className="provenance">{no ? "Lagres i EU. Du kan få eksportert eller slettet dine data når som helst." : "Stored in the EU. You can export or delete your data at any time."}</div>
    </form>
  );
}
