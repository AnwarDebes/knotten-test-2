"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { Plot, SceneState } from "@/lib/types";
import { useSim } from "@/lib/sim/useSim";
import { BUDGET_SCENARIO, homesOf } from "@/lib/sim/scenario";
import { frameAt } from "@/lib/sim/frame";
import { hourOf } from "@/lib/sim/inputs";
import { outage as runOutage } from "@/lib/sim/run";
import { DEFAULT_DATE } from "@/lib/solar";
import { plotName, plotNo } from "@/lib/format";
import { fmt } from "@/lib/facts/core";
import Dial, { type DialValue } from "./ui/Dial";
import Passport from "./ui/Passport";
import type { CameraPreset } from "./scene/KnottenScene";
import WalkHud from "./walk/WalkHud";
import { fitFor, loadHouses } from "./scene/house/frame";
import { addLook, requestClick, setLive, subscribeWalk, walkState, walkVersion, type LiveFigures, type WalkStart } from "./scene/house/walkState";
import { useTapFocus } from "./scene/tapFocus";
import { has3d } from "./scene/has3d";
import type { HouseFit } from "@/lib/house/plan";

const KnottenScene = dynamic(() => import("./scene/KnottenScene"), { ssr: false });

type Mode = "wipe" | "plot" | "field";
type Step = "fjord" | "field" | "plot" | "inside";
const STEPS: Step[] = ["fjord", "field", "plot", "inside"];
const STEP_MS = 8000;

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(change: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", change);
  return () => mq.removeEventListener("change", change);
}
const reducedNow = () => window.matchMedia(REDUCED).matches;
const reducedOnServer = () => false;

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
  // as the hero, the model opens in the journey's own June afternoon, so nothing is rebuilt (sky light, tree atlas,
  // shadows) at the moment the journey starts
  const [dial, setDial] = useState<DialValue>(hero && journey ? { month: 6, hour: 15 } : { month: DEFAULT_DATE.month, hour: DEFAULT_DATE.hour });
  const [showDial, setShowDial] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialPlot);
  const [preset, setPreset] = useState<CameraPreset>(journey ? "fjord" : "site");
  const [inside, setInside] = useState(false);
  const [outage, setOutage] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lost, setLost] = useState(false);
  // the model could not be loaded ("load", worth another try) or this browser cannot draw it ("no3d")
  const [failed, setFailed] = useState<"load" | "no3d" | null>(null);
  const [quality, setQuality] = useState<"full" | "lite">("full");
  const [sceneKey, setSceneKey] = useState(0);
  // on foot through a house (null: the camera views of the stage)
  const [walk, setWalk] = useState<{ plot: string; start: WalkStart } | null>(null);
  const [fits, setFits] = useState<HouseFit[] | null>(null);
  useEffect(() => {
    if (!armed) return;
    let alive = true;
    loadHouses().then((f) => { if (alive) setFits(plots.map((p) => fitFor(f, p))); });
    return () => { alive = false; };
  }, [armed, plots]);
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const summaryId = useId();

  // the plot the journey stands on: the page's own plot on a plot page, otherwise the plot with the most
  // winter sun among those with open sea
  const showcase = useMemo(() => {
    if (initialPlot && plots.some((p) => p.id === initialPlot)) return initialPlot;
    // open sea, well inside the parcel (so no neighbour's forest stands in the window), most winter sun
    const open = plots.filter((p) => p.view.open_sea_visible && p.zone !== "flat");
    const score = (p: Plot) => p.sun.dec21.hours + Math.min(40, p.terrain.dist_to_boundary_m ?? 0) / 12 + p.view.water_visible_deg / 40;
    return [...(open.length ? open : plots)].sort((a, b) => score(b) - score(a))[0]?.id ?? null;
  }, [plots, initialPlot]);

  // reduced motion: no slow turn of the camera while the model waits
  const calm = useSyncExternalStore(subscribeReduced, reducedNow, reducedOnServer);

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
    // the journey ends inside a house: the camera flies in and stands in the living room
    setWalk(s === "inside" && showcase ? { plot: showcase, start: "living" } : null);
    if (s === "fjord") { setMode("wipe"); setSelected(null); setPreset("fjord"); }
    if (s === "field") { setMode("wipe"); setSelected(null); setPreset("site"); }
    if (s === "plot") { setMode("plot"); setSelected(showcase); }
    if (s === "inside") { setMode("plot"); setSelected(showcase); }
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
  // eslint-disable-next-line react-hooks/set-state-in-effect -- starts when two outside events have both happened: the stage came into view and the model finished loading
  useEffect(() => { if (hero && journey && armed && ready && phase === "invite") start(); }, [hero, journey, armed, ready, phase, start]);
  // exploring from inside the house (the journey's last stop) goes on on foot, with the keys working at once;
  // on a plot's own page it stays on that plot; from anywhere else, the open field
  const explore = () => {
    if (walk) { setPhase("explore"); setMode("plot"); setFocus(true); return; }
    if (initialPlot) { setPhase("explore"); setInside(false); setMode("plot"); setSelected(initialPlot); setState("built"); return; }
    setPhase("explore"); setInside(false); setMode("wipe"); setSelected(null); setPreset("site"); setState("built");
  };

  const onContextLost = useCallback(() => { setLost(true); setReady(false); }, []);
  const retryLite = () => { setQuality("lite"); setLost(false); setSceneKey((k) => k + 1); };
  const onFailed = useCallback(() => { setReady(false); setFailed(has3d() ? "load" : "no3d"); }, []);
  const retryLoad = () => { setFailed(null); setSceneKey((k) => k + 1); };
  const plot = useMemo(() => plots.find((p) => p.id === selected) ?? null, [plots, selected]);
  // the living field: the energy simulation (the budget's scenario) at the dial's day and hour
  const homes = useMemo(() => homesOf(plots), [plots]);
  const { out: simOut } = useSim(homes, BUDGET_SCENARIO, armed && (mode === "field" || !!walk));
  const simHour = hourOf(2025, dial.month, 21, Math.floor(dial.hour));
  const sim = useMemo(() => {
    const r = simOut?.result;
    if (!r) return undefined;
    const cut = outage ? runOutage(r, simHour, 1, true) : null;
    return frameAt(r, simHour, cut, cut ? 0 : -1);
  }, [simOut, simHour, outage]);
  const simField = simOut?.result ? {
    pv: simOut.result.field.pvRoofs[simHour] + simOut.result.field.pvOffice[simHour] + simOut.result.field.wind[simHour],
    use: simOut.result.field.homes[simHour] + simOut.result.field.heatPumps[simHour] + simOut.result.field.office[simHour],
    soc: simOut.result.field.soc[simHour],
  } : null;
  // the visited house's own figures at the dial's hour, for its screens and the walk's panel
  useSyncExternalStore(subscribeWalk, walkVersion, walkVersion);
  const visit = walk ? walkState.visit : -1;
  // (the dial moves in quarter hours; the house's figures change by the hour, so they are worked out, and its screens
  // redrawn, only when the hour or the month changes)
  const dialMonth = dial.month, dialHour = Math.floor(dial.hour);
  const live = useMemo<LiveFigures | null>(() => {
    const r = simOut?.result;
    if (!r || visit < 0 || visit >= r.homes) return null;
    const h = simHour, k = visit;
    let yearPv = 0, yearUse = 0;
    for (let i = 0; i < r.pv[k].length; i++) { yearPv += r.pv[k][i]; yearUse += r.load[k][i]; }
    const local = { month: dialMonth, day: 21, hour: dialHour };
    return {
      pv: r.pv[k][h], use: r.load[k][h], hp: Math.max(0, r.load[k][h] - r.appliance[k][h]), soc: r.soc[k][h], share: r.share[k][h],
      grid: r.field.imp[h] - r.field.exp[h], temp: r.field.temp[h], price: r.field.buy[h], cop: r.field.cop[h] || 3.6,
      hour: local.hour, day: local.day, month: local.month, yearPv, yearUse, selfUse: 0,
      batteryKwh: r.scenario.batteryKwh, kwp: r.scenario.pvPerHomeKwp, offline: false,
    };
  }, [simOut, simHour, visit, dialMonth, dialHour]);
  useEffect(() => { setLive(live); }, [live]);
  const onReady = useCallback(() => setReady(true), []);
  const onPick = useCallback((id: string) => { if (walkState.visit >= 0 && walk) return; setSelected(id); setMode("plot"); setState("built"); setInside(false); setPhase("explore"); }, [walk]);

  const wipeActive = phase === "explore" && mode === "wipe" && !plot;
  const effectiveState: SceneState = mode === "field" ? "lived" : state;

  // the model takes the visitor's input after a click, or a tap on a touch screen (a swipe still scrolls the page)
  const takeFocus = useTapFocus(() => setFocus(true));

  // on foot: drag to look, a short click or tap to walk there
  const drag = useRef<{ x: number; y: number; t: number; moved: number; id: number } | null>(null);
  const onWalkPointer = (e: React.PointerEvent) => {
    if (!box.current) return;
    // a finger first taps the model awake; until then it scrolls the page
    if (e.pointerType === "touch" && !focus) { takeFocus(e); return; }
    if (e.type === "pointerdown") {
      setFocus(true);
      drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, id: e.pointerId };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (e.type === "pointermove") {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.moved += Math.hypot(dx, dy);
      addLook(dx, dy);
      d.x = e.clientX; d.y = e.clientY;
      return;
    }
    if (e.type === "pointerup" && d.moved < 8 && performance.now() - d.t < 450) {
      const r = box.current.getBoundingClientRect();
      requestClick(e.clientX - r.left, e.clientY - r.top);
    }
    drag.current = null;
  };
  const onPointer = (e: React.PointerEvent) => {
    if (walk) { onWalkPointer(e); return; }
    takeFocus(e);
    if (!wipeActive || !box.current || (e.pointerType === "touch" && !focus)) return;
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
  const lang = no ? "no" : "en";
  const hours = (h: number) => fmt(h, lang, 1);

  return (
    <div ref={root} role="region" aria-label={no ? "3D-modell av Knotten" : "3D model of Knotten"} aria-describedby={summaryId} className={`frame dark relative w-full transition-shadow duration-300 ${focus ? "ring-2 ring-amber" : ""}`} style={{ height: compact ? "min(70svh, 680px)" : hero ? "min(78svh, 820px)" : "min(84svh, 860px)" }}>
      <p id={summaryId} className="sr-only">
        {no
          ? "En 3D-modell av Knotten og omgivelsene, bygget fra målte data: fjorden, feltet med tomtene og et eksempelhus du kan gå inn i. Sol, utsikt og høyde for hver tomt står også som tekst på tomtesidene."
          : "A 3D model of Knotten and its surroundings, built from measured data: the fjord, the field with its plots and an example house you can walk into. Sun, view and height for every plot are also given as text on the plot pages."}
      </p>

      {/* isolate: the place names over the model keep their stacking order inside the model, under the panels */}
      <div ref={box} className={`absolute inset-0 isolate ${walk ? `cursor-grab ${focus ? "touch-none" : ""}` : ready && !focus ? "cursor-pointer" : ""}`} onPointerDown={onPointer} onPointerMove={onPointer} onPointerUp={onPointer} onPointerLeave={onPointer} onPointerCancel={onPointer}>
        {armed && !lost && !failed && (
          <KnottenScene
            key={sceneKey}
            quality={quality}
            paused={!visible}
            interactive={focus}
            calm={calm}
            onContextLost={onContextLost}
            onFailed={onFailed}
            state={effectiveState}
            wipe={wipeActive ? wipe : null}
            month={dial.month}
            hour={dial.hour}
            plots={plots}
            selectedPlot={mode === "plot" ? selected : null}
            inside={inside}
            preset={preset}
            labels={preset === "fjord" ? "wide" : "near"}
            walk={walk}
            locale={locale}
            sim={mode === "field" ? sim : undefined}
            showWind={mode === "field"}
            simPark={simOut?.info.park ?? null}
            outage={outage}
            onPick={onPick}
            onReady={onReady}
          />
        )}
        {ready && wipeActive && <div className="wipe-handle" style={{ left: `${wipe * 100}%` }} aria-hidden />}
        {ready && walk && phase === "explore" && <WalkHud locale={locale} plots={plots} fits={fits} live={live} onExit={() => { setWalk(null); setMode("plot"); setPhase("explore"); }} />}
        {ready && wipeActive && (
          <>
            <div className="absolute left-4 top-4 md:left-5 md:top-5 chip !bg-night/75 !text-white">{d.states.today}</div>
            <div className="absolute right-4 top-4 md:right-5 md:top-5 chip !bg-night/75 !text-white">{d.states[state]}</div>
          </>
        )}
      </div>
      {/* the still sits over the (opaque) canvas until the model has drawn, then fades away */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a plain still that fades out over the canvas; next/image adds nothing here */}
      <img src="/renders/web/site_after.webp" srcSet="/renders/web/site_after_960.webp 960w, /renders/web/site_after.webp 1920w" sizes="100vw" alt="" fetchPriority={hero ? "high" : "auto"} className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`} />

      {/* invitation: the journey, or plain opening (on a glass card, so it reads over a bright sky) */}
      {(!armed || (phase === "invite" && ready && !hero)) && !lost && !failed && (
        <div className="absolute inset-0 grid place-items-center p-4 bg-gradient-to-t from-night/60 via-night/10 to-transparent">
          <div className="glass text-center px-6 py-5 md:px-8 md:py-6 max-w-[460px]">
            {journey ? (
              <button className="btn btn-amber text-[16px] px-7 py-4" onClick={start}>{J.start}</button>
            ) : (
              <button className="btn btn-amber text-[16px] px-7 py-4" onClick={() => { setArmed(true); setPhase("explore"); }}>{S.open}</button>
            )}
            <p className="mt-3.5 text-[14px] leading-snug text-white/90 max-w-[40ch] mx-auto">
              {initialPlot
                ? (no ? `Fra fjorden, inn på feltet, ned på ${plotName(initialPlot, true).toLowerCase()} og inn i stua. Rundt et halvt minutt.` : `From the fjord, onto the field, down on ${plotName(initialPlot, false).toLowerCase()} and into the living room. About half a minute.`)
                : (no ? "Fra fjorden, inn på feltet, ned på tomten og inn i stua. Rundt et halvt minutt." : "From the fjord, onto the field, down on the plot and into the living room. About half a minute.")}
            </p>
            {journey && <button className="mt-2.5 text-[13.5px] underline underline-offset-4 text-white/85 hover:text-white" onClick={() => { setArmed(true); explore(); }}>{J.explore}</button>}
          </div>
        </div>
      )}
      {armed && !ready && !lost && !failed && (
        <div className="absolute inset-x-0 bottom-0 p-5 pointer-events-none">
          <div role="status" className="glass inline-flex items-center gap-3 px-4 py-3 text-[14px]">
            <span aria-hidden className="relative w-24 h-[2px] bg-white/20 overflow-hidden rounded"><span className="absolute inset-y-0 left-0 w-1/3 bg-amber animate-[loadbar_1.4s_ease-in-out_infinite]" /></span>
            <span>{S.opening}</span>
          </div>
          <style>{`@keyframes loadbar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
      )}
      {lost && (
        <div className="absolute inset-0 grid place-items-center bg-night/70">
          <div role="alert" className="glass p-6 text-center max-w-[40ch]">
            <div className="display text-[26px]">{S.lost}</div>
            <button className="btn btn-amber mt-4" onClick={retryLite}>{S.retry}</button>
          </div>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-4 bg-night/60">
          <div role="alert" className="glass p-6 text-center max-w-[42ch]">
            <div className="display text-[26px]">{failed === "load" ? S.failed : S.no3d}</div>
            <p className="mt-2 text-[14.5px] leading-snug text-white/90">{failed === "load" ? S.failedText : S.no3dText}</p>
            {failed === "load"
              ? <button className="btn btn-amber mt-4" onClick={retryLoad}>{S.again}</button>
              : <Link className="btn btn-amber mt-4 no-underline" href={`/${locale}/tomter`}>{S.toPlots}</Link>}
          </div>
        </div>
      )}

      {/* the journey: a caption and the stops */}
      {ready && inJourney && (
        <div className="absolute left-0 right-0 bottom-0 p-4 md:p-6 pointer-events-none">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
            <div key={step} className="glass p-4 md:p-5 max-w-[520px] pointer-events-auto rise-in">
              <div className="text-[12.5px] text-white/80">{STEPS.indexOf(step) + 1} / {STEPS.length}</div>
              <div className="display text-[26px] md:text-[30px] mt-1">{J.steps[step].title}</div>
              <p className="mt-1.5 text-[14.5px] text-white/90">{J.steps[step].text}</p>
              {step === "plot" && plot && (
                <div className="mt-2 text-[13px] text-white/85">{S.plot} {plotNo(plot.id)}: {hours(plot.sun.dec21.hours)} h {no ? "sol 21. desember" : "sun 21 December"}, {plot.view.water_visible_deg}° {no ? "sjø i sikt" : "water in view"}</div>
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
            {/* the stops: a thin bar each, inside a target big enough for a finger */}
            <div className="pointer-events-auto flex justify-end">
              {STEPS.map((s) => (
                <button key={s} onClick={() => { goTo(s); setPhase("paused"); }} aria-label={J.steps[s].title} aria-current={s === step ? "step" : undefined} className="group grid place-items-center min-h-6 min-w-6 px-[3px] py-2">
                  <span aria-hidden className={`block h-[6px] rounded-full transition-all ${s === step ? "w-10 bg-amber" : "w-4 bg-white/60 group-hover:bg-white/90"}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* exploring: modes, states, plots, cameras, sun */}
      {ready && walk && phase === "explore" && (
        <div className="absolute right-3 top-14 md:top-auto md:right-5 md:bottom-5 pointer-events-auto flex flex-col items-end" onPointerDown={(e) => e.stopPropagation()}>
          <button className="md:hidden chip !bg-night/75 !text-white mb-2" aria-expanded={showDial} onClick={() => setShowDial((s) => !s)}>{S.sunHint}</button>
          <div className={`${showDial ? "block" : "hidden"} md:block`}>
            <Dial value={dial} onChange={setDial} locale={locale} horizon={plots.find((p) => p.id === (walkState.visit >= 0 ? plots[walkState.visit]?.id : walk.plot))?.horizon_deg_by_bearing} />
          </div>
        </div>
      )}
      {ready && phase === "explore" && !walk && (
        <>
          {!focus && (
            <div className="absolute left-1/2 -translate-x-1/2 top-4 md:top-5 chip !bg-night/75 !text-white pointer-events-none">
              <span className="pointer-coarse:hidden">{no ? "Klikk i modellen for å styre den" : "Click the model to take control"}</span>
              <span className="hidden pointer-coarse:inline">{no ? "Trykk i modellen for å styre den" : "Tap the model to take control"}</span>
            </div>
          )}
          <div className="absolute left-0 right-0 bottom-0 p-3 md:p-5 pointer-events-none">
            <div className="flex flex-wrap items-end gap-3">
              <div className="pointer-events-auto glass p-3 md:p-4 grid gap-3 max-w-[520px]">
                <div className="seg" role="group" aria-label={no ? "Visning" : "View"}>
                  {tabs.map((tb) => (
                    <button key={tb.key} aria-pressed={mode === tb.key} onClick={() => pick(tb.key)}>{tb.label}</button>
                  ))}
                </div>
                <p className="text-[14px] text-white/90 max-w-[46ch] hidden sm:block">
                  {mode === "wipe" ? d.moves.wipe.sub : mode === "plot" ? d.moves.stand.sub : d.moves.field.sub}
                </p>
                {mode === "wipe" && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={no ? "Feltet" : "The field"}>
                    {(["cleared", "built", "lived"] as SceneState[]).map((s) => (
                      <button key={s} aria-pressed={state === s} onClick={() => setState(s)} className={`chip transition-colors ${state === s ? "!bg-amber !text-ink" : "hover:!bg-white/20"}`}>{d.states[s]}</button>
                    ))}
                  </div>
                )}
                {mode === "plot" && (
                  <>
                    <div className="flex flex-wrap gap-1 max-h-[112px] overflow-auto" role="group" aria-label={no ? "Tomter" : "Plots"}>
                      {plots.map((p) => (
                        <button key={p.id} aria-pressed={selected === p.id} aria-label={`${S.plot} ${plotNo(p.id)}${p.view.open_sea_visible ? (no ? ", åpent hav" : ", open sea") : ""}`} onClick={() => { setSelected(p.id); }} className={`chip !px-2 transition-colors ${selected === p.id ? "!bg-amber !text-ink" : p.view.open_sea_visible ? "!bg-white/20 hover:!bg-white/30" : "hover:!bg-white/20"}`} title={p.view.open_sea_visible ? (no ? "åpent hav" : "open sea") : ""}>
                          {plotNo(p.id)}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button aria-pressed={!inside} onClick={() => setInside(false)} className={`chip transition-colors ${!inside ? "!bg-white !text-ink" : "hover:!bg-white/20"}`}>{no ? "På terrassen" : "On the terrace"}</button>
                      {selected && <button onClick={() => { setInside(false); setFocus(true); setWalk({ plot: selected, start: "living" }); }} className="chip transition-colors hover:!bg-white/20">{no ? "Inne i stua" : "In the living room"}</button>}
                      {selected && <button onClick={() => { setInside(false); setFocus(true); setWalk({ plot: selected, start: "door" }); }} className="chip !bg-amber !text-ink hover:!bg-amber-deep">{no ? "Gå inn i huset" : "Walk into the house"}</button>}
                    </div>
                  </>
                )}
                {mode === "field" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button aria-pressed={outage} onClick={() => setOutage((o) => !o)} className={`chip transition-colors ${outage ? "!bg-amber !text-ink" : "hover:!bg-white/20"}`}>{outage ? S.gridOff : S.grid}</button>
                    {simField && <span className="text-[13px] text-white/85">{no ? "Produksjon" : "Production"} {fmt(Math.round(simField.pv), lang)} kW, {no ? "forbruk" : "use"} {fmt(Math.round(simField.use), lang)} kW, {no ? "batteri" : "battery"} {fmt(Math.round(simField.soc * 100), lang)} %</span>}
                  </div>
                )}
                {!plot && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={no ? "Kamera" : "Camera"}>
                    {(["fjord", "site", "drone", "knoll", "plan"] as CameraPreset[]).map((c) => (
                      <button key={c} aria-pressed={preset === c} onClick={() => setPreset(c)} className={`chip transition-colors ${preset === c ? "!bg-white !text-ink" : "hover:!bg-white/20"}`}>{S.cameras[c]}</button>
                    ))}
                  </div>
                )}
                {plot && (
                  <div className="md:hidden flex items-center gap-3 text-[14px]">
                    <span>{S.plot} {plotNo(plot.id)}: {hours(plot.sun.dec21.hours)} h {no ? "sol 21. des" : "sun 21 Dec"}</span>
                    <Link href={`/${locale}/tomter/${plot.id}`} className="underline">{d.cta.passport}</Link>
                  </div>
                )}
                {journey && <button className="text-[13px] underline text-white/85 hover:text-white justify-self-start" onClick={start}>{no ? "Se reisen igjen" : "See the journey again"}</button>}
              </div>
              <div className="pointer-events-auto ml-auto">
                <button className="md:hidden chip !bg-night/75 !text-white mb-2" aria-expanded={showDial} onClick={() => setShowDial((s) => !s)}>{S.sunHint}</button>
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
