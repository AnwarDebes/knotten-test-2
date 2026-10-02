"use client";
/**
 * Small hand-drawn SVG charts for the energy simulator: one day hour by hour, the year by month,
 * every day of the year as a strip, and where the power comes from and goes to right now.
 */
import { useMemo } from "react";
import type { YearResult } from "@/lib/sim/run";
import { localOf } from "@/lib/sim/inputs";
import s from "./EnergySimulator.module.css";

export const COLORS = {
  roofs: "#e2a23b", office: "#c47a2c", park: "#f2c96b", wind: "#5a9bb0",
  use: "#17283a", heat: "#4f7156", import: "#2f6688", export: "#e9b45a", soc: "#3f8f5a", battery: "#3f8f5a",
};

const n1 = (v: number, no: boolean) => v.toLocaleString(no ? "nb-NO" : "en-GB", { maximumFractionDigits: 0 });

/** The 24 hours of the chosen day (local time): what the field makes, uses, buys and sells. */
export function DayChart({ r, year, h, no }: { r: YearResult; year: number; h: number; no: boolean }) {
  const W = 640, H = 220, padL = 40, padR = 40, padT = 12, padB = 26;
  const day = useMemo(() => {
    // the UTC hours that make up the local day containing h
    const l = localOf(year, h);
    const first = h - l.hour;
    const hours = Array.from({ length: 24 }, (_, i) => Math.max(0, Math.min(8759, first + i)));
    const F = r.field;
    const rows = hours.map((x) => ({
      roofs: F.pvRoofs[x], office: F.pvOffice[x], park: F.park[x], wind: F.wind[x],
      use: F.homes[x] + F.heatPumps[x] + F.office[x], heat: F.heatPumps[x],
      imp: F.imp[x], exp: F.exp[x], soc: F.soc[x],
    }));
    const max = Math.max(10, ...rows.map((q) => Math.max(q.roofs + q.office + q.park + q.wind, q.use)));
    return { rows, max, cur: l.hour };
  }, [r, year, h]);
  const x = (i: number) => padL + (i / 23) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / day.max) * (H - padT - padB);
  const ySoc = (v: number) => padT + (1 - v) * (H - padT - padB);
  const stack = ["roofs", "office", "park", "wind"] as const;
  const areas = stack.map((key, si) => {
    const top = day.rows.map((q) => stack.slice(0, si + 1).reduce((a, k) => a + q[k], 0));
    const bot = day.rows.map((q) => stack.slice(0, si).reduce((a, k) => a + q[k], 0));
    const d = top.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("") + bot.map((v, i) => i).reverse().map((i) => `L${x(i).toFixed(1)},${y(bot[i]).toFixed(1)}`).join("") + "Z";
    return { key, d };
  });
  const line = (vals: number[], f: (v: number) => number) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${f(v).toFixed(1)}`).join("");
  const ticks = [0, 0.5, 1].map((t) => t * day.max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} role="img" aria-label={no ? "Døgnet time for time: produksjon, forbruk og batteri" : "The day hour by hour: production, use and battery"}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className={s.grid} />
          <text x={padL - 6} y={y(t) + 4} className={s.axis} textAnchor="end">{n1(t, no)}</text>
        </g>
      ))}
      <text x={padL + 4} y={padT + 10} className={s.axis}>kW</text>
      {areas.map((a) => <path key={a.key} d={a.d} fill={COLORS[a.key]} opacity={0.85} />)}
      <path d={line(day.rows.map((q) => q.use), y)} fill="none" stroke={COLORS.use} strokeWidth={2.2} />
      <path d={line(day.rows.map((q) => q.heat), y)} fill="none" stroke={COLORS.heat} strokeWidth={1.4} strokeDasharray="4 3" />
      <path d={line(day.rows.map((q) => q.soc), ySoc)} fill="none" stroke={COLORS.soc} strokeWidth={1.6} />
      {[0, 6, 12, 18, 23].map((i) => <text key={i} x={x(i)} y={H - 8} className={s.axis} textAnchor="middle">{String(i).padStart(2, "0")}</text>)}
      <text x={W - padR + 6} y={ySoc(1) + 4} className={s.axis}>100 %</text>
      <text x={W - padR + 6} y={ySoc(0) + 4} className={s.axis}>0 %</text>
      <line x1={x(day.cur)} x2={x(day.cur)} y1={padT} y2={H - padB} className={s.now} />
    </svg>
  );
}

/** The year by month: produced in the field against used in the field. */
export function MonthChart({ r, no }: { r: YearResult; no: boolean }) {
  const W = 640, H = 200, padL = 40, padB = 26, padT = 18;
  const max = Math.max(...r.monthly.prod, ...r.monthly.use) / 1000;
  const bw = (W - padL - 10) / 12;
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const names = no ? ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} role="img" aria-label={no ? "Produksjon og forbruk per måned" : "Production and use per month"}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 10} y1={y(t * max)} y2={y(t * max)} className={s.grid} />
          <text x={padL - 6} y={y(t * max) + 4} className={s.axis} textAnchor="end">{n1(t * max, no)}</text>
        </g>
      ))}
      <text x={padL - 6} y={padT - 6} className={s.axis} textAnchor="end">MWh</text>
      {names.map((m, i) => {
        const p = r.monthly.prod[i] / 1000, u = r.monthly.use[i] / 1000;
        const share = r.monthly.use[i] > 0 ? Math.round((1 - r.monthly.imp[i] / r.monthly.use[i]) * 100) : 0;
        const x0 = padL + i * bw;
        return (
          <g key={m}>
            <rect x={x0 + bw * 0.12} y={y(p)} width={bw * 0.36} height={H - padB - y(p)} fill={COLORS.roofs} rx={2} />
            <rect x={x0 + bw * 0.52} y={y(u)} width={bw * 0.36} height={H - padB - y(u)} fill={COLORS.use} rx={2} />
            <text x={x0 + bw / 2} y={H - 8} className={s.axis} textAnchor="middle">{m}</text>
            <text x={x0 + bw / 2} y={Math.min(y(p), y(u)) - 4} className={s.tiny} textAnchor="middle">{share} %</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Every day of the year: surplus above the line (sun), deficit below (bought). Click to go there. */
export function YearStrip({ r, year, h, onPick, no }: { r: YearResult; year: number; h: number; onPick: (day: number) => void; no: boolean }) {
  const W = 730, H = 64, mid = 34;
  const days = useMemo(() => {
    const out: number[] = [];
    for (let d = 0; d < 365; d++) {
      let net = 0;
      for (let i = 0; i < 24; i++) {
        const x = d * 24 + i;
        net += r.field.pvRoofs[x] + r.field.pvOffice[x] + r.field.park[x] + r.field.wind[x] - (r.field.homes[x] + r.field.heatPumps[x] + r.field.office[x]);
      }
      out.push(net);
    }
    return out;
  }, [r]);
  const max = Math.max(1, ...days.map(Math.abs));
  const cur = Math.floor(h / 24);
  const months = no ? ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] : ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  void year;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.strip} role="slider" aria-label={no ? "Velg dag i året" : "Pick a day of the year"} aria-valuemin={1} aria-valuemax={365} aria-valuenow={cur + 1} tabIndex={0}
      onKeyDown={(e) => { if (e.key === "ArrowRight") onPick(Math.min(364, cur + 1)); if (e.key === "ArrowLeft") onPick(Math.max(0, cur - 1)); }}
      onPointerDown={(e) => { const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); onPick(Math.max(0, Math.min(364, Math.floor(((e.clientX - b.left) / b.width) * 365)))); }}>
      <line x1={0} x2={W} y1={mid} y2={mid} className={s.grid} />
      {days.map((v, d) => {
        const hgt = (Math.abs(v) / max) * (mid - 6);
        return <rect key={d} x={(d / 365) * W} y={v >= 0 ? mid - hgt : mid} width={W / 365 + 0.3} height={Math.max(0.6, hgt)} fill={v >= 0 ? COLORS.roofs : COLORS.import} opacity={0.85} />;
      })}
      {starts.map((d, i) => <text key={i} x={(d / 365) * W + 2} y={H - 2} className={s.tiny}>{months[i]}</text>)}
      <rect x={(cur / 365) * W - 1} y={2} width={3} height={H - 14} className={s.cursor} />
    </svg>
  );
}

/** Where the power comes from and where it goes, this hour, as two stacked columns. */
export function FlowBars({ r, h, outage, no }: { r: YearResult; h: number; outage: boolean; no: boolean }) {
  const F = r.field;
  const from = [
    { k: "roofs", v: F.pvRoofs[h], label: no ? "Sol på takene" : "Sun on the roofs" },
    { k: "office", v: F.pvOffice[h], label: no ? "Sol på kontor og lager" : "Sun on office and workshop" },
    { k: "park", v: F.park[h], label: no ? "Felles solpark" : "Shared solar plant" },
    { k: "wind", v: F.wind[h], label: no ? "Vind" : "Wind" },
    { k: "battery", v: F.discharge[h], label: no ? "Fra batteriene" : "From the batteries" },
    { k: "import", v: outage ? 0 : F.imp[h], label: no ? "Kjøpt fra nettet" : "Bought from the grid" },
  ].filter((q) => q.v > 0.05);
  const to = [
    { k: "use", v: F.homes[h], label: no ? "Husholdning" : "Households" },
    { k: "heat", v: F.heatPumps[h], label: no ? "Varmepumper" : "Heat pumps" },
    { k: "office", v: F.office[h], label: no ? "Kontor og lager" : "Office and workshop" },
    { k: "battery", v: F.charge[h], label: no ? "Lader batteriene" : "Charging batteries" },
    { k: "export", v: outage ? 0 : F.exp[h], label: no ? "Solgt til nettet" : "Sold to the grid" },
  ].filter((q) => q.v > 0.05);
  const total = Math.max(1, from.reduce((a, q) => a + q.v, 0), to.reduce((a, q) => a + q.v, 0));
  const col = (rows: typeof from, side: "from" | "to") => (
    <div className={s.flowCol}>
      <div className={s.flowHead}>{side === "from" ? (no ? "Kommer fra" : "Comes from") : (no ? "Går til" : "Goes to")}</div>
      {rows.map((q) => (
        <div key={q.k} className={s.flowRow}>
          <span className={s.flowBar} style={{ width: `${Math.max(3, (q.v / total) * 100)}%`, background: (COLORS as Record<string, string>)[q.k] ?? COLORS.use }} />
          <span className={s.flowLabel}>{q.label}</span>
          <span className={s.flowVal}>{q.v < 10 ? q.v.toFixed(1).replace(".", no ? "," : ".") : n1(q.v, no)} kW</span>
        </div>
      ))}
    </div>
  );
  return <div className={s.flows}>{col(from, "from")}{col(to, "to")}</div>;
}
