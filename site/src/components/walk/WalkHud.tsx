"use client";
/**
 * The page's side of the walk through a house: where you are, a plan of the floor you are on (with
 * the rooms' areas, and a dot for you), places to go, a stick to walk with on a touch screen, the
 * house's own figures from the energy simulation, and the spots that explain the house's measures.
 * The 3D scene moves and hides the spots every frame (WalkRig); this only draws them.
 */
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import type { Plot } from "@/lib/types";
import { HOUSE, PARTITIONS, ROOMS, STAIR, floorArea, keep, levelZ, roomArea, type HouseFit, type Level } from "@/lib/house/plan";
import { fmt } from "@/lib/facts";
import { plotNo } from "@/lib/format";
import Src from "../ui/Source";
import { HOTSPOTS, verdictLabel } from "./hotspots";
import { registerHot, requestGoto, setStick, subscribeWalk, walkState, walkVersion, type LiveFigures } from "../scene/house/walkState";

type Spot = { key: string; no: string; en: string; u: number; v: number; z: number; lowerOnly?: boolean };
const SPOTS: Spot[] = [
  { key: "hall", no: "Entreen", en: "The hall", u: 0.55, v: -2.7, z: 0 },
  { key: "living", no: "Stua", en: "Living room", u: 1.0, v: 2.6, z: 0 },
  { key: "kitchen", no: "Kjøkkenet", en: "Kitchen", u: -3.9, v: 1.2, z: 0 },
  { key: "tech", no: "Teknisk rom", en: "Plant room", u: -4.05, v: -1.9, z: 0 },
  { key: "bath", no: "Badet", en: "Bathroom", u: -1.45, v: -2.2, z: 0 },
  { key: "lower", no: "Underetasjen", en: "Lower floor", u: 0.4, v: 2.0, z: HOUSE.lower, lowerOnly: true },
  { key: "terrace", no: "Terrassen", en: "Terrace", u: 1.4, v: HOUSE.hd + 2.0, z: -0.03 },
];

