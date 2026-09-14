"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { Plot, SceneState } from "@/lib/types";
import { frameFor } from "@/lib/energy";
import { DEFAULT_DATE } from "@/lib/solar";
import Dial, { type DialValue } from "./ui/Dial";
import Passport from "./ui/Passport";
import type { CameraPreset } from "./scene/KnottenScene";

const KnottenScene = dynamic(() => import("./scene/KnottenScene"), { ssr: false });

type Mode = "wipe" | "plot" | "field";
type Step = "fjord" | "field" | "plot" | "inside";
const STEPS: Step[] = ["fjord", "field", "plot", "inside"];
const STEP_MS = 8000;

/**
 * The stage, framed inside the page like a picture, never the whole screen. It holds a still until
 * the model is wanted, then offers a short journey: from the fjord, to the field, onto a plot, and
 * into the living room. Each stop is a short camera flight with one sentence. After the journey,
 * or whenever the visitor wants, the model can be explored freely. The page always scrolls: the
 * wheel and the drag go to the model only after a click inside it, and Escape hands them back.
 */
export default function Stage({ plots, locale, initialPlot = null, initialMode = "wipe", compact = false, journey = true, hero = false }: { plots: Plot[]; locale: Locale; initialPlot?: string | null; initialMode?: Mode; compact?: boolean; journey?: boolean; hero?: boolean }) {
  const d = t(locale);
  const S = d.stage;
  const J = d.journey;
  const no = locale === "no";
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [focus, setFocus] = useState(false);
  const [phase, setPhase] = useState<"invite" | "playing" | "paused" | "explore">(journey ? "invite" : "explore");
  const [step, setStep] = useState<Step>("fjord");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [state, setState] = useState<SceneState>(initialMode === "field" ? "lived" : "built");
  const [wipe, setWipe] = useState<number>(0.5);
  const [dial, setDial] = useState<DialValue>({ month: DEFAULT_DATE.month, hour: DEFAULT_DATE.hour });
  const [showDial, setShowDial] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialPlot);
  const [preset, setPreset] = useState<CameraPreset>(journey ? "fjord" : "site");
  const [inside, setInside] = useState(false);
  const [outage, setOutage] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lost, setLost] = useState(false);
  const [quality, setQuality] = useState<"full" | "lite">("full");
  const [sceneKey, setSceneKey] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  // the plot the journey stands on: most winter sun among the plots with open sea
  const showcase = useMemo(() => {
    // open sea, well inside the parcel (so no neighbour's forest stands in the window), most winter sun
    const open = plots.filter((p) => p.view.open_sea_visible && p.zone !== "flat");
    const score = (p: Plot) => p.sun.dec21.hours + Math.min(40, p.terrain.dist_to_boundary_m ?? 0) / 12 + p.view.water_visible_deg / 40;
    return [...(open.length ? open : plots)].sort((a, b) => score(b) - score(a))[0]?.id ?? null;
  }, [plots]);

  // auto-open on capable desktops as the stage scrolls in; pause the loop when scrolled away
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const capable = !window.matchMedia("(pointer: coarse)").matches && (nav.deviceMemory ?? 8) >= 4 && !nav.connection?.saveData && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        setVisible(e.isIntersecting);
        if (e.isIntersecting && capable) setArmed(true);
        if (!e.isIntersecting) { setFocus(false); setPhase((p) => (p === "playing" ? "paused" : p)); }
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!focus) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setFocus(false); };
    const down = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setFocus(false); };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("pointerdown", down); };
  }, [focus]);

  // apply a journey step to the scene
  const goTo = useCallback((s: Step) => {
    setStep(s);
    setInside(false);
    setState("built");
    if (s === "fjord") { setMode("wipe"); setSelected(null); setPreset("fjord"); }
    if (s === "field") { setMode("wipe"); setSelected(null); setPreset("site"); }
    if (s === "plot") { setMode("plot"); setSelected(showcase); }
    if (s === "inside") { setMode("plot"); setSelected(showcase); setInside(true); }
  }, [showcase]);
  // auto-advance while playing
  useEffect(() => {
    if (phase !== "playing" || !ready) return;
    const i = STEPS.indexOf(step);
    const id = setTimeout(() => {
      if (i < STEPS.length - 1) goTo(STEPS[i + 1]);
      else setPhase("paused");
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [phase, step, ready, goTo]);

  // the journey is shown in June light at three in the afternoon; the passports keep telling the December truth
  const start = useCallback(() => { setArmed(true); setPhase("playing"); setDial({ month: 6, hour: 15 }); goTo("fjord"); }, [goTo]);
  // as the hero, the journey begins on its own once the model is in (capable desktops only; others get the poster and a button)
  useEffect(() => { if (hero && journey && armed && ready && phase === "invite") start(); }, [hero, journey, armed, ready, phase, start]);
  const explore = () => { setPhase("explore"); setInside(false); setMode("wipe"); setSelected(null); setPreset("site"); setState("built"); };

  const onContextLost = useCallback(() => { setLost(true); setReady(false); }, []);
  const retryLite = () => { setQuality("lite"); setLost(false); setSceneKey((k) => k + 1); };
  const plot = useMemo(() => plots.find((p) => p.id === selected) ?? null, [plots, selected]);
  const frame = useMemo(() => frameFor(plots, dial.month, 21, dial.hour, { outage }), [plots, dial, outage]);
  const onReady = useCallback(() => setReady(true), []);
  const onPick = useCallback((id: string) => { setSelected(id); setMode("plot"); setState("built"); setInside(false); setPhase("explore"); }, []);

  const wipeActive = phase === "explore" && mode === "wipe" && !plot;
  const effectiveState: SceneState = mode === "field" ? "lived" : state;

  const onPointer = (e: React.PointerEvent) => {
    if (e.type === "pointerdown") setFocus(true);
    if (!wipeActive || !box.current) return;
    if (e.type === "pointerdown") setDragging(true);
    if (e.type === "pointerup" || e.type === "pointerleave") setDragging(false);
    if ((e.type === "pointermove" && dragging) || e.type === "pointerdown") {
      const r = box.current.getBoundingClientRect();
      setWipe(Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)));
    }
  };

  const tabs: { key: Mode; label: string }[] = [
    { key: "wipe", label: d.moves.wipe.title },
    { key: "plot", label: d.moves.stand.title },
    { key: "field", label: d.moves.field.title },
  ];
  const pick = (m: Mode) => {
    setMode(m);
    setInside(false);
    if (m === "field") setState("lived");
    if (m === "wipe") setState("built");
    if (m !== "plot") setSelected(null);
    if (m === "plot" && !selected) setSelected(showcase ?? plots[0]?.id ?? null);
  };
  const inJourney = phase === "playing" || phase === "paused";

  return (
    <div ref={root} className={`frame dark relative w-full transition-shadow duration-300 ${focus ? "ring-2 ring-amber" : ""}`} style={{ height: compact ? "min(70vh, 680px)" : hero ? "min(78vh, 820px)" : "min(84vh, 860px)" }}>
      <img src="/renders/web/site_after.webp" srcSet="/renders/web/site_after_960.webp 960w, /renders/web/site_after.webp 1920w" sizes="100vw" alt="" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`} />

      <div ref={box} className={`absolute inset-0 ${ready && !focus ? "cursor-pointer" : ""}`} onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerLeave={onPointer}>
        {armed && !lost && (
          <KnottenScene
            key={sceneKey}
            quality={quality}
            paused={!visible}
            interactive={focus}
            onContextLost={onContextLost}
            state={effectiveState}
            wipe={wipeActive ? wipe : null}
            month={dial.month}
            hour={dial.hour}
            plots={plots}
            selectedPlot={mode === "plot" ? selected : null}
            inside={inside}
            preset={preset}
            frame={frame}
            outage={outage}
            onPick={onPick}
            onReady={onReady}
          />
        )}
        {ready && wipeActive && <div className="wipe-handle" style={{ left: `${wipe * 100}%` }} aria-hidden />}
        {ready && wipeActive && (
          <>
            <div className="absolute left-4 top-4 md:left-5 md:top-5 chip">{d.states.today}</div>
            <div className="absolute right-4 top-4 md:right-5 md:top-5 chip">{d.states[state]}</div>
          </>
        )}
      </div>

      {/* invitation: the journey, or plain opening */}
      {(!armed || (phase === "invite" && ready && !hero)) && !lost && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-night/70 via-night/15 to-night/5">
          <div className="text-center px-6">
            {journey ? (
              <button className="btn btn-amber text-[16px] px-7 py-4" onClick={start}>{J.start}</button>
            ) : (
              <button className="btn btn-amber text-[16px] px-7 py-4" onClick={() => { setArmed(true); setPhase("explore"); }}>{S.open}</button>
            )}
            <div className="mt-4 text-[14px] opacity-85 max-w-[44ch]">{no ? "Fra fjorden, inn på feltet, ned på tomten og inn i stua. Rundt et halvt minutt." : "From the fjord, onto the field, down on the plot and into the living room. About half a minute."}</div>
            {journey && <button className="mt-3 text-[13px] underline opacity-70 hover:opacity-100" onClick={() => { setArmed(true); explore(); }}>{J.explore}</button>}
          </div>
        </div>
      )}
      {armed && !ready && !lost && (
        <div className="absolute inset-x-0 bottom-0 p-5 pointer-events-none">
          <div className="glass inline-flex items-center gap-3 px-4 py-3 text-[14px]">
            <span className="relative w-24 h-[2px] bg-white/20 overflow-hidden rounded"><span className="absolute inset-y-0 left-0 w-1/3 bg-amber animate-[loadbar_1.4s_ease-in-out_infinite]" /></span>
            <span>{S.opening}</span>
          </div>
          <style>{`@keyframes loadbar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
      )}
      {lost && (
        <div className="absolute inset-0 grid place-items-center bg-night/70">
          <div className="glass p-6 text-center max-w-[40ch]">
            <div className="display text-[26px]">{S.lost}</div>
            <button className="btn btn-amber mt-4" onClick={retryLite}>{S.retry}</button>
          </div>
        </div>
      )}

      {/* the journey: a caption and the stops */}
      {ready && inJourney && (
        <div className="absolute left-0 right-0 bottom-0 p-4 md:p-6 pointer-events-none">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
            <div key={step} className="glass p-4 md:p-5 max-w-[520px] pointer-events-auto rise-in">
              <div className="text-[12.5px] text-white/60">{STEPS.indexOf(step) + 1} / {STEPS.length}</div>
              <div className="display text-[26px] md:text-[30px] mt-1">{J.steps[step].title}</div>
              <p className="mt-1.5 text-[14.5px] text-white/85">{J.steps[step].text}</p>
              {step === "plot" && plot && (
                <div className="mt-2 text-[13px] text-white/75">{plot.id.replace("plot-", S.plot + " ")}: {plot.sun.dec21.hours.toFixed(1)} h {no ? "sol 21. desember" : "sun 21 December"}, {plot.view.water_visible_deg}° {no ? "sjø i sikt" : "water in view"}</div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {phase === "playing" ? (
                  <button className="btn btn-ghost btn-sm btn-plain" onClick={() => setPhase("paused")}>{J.stop}</button>
                ) : (
                  <button className="btn btn-sm btn-plain !bg-white !text-ink" onClick={() => { const i = STEPS.indexOf(step); if (i < STEPS.length - 1) { goTo(STEPS[i + 1]); setPhase("playing"); } else { goTo("fjord"); setPhase("playing"); } }}>{J.next}</button>
                )}
                <button className="btn btn-ghost btn-sm btn-plain" onClick={explore}>{J.explore}</button>
              </div>
            </div>
            <div className="pointer-events-auto flex gap-1.5 justify-end">
              {STEPS.map((s) => (
                <button key={s} onClick={() => { goTo(s); setPhase("paused"); }} aria-label={J.steps[s].title} className={`h-[6px] rounded-full transition-all ${s === step ? "w-10 bg-amber" : "w-4 bg-white/40 hover:bg-white/70"}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* exploring: modes, states, plots, cameras, sun */}
      {ready && phase === "explore" && (
        <>
          {!focus && <div className="absolute left-1/2 -translate-x-1/2 top-4 md:top-5 chip !bg-night/60 !text-white pointer-events-none">{no ? "Klikk i modellen for å styre den" : "Click the model to take control"}</div>}
          <div className="absolute left-0 right-0 bottom-0 p-3 md:p-5 pointer-events-none">
            <div className="flex flex-wrap items-end gap-3">
              <div className="pointer-events-auto glass p-3 md:p-4 grid gap-3 max-w-[520px]">
                <div className="seg" role="tablist">
                  {tabs.map((tb) => (
                    <button key={tb.key} role="tab" aria-selected={mode === tb.key} onClick={() => pick(tb.key)}>{tb.label}</button>
                  ))}
                </div>
                <p className="text-[14px] opacity-85 max-w-[46ch] hidden sm:block">
                  {mode === "wipe" ? d.moves.wipe.sub : mode === "plot" ? d.moves.stand.sub : d.moves.field.sub}
                </p>
                {mode === "wipe" && (
                  <div className="flex flex-wrap gap-1.5">
                    {(["cleared", "built", "lived"] as SceneState[]).map((s) => (
                      <button key={s} onClick={() => setState(s)} className={`chip transition-colors ${state === s ? "!bg-amber !text-ink" : "hover:!bg-white/20"}`}>{d.states[s]}</button>
                    ))}
                  </div>
                )}
                {mode === "plot" && (
                  <>
                    <div className="flex flex-wrap gap-1 max-h-[112px] overflow-auto">
                      {plots.map((p) => (
                        <button key={p.id} onClick={() => { setSelected(p.id); }} className={`chip !px-2 transition-colors ${selected === p.id ? "!bg-amber !text-ink" : p.view.open_sea_visible ? "!bg-white/20 hover:!bg-white/30" : "hover:!bg-white/20"}`} title={p.view.open_sea_visible ? (no ? "åpent hav" : "open sea") : ""}>
                          {p.id.replace("plot-", "")}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setInside(false)} className={`chip transition-colors ${!inside ? "!bg-white !text-ink" : "hover:!bg-white/20"}`}>{no ? "På terrassen" : "On the terrace"}</button>
                      <button onClick={() => setInside(true)} className={`chip transition-colors ${inside ? "!bg-white !text-ink" : "hover:!bg-white/20"}`}>{no ? "Inne i stua" : "In the living room"}</button>
                    </div>
                  </>
                )}
                {mode === "field" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => setOutage((o) => !o)} className={`chip transition-colors ${outage ? "!bg-amber !text-ink" : "hover:!bg-white/20"}`}>{outage ? S.gridOff : S.grid}</button>
                    <span className="text-[13px] opacity-80">PV {frame.field.pv_kw} kW, {no ? "last" : "load"} {frame.field.load_kw} kW, SOC {(frame.field.soc * 100).toFixed(0)} %</span>
                  </div>
                )}
                {!plot && (
                  <div className="flex flex-wrap gap-1.5">
                    {(["fjord", "site", "drone", "knoll", "plan"] as CameraPreset[]).map((c) => (
                      <button key={c} onClick={() => setPreset(c)} className={`chip transition-colors ${preset === c ? "!bg-white !text-ink" : "hover:!bg-white/20"}`}>{S.cameras[c]}</button>
                    ))}
                  </div>
                )}
                {plot && (
                  <div className="md:hidden flex items-center gap-3 text-[14px]">
                    <span>{S.plot} {plot.id.replace("plot-", "")}: {plot.sun.dec21.hours.toFixed(1)} h {no ? "sol 21. des" : "sun 21 Dec"}</span>
                    <Link href={`/${locale}/tomter/${plot.id}`} className="underline">{d.cta.passport}</Link>
                  </div>
                )}
                {journey && <button className="text-[13px] underline opacity-70 hover:opacity-100 justify-self-start" onClick={start}>{no ? "Se reisen igjen" : "See the journey again"}</button>}
              </div>
              <div className="pointer-events-auto ml-auto">
                <button className="md:hidden chip !bg-night/70 mb-2" onClick={() => setShowDial((s) => !s)}>{S.sunHint}</button>
                <div className={`${showDial ? "block" : "hidden"} md:block`}>
                  <Dial value={dial} onChange={setDial} locale={locale} horizon={plot?.horizon_deg_by_bearing} />
                </div>
              </div>
            </div>
          </div>
          {plot && mode === "plot" && !inside && (
            <div className="hidden md:block absolute top-4 right-4 w-[min(60vw,230px)] max-h-[calc(100%-300px)] overflow-auto pointer-events-auto">
              <Passport plot={plot} locale={locale} compact />
            </div>
          )}
        </>
      )}
    </div>
  );
}
