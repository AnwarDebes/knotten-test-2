"use client";
/**
 * The energy simulator: the whole field through a whole year, hour by hour, on the 3D model.
 *
 * The weather is a typical year for Knotten (EU PVGIS), each home's panels are on its real roof with
 * its real horizon, the homes use what the energy budget says in the rhythm of real NO2 households,
 * the heat pumps follow the borehole field, the batteries and the neighbours even out the day, and
 * the grid takes and gives the rest at the budget's prices or at 2025's real hourly prices. The
 * 3D shows each hour: the sun and the clouds, panels lit by what they make, windows by what is used,
 * a charge bar by every house, and the power moving between houses and to the grid.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Plot } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { useSim } from "@/lib/sim/useSim";
import { BASE, BUDGET_SCENARIO, homesOf } from "@/lib/sim/scenario";
import { outage as runOutage, type Scenario } from "@/lib/sim/run";
import { hourDate, hourOf, localOf } from "@/lib/sim/inputs";
import { cloudsAt, frameAt } from "@/lib/sim/frame";
import { BUDGET, SHARED_PANELS, fmt } from "@/lib/facts";
import type { SimFrame } from "../scene/twin/SimLayer";
import { MODULE } from "../scene/twin/TwinHouses";
import { useTapFocus } from "../scene/tapFocus";
import { has3d } from "../scene/has3d";
import { DayChart, FlowBars, MonthChart, YearStrip, COLORS } from "./simCharts";
import s from "./EnergySimulator.module.css";

const KnottenScene = dynamic(() => import("../scene/KnottenScene"), { ssr: false });

const YEAR = 2025;
type Pv = "budget" | "full";
type Controls = { pv: Pv; park: boolean; wind: boolean; battery: 0 | 10 | 14; sharing: boolean; prices: "budget" | "spot2025" };
const DEFAULTS: Controls = { pv: "budget", park: false, wind: true, battery: 14, sharing: true, prices: "budget" };

/** The most modules the view-side roof slope of these houses holds (rows from the eaves up). */
function fullRoofKwp(plots: Plot[]) {
  const p = plots[0];
  if (!p) return 10;
  const hd = p.house.depth_m / 2, ov = 0.5;
  const rise = p.house.ridge_m - p.house.eaves_m;
  const len = Math.hypot(hd + ov, rise + ov * (rise / hd) + 0.12);
  const rows = Math.floor((len - 0.45) / (MODULE.h + 0.02));
  const per = Math.floor((p.house.width_m + 2 * ov - 0.6) / (MODULE.w + 0.02));
  return (rows * per * MODULE.wp) / 1000;
}

function scenarioOf(c: Controls, plots: Plot[]): Scenario {
  return {
    ...BUDGET_SCENARIO,
    pvPerHomeKwp: c.pv === "full" ? fullRoofKwp(plots) : BUDGET_SCENARIO.pvPerHomeKwp,
    parkKwp: c.park ? (SHARED_PANELS * MODULE.wp) / 1000 : 0,
    windKw: c.wind ? BUDGET.wind.installed_kw : 0,
    batteryKwh: c.battery,
    sharing: c.sharing,
    prices: c.prices,
  };
}

