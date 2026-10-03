"use client";
import { useRef, useState } from "react";
import { track } from "@/components/Track";
import { CONTACT } from "@/lib/facts";

/** Each "interessert som" choice and the purpose the project's lead records use for it. */
const ROLES: [string, "buy" | "invest" | "partner" | "curious"][] = [
  ["Boligkjøper", "buy"],
  ["Investor eller partner", "invest"],
  ["Kommune eller offentlig aktør", "partner"],
  ["Forsker eller student", "partner"],
  ["Presse", "curious"],
];

/**
 * Sends to the same records as the Moderne form (/api/leads), so the owner sees every lead in the
 * admin whichever design it came from. Both designs number the plots the same way (layout v6), so a
 * plot chosen in the plot picker is counted with that plot in the records, and named in the note.
 */
export default function InterestForm({ plot, role }: { plot?: string; role?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  const started = useRef(false);
  const start = () => { if (!started.current) { started.current = true; track("form_start"); } };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const role = String(f.get("role") ?? "");
    const purpose = ROLES.find(([r]) => r === role)?.[1] ?? "curious";
    const note = [`Interessert som: ${role}.`, plot ? `Gjelder tomt ${plot} i tomtevelgeren (klassisk design).` : "", String(f.get("message") ?? "").trim()]
      .filter(Boolean)
      .join("\n");
    setState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"), email: f.get("email"), phone: f.get("phone"), purpose, plots: plot && /^\d{1,2}$/.test(plot) ? [`plot-${plot.padStart(2, "0")}`] : [], message: note, website: f.get("website"),
          consent_updates: !!f.get("consent"), consent_investor: purpose === "invest", consent_research: false, source: "web (klassisk)",
        }),
      });
      if (res.ok) return setState("sent");
      setErr((await res.json().catch(() => ({}))).error ?? "");
    } catch {
      setErr("");
    }
    setState("error");
  }
  return (
    // (method post: before the page's script runs, a sent form never puts the email and phone in the address)
    <form className="form" method="post" onSubmit={submit} onFocus={start}>
      <label>Navn<input type="text" id="f-name" name="name" autoComplete="name" placeholder="Fornavn Etternavn" /></label>
      <label>E-post<input type="email" id="f-mail" name="email" autoComplete="email" placeholder="navn@eksempel.no" required /></label>
      <label>
        Jeg er interessert som
        <select id="f-role" name="role" defaultValue={role && ROLES.some(([r]) => r === role) ? role : "Boligkjøper"}>
          {ROLES.map(([r]) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label>Telefon (valgfritt)<input type="tel" id="f-tel" name="phone" autoComplete="tel" /></label>
      {plot && <label className="full">Tomt<input type="text" id="f-plot" name="plot" defaultValue={`Tomt ${plot}`} readOnly /></label>}
      <label className="full">Melding<textarea id="f-msg" name="message" rows={4} placeholder="Hva vil du vite mer om?" /></label>
      <label className="sr" aria-hidden>Nettside<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className="consent full">
        <input type="checkbox" id="f-consent" name="consent" required />
        <span className="small">Jeg samtykker til at Sigve Simonsen AS lagrer opplysningene for å kontakte meg om Knotten. Du kan trekke samtykket når som helst.</span>
      </label>
      <div className="full cta-row" style={{ marginTop: 4 }}>
        <button className="btn" type="submit" disabled={state === "sending" || state === "sent"}>{state === "sending" ? "Sender" : "Send interessemelding"}</button>
        {/* (a live region that is always there, so the result is read out when it appears) */}
        <span role="status" className="small" style={{ alignSelf: "center" }}>{state === "sent" ? "Sendt. Takk, interessen din er registrert." : ""}</span>
        {state === "error" && (
          <span role="alert" className="small no" style={{ alignSelf: "center" }}>
            {err === "invalid_email" ? "Sjekk e-postadressen." : err === "consent_required" ? "Kryss av for samtykket for å sende." : err === "too_many" ? "Mange meldinger fra denne adressen på kort tid. Vent noen minutter og prøv igjen." : `Det gikk ikke å sende. Prøv igjen, eller skriv til ${CONTACT.email}.`}
          </span>
        )}
      </div>
    </form>
  );
}
