"use client";
import { useState } from "react";

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
 * admin whichever design it came from. The plot numbers of the Klassisk plot picker are its own
 * working labels, so a chosen plot goes into the note, not into the plot list of the records.
 */
export default function InterestForm({ plot }: { plot?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
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
          name: f.get("name"), email: f.get("email"), phone: f.get("phone"), purpose, plots: [], message: note,
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
    <form className="form" onSubmit={submit}>
      <label>Navn<input type="text" id="f-name" name="name" autoComplete="name" placeholder="Fornavn Etternavn" /></label>
      <label>E-post<input type="email" id="f-mail" name="email" autoComplete="email" placeholder="navn@eksempel.no" required /></label>
      <label>
        Jeg er interessert som
        <select id="f-role" name="role" defaultValue="Boligkjøper">
          {ROLES.map(([r]) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label>Telefon (valgfritt)<input type="tel" id="f-tel" name="phone" autoComplete="tel" /></label>
      {plot && <label className="full">Tomt<input type="text" id="f-plot" name="plot" defaultValue={`Tomt ${plot}`} readOnly /></label>}
      <label className="full">Melding<textarea id="f-msg" name="message" rows={4} placeholder="Hva vil du vite mer om?" /></label>
      <label className="consent full">
        <input type="checkbox" id="f-consent" name="consent" required />
        <span className="small">Jeg samtykker til at Sigve Simonsen AS lagrer opplysningene for å kontakte meg om Knotten. Du kan trekke samtykket når som helst.</span>
      </label>
      <div className="full cta-row" style={{ marginTop: 4 }}>
        <button className="btn" type="submit" disabled={state === "sending" || state === "sent"}>{state === "sending" ? "Sender" : "Send interessemelding"}</button>
        {state === "sent" && <span className="small" style={{ alignSelf: "center" }}>Sendt. Du får en bekreftelse på e-post innen to virkedager.</span>}
        {state === "error" && (
          <span className="small no" style={{ alignSelf: "center" }}>
            {err === "invalid_email" ? "Sjekk e-postadressen." : err === "consent_required" ? "Kryss av for samtykket for å sende." : "Det gikk ikke å sende. Prøv igjen, eller skriv til sigve.simonsen@hotmail.com."}
          </span>
        )}
      </div>
    </form>
  );
}
