"use client";
import { useMemo, useState } from "react";

/**
 * Smart control for one home, on real prices: given the day's power prices (NO2), the solar
 * forecast for the home and its load, find the cheapest plan for the battery, the water heater
 * and the car charger, and compare it with a home without control. The battery plan is solved
 * exactly (dynamic programming over the state of charge); the water heater and the car are put
 * in the cheapest hours they are allowed to run. Both plans end the day with the battery as full
 * as they began it, so neither borrows free energy from tomorrow. Everything runs in the browser.
 */
export type OptDay = { key: string; label: string; prices: number[]; live: boolean[]; pv: Record<string, number[]>; load: number[] };

/** soc has 25 entries: the charge at midnight, then after each hour. */
type Plan = { grid: number[]; soc: number[]; heater: number[]; car: number[]; cost: number; imported: number; exported: number };

const STEP = 0.5; // kWh resolution of the battery state

function place(need: number, maxKw: number, hours: number[], price: (h: number) => number) {
  const out = Array(24).fill(0);
  let left = need;
  for (const h of [...hours].sort((a, b) => price(a) - price(b))) {
    if (left <= 0) break;
    const e = Math.min(maxKw, left);
    out[h] = e;
    left -= e;
  }
  return out;
}

function evaluate(p: { buy: number[]; sell: number[]; pv: number[]; load: number[]; heater: number[]; car: number[] }, battery: { cap: number; kw: number; eta: number }, smart: boolean): Plan {
  const n = 24;
  const ec = Math.sqrt(battery.eta), ed = Math.sqrt(battery.eta);
  const S = Math.round(battery.cap / STEP);
  const base = p.load.map((l, h) => l + p.heater[h] + p.car[h] - p.pv[h]);
  const cost = (net: number, h: number) => (net > 0 ? net * p.buy[h] : net * p.sell[h]);
  let soc: number[] = [];
  let grid: number[] = [];
  if (!smart || S === 0) {
    // without control: the battery only stores the home's own solar surplus and covers its own deficit.
    // The day is run twice and the second kept, so the battery starts the day as it ended the one before.
    let s = (S / 2) * STEP;
    for (let pass = 0; pass < 2; pass++) {
      soc = [s];
      grid = [];
      for (let h = 0; h < n; h++) {
        let net = base[h];
        if (net < 0) { const c = Math.min(-net, battery.kw, (battery.cap - s) / ec); s += c * ec; net += c; }
        else { const d = Math.min(net, battery.kw, s * ed); s -= d / ed; net -= d; }
        grid.push(net);
        soc.push(s);
      }
    }
  } else {
    // exact plan: the cheapest path through the battery states, tried from several starting charges,
    // ending the day at least as full as it began
    const INF = 1e18;
    const maxStep = Math.floor(battery.kw / STEP + 1e-9);
    const startStep = Math.max(1, Math.round(S / 12));
    let bestCost = INF;
    let bestPath: number[] = [];
    for (let start = 0; start <= S; start += startStep) {
      const best = Array.from({ length: n + 1 }, () => new Float64Array(S + 1).fill(INF));
      const from = Array.from({ length: n }, () => new Int16Array(S + 1));
      best[0][start] = 0;
      for (let h = 0; h < n; h++) {
        for (let s = 0; s <= S; s++) {
          const c0 = best[h][s];
          if (c0 >= INF) continue;
          for (let t = Math.max(0, s - maxStep); t <= Math.min(S, s + maxStep); t++) {
            const d = (t - s) * STEP;
            const c = c0 + cost(base[h] + (d > 0 ? d / ec : d * ed), h);
            if (c < best[h + 1][t]) { best[h + 1][t] = c; from[h][t] = s; }
          }
        }
      }
      let end = start;
      for (let t = start; t <= S; t++) if (best[n][t] < best[n][end]) end = t;
      if (best[n][end] < bestCost) {
        bestCost = best[n][end];
        const path = [end];
        for (let h = n - 1; h >= 0; h--) path.unshift(from[h][path[0]]);
        bestPath = path;
      }
    }
    soc = bestPath.map((x) => x * STEP);
    for (let h = 0; h < n; h++) {
      const d = soc[h + 1] - soc[h];
      grid.push(base[h] + (d > 0 ? d / ec : d * ed));
    }
  }
  const total = grid.reduce((a, g, h) => a + cost(g, h), 0);
  return { grid, soc, heater: p.heater, car: p.car, cost: total, imported: grid.reduce((a, g) => a + Math.max(0, g), 0), exported: grid.reduce((a, g) => a + Math.max(0, -g), 0) };
}

