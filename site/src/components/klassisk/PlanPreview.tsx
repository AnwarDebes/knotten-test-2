"use client";
import { useState } from "react";
import SitePlan from "./SitePlan";

/** Front page preview: one before/after toggle, plots reveal once when scrolled into view. */
export default function PlanPreview() {
  const [mode, setMode] = useState<"today" | "plan">("plan");
  return (
    <figure className="fig" aria-label="Situasjonsplan for Knotten">
      <div className="fig-head">
        <div className="seg" role="group" aria-label="Vis terreng eller plan">
          <button type="button" aria-pressed={mode === "today"} onClick={() => setMode("today")}>Terrenget i dag</button>
          <button type="button" aria-pressed={mode === "plan"} onClick={() => setMode("plan")}>Med boligene</button>
        </div>
        <span className="compass">
          <svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="#7C8A9B" /><path d="M9 2l3 7-3-2-3 2z" fill="#14263D" /></svg>
          Nord opp. Sjøen ligger sør, nederst i kartet.
        </span>
      </div>
      <SitePlan mode={mode} revealOnView />
      <div className="legend">
        <span><i style={{ background: "var(--pine)" }} />Tomt, sjøutsikt ønsket</span>
        <span><i style={{ background: "#7C8A9B" }} />Eksisterende bygg</span>
        <span><i style={{ border: "1.5px dashed var(--pine)", background: "transparent" }} />Planlagt næringsbygg</span>
      </div>
      <figcaption><span>Prosjekteiers rekker, lagt inn i det målte terrenget innenfor eiendomsgrensen. Foreløpig utlegg; reguleringsplan er ikke vedtatt, avvik vil forekomme. Hold over en tomt for å se siktretningen.</span></figcaption>
    </figure>
  );
}