export default function WalkHud({ locale, plots, fits, live, onExit }: { locale: Locale; plots: Plot[]; fits: HouseFit[] | null; live: LiveFigures | null; onExit: () => void }) {
  const no = locale === "no";
  useSyncExternalStore(subscribeWalk, walkVersion, walkVersion);
  const w = walkState;
  const plot = w.visit >= 0 ? plots[w.visit] : null;
  const fit = plot && fits ? fits[w.visit] : null;
  const lower = !!fit?.lower;
  const [open, setOpen] = useState<string | null>(null);
  // (the walk only runs in the browser, after the visitor has asked for it)
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const [planOpen, setPlanOpen] = useState(!touch);
  const [about, setAbout] = useState(false);
  const room = w.place.room ? ROOMS.find((r) => r.id === w.place.room) : null;
  const where = w.place.level === "outside" ? (no ? "Ute" : "Outside") : room ? room.name[locale] : "";
  const levelName = w.place.level === "lower" ? (no ? "underetasjen" : "lower floor") : w.place.level === "main" ? (no ? "hovedplanet" : "main floor") : "";
  const area = floorArea(lower);
  const go = (s: Spot) => requestGoto(s.u, s.v, s.z);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* where you are, and what this house is */}
      <div className="absolute left-3 top-3 md:left-5 md:top-5 pointer-events-auto glass px-3.5 py-2.5 max-w-[min(78vw,360px)]">
        <div className="text-[12px] text-white/65">{plot ? `${no ? "Tomt" : "Plot"} ${plotNo(plot.id)} · ${no ? "eksempelhus i modellen" : "example house in the model"}` : ""}</div>
        <div className="display text-[20px] md:text-[22px] leading-tight">{w.flying ? (no ? "På vei til huset ..." : "On the way to the house ...") : where}{levelName && !w.flying ? <span className="text-[14px] text-white/70">{` · ${levelName}`}</span> : null}</div>
        <button className="mt-1 text-[12.5px] underline text-white/75 hover:text-white" onClick={() => setAbout((a) => !a)}>{no ? "Om huset" : "About the house"}</button>
        {about && (
          <div className="mt-2 text-[13px] text-white/85 leading-snug">
            {no
              ? `Ingen hus er tegnet ennå. Dette er nettsidens eksempel på hvordan et hus på tomta kan bygges med tiltakene prosjektet har valgt: bergvarme, solceller, batteri, balansert ventilasjon, gjenvinning av dusjvann og smart styring. Byggestandarden er ikke bestemt. Huset er ${fmt(Math.round(area.total), "no")} m² BRA${lower ? `, hovedplan ${fmt(Math.round(area.main))} m² og underetasje ${fmt(Math.round(area.lower))} m²` : " på ett plan"}; der terrenget faller nok, får huset en underetasje mot hagen.`
              : `No house has been designed yet. This is the website's example of how a house on the plot can be built with the measures the project has chosen: ground-source heat, solar, a battery, balanced ventilation, heat recovery from shower water and smart control. The building standard has not been decided. The house is ${fmt(Math.round(area.total), "en")} m² of floor area${lower ? `, ${fmt(Math.round(area.main), "en")} m² on the main floor and ${fmt(Math.round(area.lower), "en")} m² below` : " on one floor"}; where the ground falls far enough, the house gets a lower floor towards the garden.`}
          </div>
        )}
      </div>

      {/* the plan of the floor you are on */}
      {fit && (
        <div className="absolute right-3 top-3 md:right-5 md:top-5 pointer-events-auto">
          <button className="chip !bg-night/70 !text-white mb-1.5 md:hidden" onClick={() => setPlanOpen((o) => !o)}>{no ? "Plan" : "Plan"}</button>
          {planOpen && <FloorPlan fit={fit} plot={plot!} level={w.place.level === "lower" ? "lower" : "main"} locale={locale} />}
        </div>
      )}

      {/* the spots that explain the house: moved by the 3D scene every frame */}
      {Object.keys(HOTSPOTS).map((id) => (
        <button
          key={id}
          ref={(el) => registerHot(id, el)}
          className="absolute left-0 top-0 -ml-[15px] -mt-[15px] w-[30px] h-[30px] rounded-full grid place-items-center pointer-events-auto transition-opacity duration-200"
          style={{ opacity: 0, background: "rgba(23,40,58,0.72)", border: "2px solid #e2a23b", boxShadow: "0 0 0 4px rgba(226,162,59,0.25)" }}
          aria-label={HOTSPOTS[id].title[locale]}
          title={HOTSPOTS[id].title[locale]}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpen(id); }}
        >
          <span className="block w-[8px] h-[8px] rounded-full bg-amber" />
        </button>
      ))}

      {/* what a spot explains */}
      {open && HOTSPOTS[open] && <InfoCard id={open} locale={locale} live={live} onClose={() => setOpen(null)} />}

      {/* places to go, how to walk, the way out */}
      <div className="absolute left-3 bottom-3 md:left-5 md:bottom-5 pointer-events-auto glass p-2.5 md:p-3 max-w-[min(92vw,540px)]" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap gap-1.5">
          {SPOTS.filter((s) => !s.lowerOnly || lower).map((s) => (
            <button key={s.key} className="chip hover:!bg-white/25" onClick={() => go(s)}>{s[locale]}</button>
          ))}
          <button className="chip !bg-white !text-ink" onClick={onExit}>{no ? "Avslutt" : "Leave"}</button>
        </div>
        <div className="mt-2 text-[12.5px] text-white/75 hidden sm:block">
          {touch
            ? (no ? "Bruk spaken for å gå, dra for å se deg rundt, trykk på gulvet for å gå dit." : "Use the stick to walk, drag to look around, tap the floor to walk there.")
            : (no ? "Gå med WASD eller piltastene, Shift for å løpe. Dra for å se deg rundt. Klikk på gulvet for å gå dit. Dørene åpner seg når du kommer." : "Walk with WASD or the arrow keys, Shift to run. Drag to look around. Click the floor to walk there. The doors open as you come.")}
        </div>
      </div>

      {/* the house's own figures, now */}
      {live && <LivePanel live={live} locale={locale} />}

      {touch && <Stick />}
    </div>
  );
}