function Num({ label, value, set, min, max, step, unit }: { label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; unit: string }) {
  return (
    <label className="grid gap-1 text-[13.5px]">
      <span className="flex justify-between"><span className="text-ink-2">{label}</span><span className="font-medium">{value} {unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} className="w-full accent-[var(--fjord)]" />
    </label>
  );
}

const CAR_HOURS = [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];

export default function Optimizer({ days, plots, defaultPlot, gridFee, no }: { days: OptDay[]; plots: { id: string; label: string }[]; defaultPlot: string; gridFee: number; no: boolean }) {
  const [dayKey, setDayKey] = useState(days[days.length - 1]?.key ?? "");
  const [plot, setPlot] = useState(defaultPlot);
  const [cap, setCap] = useState(14);
  const [heaterKwh, setHeaterKwh] = useState(4);
  const [carKwh, setCarKwh] = useState(10);
  const day = days.find((d) => d.key === dayKey) ?? days[0];

  const r = useMemo(() => {
    if (!day) return null;
    const pv = day.pv[plot] ?? Object.values(day.pv)[0];
    const buy = day.prices.map((p) => p + gridFee);
    const sell = day.prices.map((p) => Math.max(0, p));
    const eff = (h: number) => (pv[h] > day.load[h] ? sell[h] : buy[h]);
    const all = Array.from({ length: 24 }, (_, h) => h);
    const plain = { heater: place(heaterKwh, 2, [17, 18, 6, 7], () => 0), car: place(carKwh, 3.6, CAR_HOURS, (h) => CAR_HOURS.indexOf(h)) };
    const smartLoads = { heater: place(heaterKwh, 2, all, eff), car: place(carKwh, 3.6, CAR_HOURS, eff) };
    const battery = { cap, kw: 5, eta: 0.9 };
    const without = evaluate({ buy, sell, pv, load: day.load, ...plain }, battery, false);
    const withCtl = evaluate({ buy, sell, pv, load: day.load, ...smartLoads }, battery, true);
    return { without, withCtl, buy, pv };
  }, [day, plot, cap, heaterKwh, carKwh, gridFee]);

  if (!day || !r) return <p className="text-muted">{no ? "Ingen prisdata." : "No price data."}</p>;
  const kr = (v: number) => `${v.toFixed(2).replace(".", no ? "," : ".")} kr`;
  const kwh = (v: number) => v.toFixed(1).replace(".", no ? "," : ".");
  const saved = r.without.cost - r.withCtl.cost;
  const pct = r.without.cost > 0 ? (saved / r.without.cost) * 100 : 0;
  const W = 720, H = 230, top = 14, bottom = 26, left = 6, right = 6;
  const bw = (W - left - right) / 24;
  const maxKw = Math.max(1, ...r.withCtl.grid.map(Math.abs), ...r.without.grid.map(Math.abs));
  const maxP = Math.max(0.2, ...r.buy);
  const mid = top + (H - top - bottom) * 0.6;
  const room = Math.min(mid - top - 8, H - bottom - mid - 4);
  const kwY = (v: number) => mid - (Math.max(-maxKw, Math.min(maxKw, v)) / maxKw) * room;
  const pY = (v: number) => top + (1 - v / maxP) * (H - top - bottom);
  const socY = (v: number) => top + (1 - v / Math.max(0.5, cap)) * (H - top - bottom);

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_1fr] items-start">
      <div className="panel p-5 grid gap-4">
        <div className="seg w-full" role="tablist">
          {days.map((d) => <button key={d.key} type="button" role="tab" aria-selected={d.key === day.key} onClick={() => setDayKey(d.key)} className="flex-1">{d.label}</button>)}
        </div>
        <label className="grid gap-1 text-[13.5px]">
          <span className="text-ink-2">{no ? "Bolig" : "Home"}</span>
          <select className="input !py-2" value={plot} onChange={(e) => setPlot(e.target.value)}>{plots.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </label>
        <Num label={no ? "Batteri" : "Battery"} value={cap} set={setCap} min={0} max={30} step={1} unit="kWh" />
        <Num label={no ? "Varmtvann per døgn" : "Hot water per day"} value={heaterKwh} set={setHeaterKwh} min={0} max={10} step={0.5} unit="kWh" />
        <Num label={no ? "Elbil, lading per natt" : "Electric car, charge per night"} value={carKwh} set={setCarKwh} min={0} max={40} step={1} unit="kWh" />
        <div className="provenance">{no ? `Batteriet lader og leverer inntil 5 kW med 90 % virkningsgrad tur-retur. Bilen er hjemme fra 17 til 07 og lader med 3,6 kW. Uten styring varmes vannet morgen og kveld og bilen lades når den kommer hjem. Kjøpspris er spotpris pluss ${gridFee.toFixed(2).replace(".", ",")} kr nettleie som i energiregnskapet; overskudd selges til spotpris. Mva, strømstøtte og fastprisavtaler er ikke regnet med.` : `The battery charges and delivers up to 5 kW at 90 % round-trip efficiency. The car is home from 17 to 07 and charges at 3.6 kW. Without control, water is heated morning and evening and the car charges when it gets home. Buying is the spot price plus ${gridFee.toFixed(2)} kr grid tariff as in the energy budget; surplus is sold at spot. VAT, subsidies and fixed-price deals are not included.`}</div>
      </div>
      <div className="grid gap-4 min-w-0">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5"><div className="text-[13.5px] text-muted">{no ? "Uten styring" : "Without control"}</div><div className="num text-[32px] mt-2">{kr(r.without.cost)}</div><div className="text-[13px] text-muted mt-1">{no ? `strøm dette døgnet, ${kwh(r.without.imported)} kWh kjøpt` : `power this day, ${kwh(r.without.imported)} kWh bought`}</div></div>
          <div className="panel p-5"><div className="text-[13.5px] text-muted">{no ? "Med smart styring" : "With smart control"}</div><div className="num text-[32px] mt-2 text-pine">{kr(r.withCtl.cost)}</div><div className="text-[13px] text-muted mt-1">{no ? `${kwh(r.withCtl.imported)} kWh kjøpt, ${kwh(r.withCtl.exported)} kWh solgt` : `${kwh(r.withCtl.imported)} kWh bought, ${kwh(r.withCtl.exported)} kWh sold`}</div></div>
          <div className="panel p-5"><div className="text-[13.5px] text-muted">{no ? "Spart dette døgnet" : "Saved this day"}</div><div className="num text-[32px] mt-2">{kr(Math.max(0, saved))}</div><div className="text-[13px] text-muted mt-1">{saved > 0.005 ? `${Math.round(pct)} % ${no ? "lavere strømkostnad for boligen" : "lower power cost for the home"}` : (no ? "prisene er for jevne til å tjene på å flytte strøm i dag" : "prices are too even to gain from moving power today")}</div></div>
        </div>
        <div className="panel p-4 md:p-5">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={no ? "Plan time for time" : "Plan hour by hour"}>
            <line x1={left} x2={W - right} y1={mid} y2={mid} stroke="var(--line-strong)" />
            {r.withCtl.grid.map((g, h) => (
              <rect key={h} x={left + h * bw + bw * 0.18} y={g >= 0 ? kwY(g) : mid} width={bw * 0.64} height={Math.abs(kwY(g) - mid)} rx="2" fill={g >= 0 ? "var(--fjord)" : "var(--pine)"} opacity=".85">
                <title>{`${String(h).padStart(2, "0")}:00  ${g >= 0 ? (no ? "kjøper" : "buys") : (no ? "selger" : "sells")} ${Math.abs(g).toFixed(1)} kWh, ${no ? "pris" : "price"} ${r.buy[h].toFixed(2)} kr`}</title>
              </rect>
            ))}
            <polyline points={r.without.grid.map((g, h) => `${left + (h + 0.5) * bw},${kwY(g)}`).join(" ")} fill="none" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="4 4" />
            <polyline points={r.buy.map((p, h) => `${left + h * bw},${pY(p)} ${left + (h + 1) * bw},${pY(p)}`).join(" ")} fill="none" stroke="var(--amber)" strokeWidth="2" />
            {cap > 0 && <polyline points={r.withCtl.soc.map((s, h) => `${left + h * bw},${socY(s)}`).join(" ")} fill="none" stroke="var(--ink)" strokeWidth="1.5" />}
            {[0, 6, 12, 18].map((h) => <text key={h} x={left + h * bw + 2} y={H - 8} fontSize="11" fill="var(--muted)">{String(h).padStart(2, "0")}</text>)}
          </svg>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted mt-2">
            <span><span className="inline-block w-3 h-3 rounded-sm bg-fjord mr-1.5 align-[-2px]" />{no ? "kjøp fra nettet, med styring" : "bought from the grid, with control"}</span>
            <span><span className="inline-block w-3 h-3 rounded-sm bg-pine mr-1.5 align-[-2px]" />{no ? "salg av overskudd" : "surplus sold"}</span>
            <span><span className="inline-block w-4 border-t border-dashed border-[var(--muted)] mr-1.5 align-middle" />{no ? "uten styring" : "without control"}</span>
            <span><span className="inline-block w-4 border-t-2 border-amber mr-1.5 align-middle" />{no ? "strømpris" : "power price"}</span>
            {cap > 0 && <span><span className="inline-block w-4 border-t-2 border-ink mr-1.5 align-middle" />{no ? "batteriets lading" : "battery charge"}</span>}
          </div>
        </div>
        <div className="panel p-4 md:p-5 scroll-x">
          <table className="table table-tight min-w-[560px]">
            <thead><tr><th>{no ? "Time" : "Hour"}</th><th className="n">{no ? "Pris" : "Price"}</th><th className="n">{no ? "Sol" : "Solar"}</th><th>{no ? "Planen" : "The plan"}</th></tr></thead>
            <tbody>
              {Array.from({ length: 24 }, (_, h) => {
                const dSoc = r.withCtl.soc[h + 1] - r.withCtl.soc[h];
                const acts = [
                  dSoc > 0.05 ? (no ? `lader batteriet ${kwh(dSoc)} kWh` : `charges the battery ${kwh(dSoc)} kWh`) : dSoc < -0.05 ? (no ? `bruker batteriet ${kwh(-dSoc)} kWh` : `uses the battery ${kwh(-dSoc)} kWh`) : "",
                  r.withCtl.heater[h] > 0 ? (no ? "varmer vann" : "heats water") : "",
                  r.withCtl.car[h] > 0 ? (no ? "lader bilen" : "charges the car") : "",
                ].filter(Boolean);
                return (
                  <tr key={h}>
                    <td>{String(h).padStart(2, "0")}:00{!day.live[h] && <span className="text-muted"> *</span>}</td>
                    <td className="n">{r.buy[h].toFixed(2).replace(".", no ? "," : ".")}</td>
                    <td className="n">{kwh(r.pv[h])} kW</td>
                    <td>{acts.length ? acts.join(", ") : <span className="text-muted">{no ? "ingenting å flytte" : "nothing to move"}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="provenance mt-2">{no ? "* Timer uten værvarsel (passert tid) bruker modellens gjennomsnittlige skydekke." : "* Hours without a forecast (time gone by) use the model's average cloudiness."}</div>
        </div>
      </div>
    </div>
  );
}
