"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SitePlan from "./SitePlan";
import { PLOTS, type Plot } from "@/lib/klassisk/plots";
import { PHOTOS } from "@/lib/klassisk/photos";

type Scene = "plan" | "utsikt" | "omgivelser";
const STRIP: { scene: Scene; row: Plot["row"] | ""; label: string }[] = [
  { scene: "plan", row: "", label: "Oversikt" },
  { scene: "plan", row: "A", label: "Rekke A" },
  { scene: "plan", row: "B", label: "Rekke B" },
  { scene: "plan", row: "C", label: "Rekke C" },
  { scene: "plan", row: "D", label: "Rekke D" },
  { scene: "utsikt", row: "", label: "Utsikten" },
  { scene: "omgivelser", row: "", label: "Omgivelser" },
];

/** Full-screen plot picker: stage, floating panel with cards, row markers, filmstrip of scenes. */
export default function PlotStage() {
  const [scene, setScene] = useState<Scene>("plan");
  const [row, setRow] = useState<Plot["row"] | "">("");
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState(true);
  const visible = PLOTS.filter((p) => !row || p.row === row);
  const p = sel ? PLOTS[sel - 1] : null;

  const go = (s: Scene, r: Plot["row"] | "") => {
    setScene(s);
    setRow(r);
  };

  return (
    <div className="stage">
      <div className="scenes">
        <div className={`scene${scene === "plan" ? " on" : ""}`} data-scene="plan">
          <SitePlan mode="plan" numbered showPills selected={sel} activeRow={row} onSelect={setSel} onRow={(r) => go("plan", row === r ? "" : r)} />
        </div>
        <div className={`scene${scene === "utsikt" ? " on" : ""}`} data-scene="utsikt">
          <Image src={PHOTOS.view.src} alt={PHOTOS.view.alt} width={PHOTOS.view.w} height={PHOTOS.view.h} sizes="100vw" quality={85} />
          <div className="pin" style={{ left: "58%", top: "36%" }}><i />Sikt mot åpent hav</div>
          <div className="hero-cap">Fra nabotomten, litt lavere enn feltet. Foto: {PHOTOS.view.credit}</div>
        </div>
        <div className={`scene${scene === "omgivelser" ? " on" : ""}`} data-scene="omgivelser">
          <Image src={PHOTOS.sniksfjorden.src} alt={PHOTOS.sniksfjorden.alt} width={PHOTOS.sniksfjorden.w} height={PHOTOS.sniksfjorden.h} sizes="100vw" quality={85} />
          <div className="pin" style={{ left: "30%", top: "31%" }}><i />Åpent hav</div>
          <div className="hero-cap">{PHOTOS.sniksfjorden.caption}. Foto: {PHOTOS.sniksfjorden.credit}, {PHOTOS.sniksfjorden.license}</div>
        </div>

        {note && (
          <div className="snote">
            Tomtegrensene er veiledende. Reguleringsplan er ikke vedtatt, avvik vil forekomme.
            <button type="button" aria-label="Lukk" onClick={() => setNote(false)}>×</button>
          </div>
        )}
        <div className="scompass" aria-hidden="true">
          <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#D4DCE4" /><path d="M20 6l6 16-6-4-6 4z" fill="#14263D" /><path d="M20 34l-6-16 6 4 6-4z" fill="#C9D3DC" /><text x="20" y="4" textAnchor="middle" fontSize="7" fill="#14263D" fontWeight="700">N</text></svg>
        </div>
        <div className="strip" role="tablist" aria-label="Scener">
          {STRIP.map((b) => (
            <button key={b.label} type="button" aria-pressed={scene === b.scene && row === b.row} onClick={() => go(b.scene, b.row)}>
              <span className={`th ${b.scene === "plan" && !b.row ? "th-plan" : b.scene === "plan" ? "th-row" : b.scene === "omgivelser" ? "" : ""}`}>
                {b.scene === "plan" && b.row && <><i /><i /><i /></>}
                {b.scene === "utsikt" && <Image src={PHOTOS.view.src} alt="" width={PHOTOS.view.w} height={PHOTOS.view.h} sizes="96px" />}
                {b.scene === "omgivelser" && <Image src={PHOTOS.sniksfjorden.src} alt="" width={PHOTOS.sniksfjorden.w} height={PHOTOS.sniksfjorden.h} sizes="96px" />}
              </span>
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      <aside className="spanel" aria-label="Tomter">
        <header>
          <div className="crumb"><Link href="/">Forside</Link> / Tomtene</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <h2 style={{ fontSize: "1.7rem" }}>Tomtevelger</h2>
            <span className="small">{visible.length} tomter</span>
          </div>
          <div className="filters" style={{ marginTop: 12 }} role="group" aria-label="Velg rekke">
            <button className="chip" aria-pressed={row === ""} onClick={() => go("plan", "")}>Alle</button>
            {(["A", "B", "C", "D"] as const).map((r) => (
              <button key={r} className="chip" aria-pressed={row === r} onClick={() => go("plan", r)}>Rekke {r}</button>
            ))}
          </div>
        </header>
        {p && (
          <div className="detail">
            <button type="button" className="back" onClick={() => setSel(null)}>‹ Alle tomter</button>
            <div className="eyebrow" style={{ margin: "6px 0 2px" }}>Valgt tomt</div>
            <h3>Tomt {p.n}, rekke {p.row}</h3>
            <p className="small" style={{ marginTop: 8 }}>Ønsket er sjøutsikt mot sør, ut Sniksfjorden, men det er ikke sikkert for alle tomtene. Størrelse, pris og byggegrense oppgis når reguleringen er vedtatt.</p>
            <dl className="kv">
              <div><dt>Sjøutsikt</dt><dd>Ønsket</dd></div>
              <div><dt>Terreng</dt><dd>{p.terrain}</dd></div>
              <div><dt>Tak</dt><dd>Sørvendt, så enkelt som mulig for solceller</dd></div>
              <div><dt>Status</dt><dd>Ikke lagt ut for salg</dd></div>
            </dl>
            <div className="cta-row" style={{ marginTop: 14 }}>
              <Link className="btn sm" href={`/kontakt?tomt=${p.n}`}>Meld interesse for tomten</Link>
            </div>
          </div>
        )}
        <div className="cards">
          {visible.map((q) => (
            <button key={q.n} type="button" className={`card${sel === q.n ? " sel" : ""}`} onClick={() => setSel(q.n)}>
              <span className="ico"><i /></span>
              <b>Tomt {q.n}</b>
              <span className="m">Rekke {q.row}</span>
              <span className="m"><span className="dot g" />Sjøutsikt ønsket</span>
            </button>
          ))}
        </div>
        <footer>Pris, størrelse og fremdrift oppgis når reguleringen er vedtatt. Salg skjer gjennom megler.</footer>
      </aside>
    </div>
  );
}