export default function EnergySimulator({ plots, locale, variant = "moderne" }: { plots: Plot[]; locale: Locale; variant?: "moderne" | "klassisk" }) {
  const no = locale === "no";
  const nb = (v: number) => fmt(Math.round(v), no ? "no" : "en");
  const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", no ? "," : ".")} %`;
  const [c, setC] = useState<Controls>(DEFAULTS);
  const homes = useMemo(() => homesOf(plots), [plots]);
  const scenario = useMemo(() => scenarioOf(c, plots), [c, plots]);
  const { out, busy, error } = useSim(homes, scenario);
  const r = out?.result ?? null;

  // the clock: a float of hours since 1 January 00:00 UTC; the scene's sun moves smoothly with it
  const [t, setT] = useState(() => hourOf(YEAR, 3, 21, 12));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);           // hours per second
  const h = Math.max(0, Math.min(8759, Math.floor(t)));
  const loc = localOf(YEAR, h);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((x) => (x + dt * speed) % 8760);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  // power cut drill
  const [cut, setCut] = useState<{ start: number; hours: number; essential: boolean; emergency: boolean } | null>(null);
  const cutResult = useMemo(() => (r && cut ? runOutage(r, cut.start, cut.hours, cut.essential, cut.emergency ? 200 : 0) : null), [r, cut]);
  const inCut = !!(cut && cutResult && h >= cut.start && h < cut.start + cut.hours);

  // the 3D: armed when the simulator scrolls into view, paused when it leaves
  const root = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [focus, setFocus] = useState(false);
  // phones, tablets and data saving get the still and a button, as on the front page: the model is opened, not pushed
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const capable = !window.matchMedia("(pointer: coarse)").matches && !nav.connection?.saveData;
    const io = new IntersectionObserver((es) => es.forEach((e) => { setVisible(e.isIntersecting); if (e.isIntersecting && capable) setArmed(true); if (!e.isIntersecting) setFocus(false); }), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const takeFocus = useTapFocus(() => setFocus(true));
  useEffect(() => {
    if (!focus) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setFocus(false); };
    const down = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setFocus(false); };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("pointerdown", down); };
  }, [focus]);
  const onReady = useCallback(() => setReady(true), []);
  // the model could not be loaded or lost its graphics context ("load", worth another try), or this browser cannot draw it
  const [failed, setFailed] = useState<"load" | "no3d" | null>(null);
  const [sceneKey, setSceneKey] = useState(0);
  const onFailed = useCallback(() => { setReady(false); setFailed(has3d() ? "load" : "no3d"); }, []);

  const frame: SimFrame | undefined = useMemo(() => (r ? frameAt(r, h, inCut ? cutResult : null, cut ? h - cut.start : -1) : undefined), [r, h, cut, inCut, cutResult]);
  const simDate = useMemo(() => new Date(hourDate(YEAR, 0).getTime() + t * 3600 * 1000), [t]);
  const sunEl = useMemo(() => {
    // a quick elevation for the cloud estimate (the scene computes the exact sun itself)
    const d = loc.month * 30.4 - 15, decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (d - 81));
    const ha = (loc.hour + 0.5 - 12.3 - (loc.offset - 1)) * 15;
    const lat = 58.068;
    const sinE = Math.sin((lat * Math.PI) / 180) * Math.sin((decl * Math.PI) / 180) + Math.cos((lat * Math.PI) / 180) * Math.cos((decl * Math.PI) / 180) * Math.cos((ha * Math.PI) / 180);
    return (Math.asin(sinE) * 180) / Math.PI;
  }, [loc.month, loc.hour, loc.offset]);
  const weather = useMemo(() => (r ? { clouds: cloudsAt(r.field.ghi[h], sunEl), wind: r.field.wind10[h] } : undefined), [r, h, sunEl]);

  const jump = (month: number, day: number, hour: number) => { setT(hourOf(YEAR, month, day, hour) + 0.5); setCut(null); };
  const months = no ? ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"] : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekdays = no ? ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"] : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const set = <K extends keyof Controls>(k: K, v: Controls[K]) => setC((x) => ({ ...x, [k]: v }));
  const isBudget = JSON.stringify(c) === JSON.stringify(DEFAULTS);
  const T = r?.totals;
  const F = r?.field;
  const kw = (v: number) => (v < 10 ? v.toFixed(1).replace(".", no ? "," : ".") : nb(v));

  return (
    <div ref={root} className={`${s.sim} ${variant === "klassisk" ? s.klassisk : ""}`}>
      <div className={s.top}>
        <div>
          <div className={s.title}>{no ? "Energisimulatoren: feltet time for time gjennom et år" : "The energy simulator: the field hour by hour through a year"}</div>
          <div className={s.sub}>{no ? "Velg tiltak, trykk spill av eller dra i året. Tallene er en modell bygget på energiregnskapet og ekte data, ikke målinger." : "Choose measures, press play or drag through the year. The figures are a model built on the energy budget and real data, not measurements."}</div>
        </div>
      </div>

      <div className={s.controls} role="group" aria-label={no ? "Tiltak i simuleringen" : "Measures in the simulation"}>
        <span className={s.group}>
          <span className={s.groupLabel}>{no ? "Solceller per bolig" : "Solar per home"}</span>
          <button className={s.chip} aria-pressed={c.pv === "budget"} onClick={() => set("pv", "budget")}>{no ? `${fmt(Math.round(BUDGET_SCENARIO.pvPerHomeKwp * 10) / 10, "no")} kWp (regnskapet)` : `${fmt(Math.round(BUDGET_SCENARIO.pvPerHomeKwp * 10) / 10, "en")} kWp (budget)`}</button>
          <button className={s.chip} aria-pressed={c.pv === "full"} onClick={() => set("pv", "full")}>{no ? `Fullt sørtak, ${fmt(Math.round(fullRoofKwp(plots) * 10) / 10, "no")} kWp` : `Full south roof, ${fmt(Math.round(fullRoofKwp(plots) * 10) / 10, "en")} kWp`}</button>
        </span>
        <span className={s.group}>
          <span className={s.groupLabel}>{no ? "Felles" : "Shared"}</span>
          <button className={s.chip} aria-pressed={c.park} onClick={() => set("park", !c.park)}>{no ? `Solpark, ${SHARED_PANELS} paneler` : `Solar plant, ${SHARED_PANELS} panels`}</button>
          <button className={s.chip} aria-pressed={c.wind} onClick={() => set("wind", !c.wind)}>{no ? `Vind, ${BUDGET.wind.turbines} x ${BUDGET.wind.kw_each} kW` : `Wind, ${BUDGET.wind.turbines} x ${BUDGET.wind.kw_each} kW`}</button>
          <button className={s.chip} aria-pressed={c.sharing} onClick={() => set("sharing", !c.sharing)}>{no ? "Deling i feltet" : "Sharing in the field"}</button>
        </span>
        <span className={s.group}>
          <span className={s.groupLabel}>{no ? "Batteri per bolig" : "Battery per home"}</span>
          {([0, 10, 14] as const).map((b) => <button key={b} className={s.chip} aria-pressed={c.battery === b} onClick={() => set("battery", b)}>{b ? `${b} kWh` : (no ? "Ingen" : "None")}</button>)}
        </span>
        <span className={s.group}>
          <span className={s.groupLabel}>{no ? "Strømpris" : "Power price"}</span>
          <button className={s.chip} aria-pressed={c.prices === "budget"} onClick={() => set("prices", "budget")}>{no ? `Regnskapets, ${fmt(BUDGET.prices.buy_nok, "no", 2)} kr` : `The budget's, ${fmt(BUDGET.prices.buy_nok, "en", 2)} kr`}</button>
          <button className={s.chip} aria-pressed={c.prices === "spot2025"} onClick={() => set("prices", "spot2025")}>{no ? "Timespris NO2 2025" : "Hourly price NO2 2025"}</button>
        </span>
        {!isBudget && <button className={`${s.chip} ${s.reset}`} onClick={() => setC(DEFAULTS)}>{no ? "Tilbake til energiregnskapet" : "Back to the energy budget"}</button>}
      </div>

      <div className={s.main} style={{ marginTop: 14 }}>
        <div className={s.stage} onPointerDown={takeFocus} onPointerUp={takeFocus} onPointerCancel={takeFocus}>
          {armed && r && !failed && (
            <KnottenScene
              key={sceneKey} onFailed={onFailed} onContextLost={onFailed}
              state="lived" wipe={null} month={loc.month} hour={loc.hour} plots={plots} selectedPlot={null} preset="site"
              quality="full" paused={!visible} interactive={focus} onReady={onReady}
              simDate={simDate} weather={weather} sim={frame} simPark={out?.info.park ?? null} showPark={c.park} showWind={c.wind}
              labels="near" locale={locale}
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- a plain still that fades out over the canvas */}
          <img src="/renders/web/site_after.webp" alt="" className={s.poster} style={{ opacity: ready ? 0 : 1 }} />
          {!armed && <div className={s.open}><button className={s.btn} onClick={() => setArmed(true)}>{no ? "Åpne 3D-modellen" : "Open the 3D model"}</button></div>}
          {failed && (
            <div className={s.open} role="alert">
              <div className={s.failed}>
                <p>{failed === "load"
                  ? (no ? "Modellen kunne ikke vises. Tallene til høyre og under gjelder fortsatt." : "The model could not be shown. The figures beside and below still apply.")
                  : (no ? "Denne nettleseren viser ikke 3D-grafikk. Tallene til høyre og under gjelder fortsatt." : "This browser does not show 3D graphics. The figures beside and below still apply.")}</p>
                {failed === "load" && <button className={s.btn} onClick={() => { setFailed(null); setSceneKey((k) => k + 1); }}>{no ? "Prøv igjen" : "Try again"}</button>}
              </div>
            </div>
          )}
          {ready && !focus && <div className={s.hint}>{no ? "Klikk eller trykk i modellen for å styre den" : "Click or tap the model to take control"}</div>}
          {inCut && cut && <div className={s.outageTag}>{no ? `Strømbrudd, time ${h - cut.start + 1} av ${cut.hours}` : `Power cut, hour ${h - cut.start + 1} of ${cut.hours}`}</div>}
          {busy && <div className={s.busy}>{no ? "Regner ut året ..." : "Computing the year ..."}</div>}
          {/* read out when it stops or is moved, not 24 times a second while the year plays */}
          <div className={s.clock} aria-live={playing ? "off" : "polite"}>
            <div className={s.clockTime}>{String(loc.hour).padStart(2, "0")}:00</div>
            <div className={s.clockDate}>{weekdays[loc.weekday]} {loc.day}. {months[loc.month - 1]}</div>
          </div>
          <div className={s.legend3d}>
            <span><i className={s.dot} style={{ background: COLORS.roofs }} />{no ? "Panel som lyser: solstrøm" : "Glowing panels: solar power"}</span>
            <span><i className={s.dot} style={{ background: COLORS.export }} />{no ? "Gult: delt eller solgt" : "Amber: shared or sold"}</span>
            <span><i className={s.dot} style={{ background: COLORS.import }} />{no ? "Blått: kjøpt fra nettet" : "Blue: bought from the grid"}</span>
            <span><i className={s.dot} style={{ background: COLORS.soc }} />{no ? "Søyle ved huset: batteriet" : "Bar by the house: the battery"}</span>
          </div>
        </div>

        <div className={s.panel}>
          <div className={s.panelHead}>{no ? "Akkurat nå i simuleringen" : "Right now in the simulation"}</div>
          {r && F ? (
            <>
              <div className={s.weather}>
                <span>{kw(F.temp[h])} °C</span>
                <span>{no ? "vind" : "wind"} {kw(F.wind10[h])} m/s</span>
                <span>{no ? "sol" : "sun"} {nb(F.ghi[h])} W/m²</span>
                <span>{kw(F.buy[h])} kr/kWh</span>
              </div>
              <div className={s.now}>
                <div><div className={s.big}>{kw(F.pvRoofs[h] + F.pvOffice[h] + F.park[h] + F.wind[h])}<span className={s.small}> kW</span></div><div className={s.small}>{no ? "produseres i feltet" : "made in the field"}</div></div>
                <div><div className={s.big}>{kw(F.homes[h] + F.heatPumps[h] + F.office[h])}<span className={s.small}> kW</span></div><div className={s.small}>{no ? "brukes i feltet" : "used in the field"}</div></div>
                <div><div className={s.big}>{Math.round((inCut && cutResult && cut ? cutResult.soc[h - cut.start].reduce((a, b) => a + b, 0) / r.homes : F.soc[h]) * 100)} %</div><div className={s.small}>{no ? "batteriene i snitt" : "batteries on average"}</div></div>
                <div><div className={s.big}>{inCut ? "0" : kw(Math.abs(F.imp[h] - F.exp[h]))}<span className={s.small}> kW</span></div><div className={s.small}>{inCut ? (no ? "nettet er borte" : "the grid is down") : F.imp[h] >= F.exp[h] ? (no ? "kjøpes fra nettet" : "bought from the grid") : (no ? "selges til nettet" : "sold to the grid")}</div></div>
              </div>
              <FlowBars r={r} h={h} outage={inCut} no={no} />
            </>
          ) : (
            <div className={s.small}>{error ? (no ? "Simuleringen kunne ikke lastes." : "The simulation could not be loaded.") : (no ? "Laster vær, priser og forbruk ..." : "Loading weather, prices and use ...")}</div>
          )}
        </div>
      </div>

      <div className={s.timeline}>
        <button className={s.btn} aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? (no ? "Pause" : "Pause") : (no ? "Spill av" : "Play")}</button>
        <span className={s.group}>
          {([[1, no ? "1 time/s" : "1 h/s"], [4, no ? "4 timer/s" : "4 h/s"], [24, no ? "1 døgn/s" : "1 day/s"]] as const).map(([v, l]) => <button key={v} className={s.chip} aria-pressed={speed === v} onClick={() => setSpeed(v)}>{l}</button>)}
          <button className={s.chip} onClick={() => jump(12, 21, 12)}>{no ? "21. des" : "21 Dec"}</button>
          <button className={s.chip} onClick={() => jump(3, 21, 12)}>{no ? "21. mars" : "21 Mar"}</button>
          <button className={s.chip} onClick={() => jump(6, 21, 12)}>{no ? "21. juni" : "21 Jun"}</button>
        </span>
        {r ? <YearStrip r={r} year={YEAR} h={h} no={no} onPick={(d) => { setT(d * 24 + (h % 24) + 0.5); setCut(null); }} /> : <div />}
      </div>

      {r && T && (
        <>
          <div className={s.charts}>
            <div className={s.card}>
              <div className={s.cardTitle}>{no ? `Døgnet ${loc.day}. ${months[loc.month - 1]}` : `The day, ${loc.day} ${months[loc.month - 1]}`}</div>
              <div className={s.cardSub}>{no ? "Produksjon (flater), forbruk (linje), varmepumpene (stiplet) og batteriene (grønn, høyre akse)." : "Production (areas), use (line), the heat pumps (dashed) and the batteries (green, right axis)."}</div>
              <DayChart r={r} year={YEAR} h={h} no={no} />
              <div className={s.keys}>
                <span><i className={s.dot} style={{ background: COLORS.roofs }} />{no ? "Boligtak" : "Home roofs"}</span>
                <span><i className={s.dot} style={{ background: COLORS.office }} />{no ? "Kontor og lager" : "Office and workshop"}</span>
                {c.park && <span><i className={s.dot} style={{ background: COLORS.park }} />{no ? "Solpark" : "Solar plant"}</span>}
                {c.wind && <span><i className={s.dot} style={{ background: COLORS.wind }} />{no ? "Vind" : "Wind"}</span>}
                <span><i className={s.dot} style={{ background: COLORS.use }} />{no ? "Forbruk" : "Use"}</span>
              </div>
            </div>
            <div className={s.card}>
              <div className={s.cardTitle}>{no ? "Året måned for måned" : "The year month by month"}</div>
              <div className={s.cardSub}>{no ? "Produsert (gult) mot brukt (mørkt) i feltet, og hvor mye av forbruket som dekkes lokalt." : "Produced (amber) against used (dark) in the field, and how much of the use is covered locally."}</div>
              <MonthChart r={r} no={no} />
            </div>
          </div>

          <div className={s.figures}>
            <div className={s.fig}><div className={s.figValue}>{pct(T.selfSufficiency)}</div><div className={s.figLabel}>{no ? "av strømmen dekkes lokalt" : "of the power is covered locally"}</div><div className={s.figNote}>{no ? `Selvforsyning. Kjøpt fra nettet: ${nb(T.imp / 1000)} MWh i året.` : `Self-sufficiency. Bought from the grid: ${nb(T.imp / 1000)} MWh a year.`}</div></div>
            <div className={s.fig}><div className={s.figValue}>{nb(T.production / 1000)}<span className={s.figUnit}>MWh</span></div><div className={s.figLabel}>{no ? "produsert i feltet i året" : "produced in the field a year"}</div><div className={s.figNote}>{no ? `${pct(T.selfConsumption)} brukes i feltet, ${nb(T.exp / 1000)} MWh selges.` : `${pct(T.selfConsumption)} is used in the field, ${nb(T.exp / 1000)} MWh is sold.`}</div></div>
            <div className={s.fig}><div className={s.figValue}>{nb(T.savingPerHome)}<span className={s.figUnit}>kr</span></div><div className={s.figLabel}>{no ? "spart per bolig i året" : "saved per home a year"}</div><div className={s.figNote}>{no ? `Mot direkte elektrisk oppvarming uten sol og batteri, ${nb(T.saving)} kr for hele feltet.` : `Against direct electric heating without solar or batteries, ${nb(T.saving)} kr for the whole field.`}</div></div>
            <div className={s.fig}><div className={s.figValue}>{nb(T.co2Saved / 1000)}<span className={s.figUnit}>{no ? "tonn" : "tonnes"}</span></div><div className={s.figLabel}>{no ? "CO₂ spart i året" : "CO₂ saved a year"}</div><div className={s.figNote}>{no ? `Med energiregnskapets ${fmt(BUDGET.prices.co2_kg_per_kwh, "no")} kg per kWh nettstrøm.` : `With the energy budget's ${fmt(BUDGET.prices.co2_kg_per_kwh, "en")} kg per kWh of grid power.`}</div></div>
          </div>

          <div className={s.lower}>
            <div className={s.card}>
              <div className={s.cardTitle}>{no ? "Mot energiregnskapet" : "Against the energy budget"}</div>
              <div className={s.cardSub}>{no ? "Regnskapet regner måned for måned; simuleringen time for time med ekte vær. Med regnskapets egne forutsetninger lander de nær hverandre." : "The budget works month by month; the simulation hour by hour with real weather. With the budget's own assumptions they land close together."}</div>
              <table className={s.compare}>
                <thead><tr><th></th><th className={s.n}>{no ? "Regnskapet" : "Budget"}</th><th className={s.n}>{isBudget ? (no ? "Simuleringen" : "Simulation") : (no ? "Ditt valg" : "Your choice")}</th></tr></thead>
                <tbody>
                  <tr><td>{no ? "Selvforsyning strøm" : "Power self-sufficiency"}</td><td className={s.n}>{fmt(BUDGET.results.self_sufficiency_pct, no ? "no" : "en")} %</td><td className={s.n}>{pct(T.selfSufficiency)}</td></tr>
                  <tr><td>{no ? "Egenprodusert, kWh" : "Own production, kWh"}</td><td className={s.n}>{nb(BUDGET.results.own_production_kwh)}</td><td className={s.n}>{nb(T.production)}</td></tr>
                  <tr><td>{no ? "Spart per bolig, kr" : "Saved per home, kr"}</td><td className={s.n}>{nb(BUDGET.results.saving_per_home_nok)}</td><td className={s.n}>{nb(T.savingPerHome)}</td></tr>
                  <tr><td>{no ? "CO₂ spart, kg" : "CO₂ saved, kg"}</td><td className={s.n}>{nb(BUDGET.results.co2_saved_kg)}</td><td className={s.n}>{nb(T.co2Saved)}</td></tr>
                  <tr><td>{no ? "Varmepumpenes strøm, kWh" : "Heat pump power, kWh"}</td><td className={s.n}>{nb(BUDGET.heat_pump_el_kwh)}</td><td className={s.n}>{nb(T.heatPumpEl)}</td></tr>
                </tbody>
              </table>
              <div className={s.provenance}>{no ? `Solcellene i simuleringen gir i snitt ${nb(r.yieldPerKwp.roofsMean)} kWh per kWp på boligtakene (${nb(r.yieldPerKwp.worst)} til ${nb(r.yieldPerKwp.best)} etter takets retning og terrenget rundt), kalibrert mot EUs PVGIS, som gir ${nb(r.yieldPerKwp.pvgisSouth35)} kWh per kWp for et sørvendt panel på stedet. Regnskapet bruker ${BUDGET.pv.yield_kwh_per_kwp} kWh per kWp og ${BUDGET.pv.system_eff_pct} % systemvirkningsgrad.` : `The panels in the simulation give ${nb(r.yieldPerKwp.roofsMean)} kWh per kWp on the home roofs on average (${nb(r.yieldPerKwp.worst)} to ${nb(r.yieldPerKwp.best)} with the roof's direction and the terrain around), calibrated against the EU's PVGIS, which gives ${nb(r.yieldPerKwp.pvgisSouth35)} kWh per kWp for a south-facing panel on the spot. The budget uses ${BUDGET.pv.yield_kwh_per_kwp} kWh per kWp and ${BUDGET.pv.system_eff_pct} % system efficiency.`}</div>
            </div>
            <div className={`${s.card} ${s.outage}`}>
              <div className={s.cardTitle}>{no ? "Strømbrudd: hvor lenge holder feltet?" : "Power cut: how long does the field last?"}</div>
              <div className={s.cardSub}>{no ? `Nettet faller ut ${loc.day}. ${months[loc.month - 1]} kl. ${String(loc.hour).padStart(2, "0")}. Feltet går på egne paneler og batterier; hvert batteri holder ${Math.round(BUDGET_SCENARIO.reserve * 100)} % i reserve til nettopp dette.` : `The grid fails on ${loc.day} ${months[loc.month - 1]} at ${String(loc.hour).padStart(2, "0")}:00. The field runs on its own panels and batteries; each battery keeps ${Math.round(BUDGET_SCENARIO.reserve * 100)} % in reserve for exactly this.`}</div>
              <div className={s.controls}>
                <button className={s.btn} onClick={() => { setCut({ start: h, hours: 24, essential: cut?.essential ?? true, emergency: cut?.emergency ?? false }); setPlaying(true); setSpeed(2); }}>{no ? "Strømbrudd i 24 timer" : "Power cut for 24 hours"}</button>
                <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setCut({ start: h, hours: 48, essential: cut?.essential ?? true, emergency: cut?.emergency ?? false }); setPlaying(true); setSpeed(2); }}>{no ? "48 timer" : "48 hours"}</button>
              </div>
              <div className={s.controls}>
                <button className={s.chip} aria-pressed={cut?.essential ?? true} onClick={() => cut && setCut({ ...cut, essential: !cut.essential })} disabled={!cut}>{no ? "Bare det viktigste" : "Essentials only"}</button>
                <button className={s.chip} aria-pressed={cut?.emergency ?? false} onClick={() => cut && setCut({ ...cut, emergency: !cut.emergency })} disabled={!cut}>{no ? "Felles beredskapsbatteri 200 kWh" : "Shared emergency battery 200 kWh"}</button>
                {cut && <button className={`${s.chip} ${s.reset}`} onClick={() => setCut(null)}>{no ? "Strømmen tilbake" : "Power back"}</button>}
              </div>
              {cut && cutResult && (
                <div className={s.outageResult}>
                  {cutResult.firstDark < 0
                    ? (no ? `Alle ${r.homes} boligene har strøm hele tiden.` : `All ${r.homes} homes keep power the whole time.`)
                    : (no ? `Første bolig mister strømmen etter ${cutResult.firstDark} ${cutResult.firstDark === 1 ? "time" : "timer"}. Etter ${cut.hours} timer har ${cutResult.litAtEnd} av ${r.homes} strøm.` : `The first home loses power after ${cutResult.firstDark} ${cutResult.firstDark === 1 ? "hour" : "hours"}. After ${cut.hours} hours, ${cutResult.litAtEnd} of ${r.homes} have power.`)}
                  {" "}{no ? `${cut.essential ? "Bare det viktigste: varmepumpen på halv og en tredel av resten." : "Vanlig forbruk."} ${c.sharing ? "Boligene deler med hverandre." : "Hver bolig for seg."}` : `${cut.essential ? "Essentials only: the heat pump at half and a third of the rest." : "Normal use."} ${c.sharing ? "The homes share with each other." : "Each home on its own."}`}
                </div>
              )}
            </div>
          </div>

          <details className={s.method}>
            <summary>{no ? "Slik er simuleringen bygget, og hva den ikke vet" : "How the simulation is built, and what it does not know"}</summary>
            <ul>
              <li>{no ? "Været er et typisk år for Knotten fra EUs PVGIS (sol fra satellitt, temperatur og vind fra ERA5, 2005 til 2023), time for time." : "The weather is a typical year for Knotten from the EU's PVGIS (sun from satellite, temperature and wind from ERA5, 2005 to 2023), hour by hour."}</li>
              <li>{no ? "Hvert hus har panelene på sin egen takflate mot utsikten, med takets helning og retning og den målte horisonten fra Kartverkets terrengmodell. Lyset på taket regnes med Perez-modellen, panelene med samme modell som PVGIS, og hele modellen er kalibrert mot PVGIS." : "Every house has its panels on its own roof slope toward the view, with the roof's pitch and direction and the measured horizon from Kartverket's terrain model. Light on the roof uses the Perez model, the panels the same model as PVGIS, and the whole model is calibrated against PVGIS."}</li>
              <li>{no ? `Boligene bruker ${nb(BASE.elPerHome)} kWh strøm og ${nb(BASE.heatPerHome)} kWh varme i året, som i energiregnskapet. Døgnrytmen er hentet fra alle husholdninger i NO2 sommeren 2025 (Elhub), og hver bolig er litt forskjellig.` : `The homes use ${nb(BASE.elPerHome)} kWh of power and ${nb(BASE.heatPerHome)} kWh of heat a year, as in the energy budget. The daily rhythm comes from all households in NO2 in summer 2025 (Elhub), and every home is a little different.`}</li>
              <li>{no ? `Varmen kommer fra bergvarme med årsvarmefaktor ${fmt(BUDGET.bedrock.scop, "no")}. Virkningsgraden følger væsketemperaturen i brønnparken fra EED-simuleringen og utetemperaturen time for time.` : `The heat comes from ground-source heat pumps with a seasonal factor of ${fmt(BUDGET.bedrock.scop, "en")}. The efficiency follows the fluid temperature of the borehole field from the EED simulation and the outdoor temperature hour by hour.`}</li>
              <li>{no ? `Kontoret bruker ${nb(BASE.officeKwh)} kWh og lageret ${nb(BASE.workshopKwh)} kWh i året i arbeidstiden, som i regnskapet. Panelene på kontor og lager ligger på kontorbyggets sørvestvendte takflate, målt i laserdataene.` : `The office uses ${nb(BASE.officeKwh)} kWh and the workshop ${nb(BASE.workshopKwh)} kWh a year in working hours, as in the budget. The panels for office and workshop lie on the office building's south-west roof slope, measured in the laser data.`}</li>
              <li>{no ? "Vindtallet bygger på vindmodellen for regionen ved 10 meter, ikke på målinger på tomta; i skogen og bak åsene blåser det mindre. Regnskapet sier selv at vind krever måling." : "The wind figure builds on the regional wind model at 10 metres, not measurements on the site; in the forest and behind the hills it blows less. The budget itself says wind needs a measurement."}</li>
              <li>{no ? `Solparken med ${SHARED_PANELS} paneler og de tre turbinene er tegnet på Løkkeheia, det høyeste punktet bak feltet, som en illustrasjon av retningen fra prosjekteier. Plasseringen er ikke vurdert.` : `The plant of ${SHARED_PANELS} panels and the three turbines are drawn on Løkkeheia, the highest point behind the field, to illustrate the project owner's direction. The placement has not been assessed.`}</li>
              <li>{no ? "Deling i feltet betyr at overskudd hos én bolig dekker behov hos en annen før noe selges, slik deling på samme eiendom kan gjøres. Om det blir mulig, er ikke avklart." : "Sharing in the field means one home's surplus covers another's need before anything is sold, as sharing on the same property can be done. Whether it will be possible is not settled."}</li>
              <li>{no ? "Timesprisene er spotpris NO2 2025 uten mva, pluss regnskapets nettleie. Strømstøtte, Norgespris og effekttariff er ikke med." : "The hourly prices are the NO2 spot price for 2025 without VAT, plus the budget's grid fee. Electricity support, Norgespris and capacity tariffs are not included."}</li>
            </ul>
            <div className={s.provenance}>{no ? "Kilder: EU JRC PVGIS 5.3; Elhub; Nord Pool via hvakosterstrommen.no; Kartverket; energiregnskapet og EED-analysen fra energisporet, september 2026; retningen fra prosjekteier, 4. september 2026." : "Sources: EU JRC PVGIS 5.3; Elhub; Nord Pool via hvakosterstrommen.no; Kartverket; the energy budget and the EED analysis from the energy track, September 2026; the project owner's direction, 4 September 2026."}</div>
          </details>
        </>
      )}
    </div>
  );
}