/** The house's figures from the energy simulation at the hour on the dial. */
function LivePanel({ live, locale }: { live: LiveFigures; locale: Locale }) {
  const no = locale === "no";
  const n1 = (v: number) => fmt(Math.round(v * 10) / 10, no ? "no" : "en");
  const rows: [string, string][] = [
    [no ? "Sol på taket" : "Solar on the roof", `${n1(live.pv)} kW`],
    [no ? "Huset bruker" : "The house uses", `${n1(live.use)} kW`],
    [no ? "Varmepumpen" : "Heat pump", `${n1(live.hp)} kW`],
    [no ? "Batteriet" : "Battery", `${Math.round(live.soc * 100)} %`],
    [live.share >= 0 ? (no ? "Fra naboene" : "From neighbours") : (no ? "Til naboene" : "To neighbours"), `${n1(Math.abs(live.share))} kW`],
  ];
  return (
    <div className="absolute right-3 bottom-[148px] md:right-5 md:bottom-[218px] pointer-events-auto glass px-3.5 py-2.5 w-[210px] hidden sm:block" onPointerDown={(e) => e.stopPropagation()}>
      <div className="text-[12px] text-white/65">{no ? "Dette huset nå, i simuleringen" : "This house now, in the simulation"}</div>
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[13.5px]">
        {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-white/80">{k}</dt><dd className="text-right tabular-nums">{v}</dd></Fragment>))}
      </dl>
      <div className="mt-1.5 text-[11.5px] text-white/60 leading-snug">{no ? `I året gir taket om lag ${fmt(Math.round(live.yearPv), "no")} kWh, og huset bruker ${fmt(Math.round(live.yearUse), "no")} kWh.` : `In a year the roof makes about ${fmt(Math.round(live.yearPv), "en")} kWh, and the house uses ${fmt(Math.round(live.yearUse), "en")} kWh.`}</div>
    </div>
  );
}

function InfoCard({ id, locale, live, onClose }: { id: string; locale: Locale; live: LiveFigures | null; onClose: () => void }) {
  const no = locale === "no";
  const h = HOTSPOTS[id];
  const v = verdictLabel(h.measure, no);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-label={h.title[locale]} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:left-auto md:translate-x-0 md:right-[270px] md:top-5 md:translate-y-0 pointer-events-auto glass p-4 w-[min(92vw,380px)] rise-in" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div className="display text-[20px] leading-tight">{h.title[locale]}</div>
        <button aria-label={no ? "Lukk" : "Close"} className="text-white/70 hover:text-white text-[20px] leading-none" onClick={onClose}>×</button>
      </div>
      <p className="mt-2 text-[14px] text-white/85 leading-snug">{h.body[locale]}</p>
      {live && h.live && <p className="mt-2 text-[13.5px] text-amber">{h.live(live, no)}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {v && <span className={`chip ${v.verdict === "yes" ? "chip-pine" : "chip-amber"}`}>{`${v.name}: ${v.label}`}</span>}
        <Src id={h.source} locale={locale} />
      </div>
    </div>
  );
}

/**
 * The plan of one floor of the visited house, drawn from the same plan as the 3D (mirrored like the
 * house), with the view side at the top. A dot and a cone show where you stand and look; a click on
 * a room walks you there.
 */
function FloorPlan({ fit, plot, level, locale }: { fit: HouseFit; plot: Plot; level: Level; locale: Locale }) {
  const no = locale === "no";
  const S = 20;   // px per metre
  const pad = 8;
  const W = H2.w * S + 2 * pad, Hh = H2.d * S + 2 * pad;
  const mx = (u: number) => pad + ((fit.mirror ? -u : u) + HOUSE.hw) * S;
  const my = (v: number) => pad + (HOUSE.hd - v) * S;
  const rooms = ROOMS.filter((r) => r.level === level && keep(r, fit.lower) && r.id !== "stair");
  const parts = PARTITIONS.filter((p) => p.level === level && keep(p, fit.lower));
  const me = useRef<SVGGElement>(null);
  // follow the visitor without re-rendering: the dot's transform every frame
  useEffect(() => {
    let raf = 0;
    const f = (plot.house.facing_deg * Math.PI) / 180, ca = Math.cos(f), sa = Math.sin(f), m = fit.mirror ? -1 : 1;
    const tick = () => {
      const w = walkState;
      if (me.current) {
        // the view direction in the house frame, from the scene yaw
        const dx = -Math.sin(w.yaw), dn = Math.cos(w.yaw);
        const du = (dx * ca - dn * sa) * m, dv = dx * sa + dn * ca;
        const ang = (Math.atan2(-dv, (fit.mirror ? -du : du)) * 180) / Math.PI;
        const inside = Math.abs(w.u) < HOUSE.hw + 3.5 && Math.abs(w.v) < HOUSE.hd + 4;
        me.current.setAttribute("transform", `translate(${mx(w.u)} ${my(w.v)}) rotate(${ang})`);
        me.current.style.opacity = inside ? "1" : "0";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [plot, fit]);   // eslint-disable-line react-hooks/exhaustive-deps
  const walkTo = (u: number, v: number) => requestGoto(u, v, levelZ(level));
  return (
    <div className="glass p-2" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-1 text-[11.5px] text-white/70">
        <span>{level === "main" ? (no ? "Hovedplan" : "Main floor") : (no ? "Underetasje" : "Lower floor")}</span>
        <span>{no ? "Utsikten" : "The view"} ↑</span>
      </div>
      <svg width={W} height={Hh} viewBox={`0 0 ${W} ${Hh}`} className="block mt-1" role="img" aria-label={no ? "Plantegning" : "Floor plan"}>
        <rect x={mx(-HOUSE.hw) < mx(HOUSE.hw) ? mx(-HOUSE.hw) : mx(HOUSE.hw)} y={my(HOUSE.hd)} width={HOUSE.W * S} height={HOUSE.D * S} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.75)" strokeWidth={HOUSE.wall * S * 0.6} />
        {rooms.map((r) => {
          const x0 = Math.min(mx(r.rect.u0), mx(r.rect.u1)), x1 = Math.max(mx(r.rect.u0), mx(r.rect.u1));
          const cx = (x0 + x1) / 2, cy = (my(r.rect.v1) + my(r.rect.v0)) / 2;
          const a = roomArea(r, fit.lower);
          return (
            <g key={r.id} className="cursor-pointer" onClick={() => walkTo((r.rect.u0 + r.rect.u1) / 2, (r.rect.v0 + r.rect.v1) / 2 + (r.id === "living" ? 0.8 : 0))}>
              <rect x={x0} y={my(r.rect.v1)} width={x1 - x0} height={my(r.rect.v0) - my(r.rect.v1)} fill="rgba(255,255,255,0.04)" className="hover:fill-[rgba(226,162,59,0.18)]" />
              <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9.5" fill="#fff" style={{ pointerEvents: "none" }}>{shortName(r.id, no)}</text>
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.65)" style={{ pointerEvents: "none" }}>{fmt(Math.round(a * 10) / 10, no ? "no" : "en")} m²</text>
            </g>
          );
        })}
        {parts.map((p) => {
          const x0 = Math.min(mx(p.rect.u0), mx(p.rect.u1)), x1 = Math.max(mx(p.rect.u0), mx(p.rect.u1));
          return <rect key={p.id} x={x0} y={my(p.rect.v1)} width={Math.max(1.5, x1 - x0)} height={Math.max(1.5, my(p.rect.v0) - my(p.rect.v1))} fill="rgba(255,255,255,0.7)" />;
        })}
        {fit.lower && (
          <rect x={Math.min(mx(STAIR.u0), mx(STAIR.u1))} y={my(level === "main" ? STAIR.openTo : 0.27)} width={Math.abs(mx(STAIR.u1) - mx(STAIR.u0))} height={(level === "main" ? STAIR.openTo - STAIR.top : 0.27 - STAIR.top) * S} fill="none" stroke="rgba(226,162,59,0.8)" strokeDasharray="2 2" />
        )}
        <g ref={me}>
          <path d="M0 0 L22 -9 A24 24 0 0 1 22 9 Z" fill="rgba(226,162,59,0.35)" />
          <circle r="4.5" fill="#e2a23b" stroke="#fff" strokeWidth="1.5" />
        </g>
      </svg>
      <div className="px-1 pt-1 text-[11px] text-white/60">{no ? `${fmt(Math.round(floorArea(fit.lower).total), "no")} m² BRA i alt` : `${fmt(Math.round(floorArea(fit.lower).total), "en")} m² in all`}</div>
    </div>
  );
}
const H2 = { w: HOUSE.W, d: HOUSE.D };

function shortName(id: string, no: boolean) {
  const n: Record<string, [string, string]> = {
    tech: ["Teknisk", "Plant"], bath: ["Bad", "Bath"], hall: ["Entré", "Hall"], bedroom: ["Soverom", "Bedroom"], living: ["Kjøkken og stue", "Kitchen, living"],
    family: ["Allrom", "Family"], bed2: ["Soverom 2", "Bedroom 2"], bath2: ["Bad 2", "Bath 2"], bed3: ["Soverom 3", "Bedroom 3"], store: ["Bod", "Storage"],
  };
  return (n[id] ?? [id, id])[no ? 0 : 1];
}

/** A stick for walking on a touch screen: push it the way you want to go. */
function Stick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const id = useRef<number | null>(null);
  const set = (x: number, y: number) => {
    setStick(x, y);
    if (knob.current) knob.current.style.transform = `translate(${x * 34}px, ${-y * 34}px)`;
  };
  const move = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId || !base.current) return;
    const r = base.current.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    const k = l > 1 ? 1 / l : 1;
    set(dx * k, -dy * k);
  };
  return (
    <div
      ref={base}
      className="absolute left-4 bottom-[118px] w-[112px] h-[112px] rounded-full pointer-events-auto touch-none"
      style={{ background: "rgba(23,40,58,0.45)", border: "1.5px solid rgba(255,255,255,0.4)" }}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); id.current = e.pointerId; e.currentTarget.setPointerCapture?.(e.pointerId); move(e); }}
      onPointerMove={(e) => { e.stopPropagation(); move(e); }}
      onPointerUp={(e) => { e.stopPropagation(); id.current = null; set(0, 0); }}
      onPointerCancel={() => { id.current = null; set(0, 0); }}
      aria-label="Gå"
    >
      <div ref={knob} className="absolute left-1/2 top-1/2 -ml-[23px] -mt-[23px] w-[46px] h-[46px] rounded-full pointer-events-none touch-none" style={{ background: "rgba(255,255,255,0.85)" }} />
    </div>
  );
}
