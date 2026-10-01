"use client";
import { useMemo, useState } from "react";

/**
 * Community energy sharing, simulated for the 30 homes: each home first uses its own solar and
 * battery; with sharing, the homes that take part give their surplus to neighbours who lack
 * power, then to a shared battery, before anything is sold. Twelve typical days (the 21st of
 * each month, from the model) give a yearly estimate.
 */
/** pv and load: [month][home][hour], kW. */
type Input = { pv: number[][][]; load: number[][][]; office: number[][]; officeKwh: number; plotLabels: string[]; kwpPerHome: number; buy: number; sell: number; no: boolean };
type DayResult = { imp: number[]; exp: number[]; shared: number[]; load: number; importKwh: number; exportKwh: number; sharedKwh: number; peak: number };

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function simulate(pv: number[][], load: number[][], take: boolean[], o: { home: number; hub: number; share: boolean; plantPv: number[]; office: number[] | null }): DayResult {
  const n = pv.length, eta = 0.95, homeKw = 5;
  const soc = Array(n).fill(o.home / 2);
  let hub = o.hub / 2;
  const out: DayResult = { imp: [], exp: [], shared: [], load: 0, importKwh: 0, exportKwh: 0, sharedKwh: 0, peak: 0 };
  // two days in a row, keeping the second, so the batteries start the day as they would end it
  for (let pass = 0; pass < 2; pass++) {
    out.imp = []; out.exp = []; out.shared = []; out.load = 0; out.importKwh = 0; out.exportKwh = 0; out.sharedKwh = 0; out.peak = 0;
    for (let h = 0; h < 24; h++) {
      let poolS = o.share ? o.plantPv[h] : 0, poolD = 0, imp = 0, exp = o.share ? 0 : o.plantPv[h];
      // the office building has no solar or battery of its own: with sharing it draws from the pool, without it buys everything
      if (o.office) { out.load += o.office[h]; if (o.share) poolD += o.office[h]; else imp += o.office[h]; }
      for (let i = 0; i < n; i++) {
        let net = pv[i][h] - load[i][h];
        out.load += load[i][h];
        if (net > 0) { const c = Math.min(net, homeKw, (o.home - soc[i]) / eta); soc[i] += c * eta; net -= c; }
        else { const d = Math.min(-net, homeKw, soc[i] * eta); soc[i] -= d / eta; net += d; }
        if (o.share && take[i]) { if (net > 0) poolS += net; else poolD += -net; }
        else if (net > 0) exp += net; else imp += -net;
      }
      const moved = Math.min(poolS, poolD);
      poolS -= moved; poolD -= moved;
      const hubKw = o.hub / 4;
      if (poolS > 0) { const c = Math.min(poolS, hubKw, (o.hub - hub) / eta); hub += c * eta; poolS -= c; }
      if (poolD > 0) { const d = Math.min(poolD, hubKw, hub * eta); hub -= d / eta; poolD -= d; }
      imp += poolD; exp += poolS;
      out.imp.push(imp); out.exp.push(exp); out.shared.push(moved);
      out.importKwh += imp; out.exportKwh += exp; out.sharedKwh += moved; out.peak = Math.max(out.peak, imp);
    }
  }
  return out;
}

function Slider({ label, value, set, min, max, step, unit, hint }: { label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; unit: string; hint?: string }) {
  return (
    <label className="grid gap-1 text-[13.5px]">
      <span className="flex justify-between gap-3"><span className="text-ink-2">{label}</span><span className="font-medium whitespace-nowrap">{value} {unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} className="w-full accent-[var(--fjord)]" />
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export default function SharingSim({ pv, load, office, officeKwh, plotLabels, kwpPerHome, buy, sell, no }: Input) {
  const [month, setMonth] = useState(3);
  const [part, setPart] = useState(100);
  const [home, setHome] = useState(14);
  const [hub, setHub] = useState(0);
  const [plant, setPlant] = useState(0);
  const [withOffice, setWithOffice] = useState(true);
  const n = plotLabels.length;
  const take = useMemo(() => {
    const k = Math.round((n * part) / 100);
    // spread the homes that take part evenly over the field
    return Array.from({ length: n }, (_, i) => Math.floor(((i + 1) * k) / n) > Math.floor((i * k) / n));
  }, [n, part]);

  const year = useMemo(() => Array.from({ length: 12 }, (_, m) => {
    // the shared plant: the homes' average output per kWp that day, scaled to the plant's size
    const plantPv = Array.from({ length: 24 }, (_, h) => (pv[m].reduce((a, p) => a + p[h], 0) / pv[m].length / kwpPerHome) * plant);
    const base = simulate(pv[m], load[m], take, { home, hub: 0, share: false, plantPv, office: withOffice ? office[m] : null });
    const shared = simulate(pv[m], load[m], take, { home, hub, share: true, plantPv, office: withOffice ? office[m] : null });
    return { base, shared };
  }), [pv, load, take, home, hub, plant, kwpPerHome, withOffice, office]);

  const sum = (f: (d: { base: DayResult; shared: DayResult }) => number) => year.reduce((a, d, m) => a + f(d) * DAYS_IN_MONTH[m], 0);
  const loadYear = sum((d) => d.base.load);
  const selfBase = 1 - sum((d) => d.base.importKwh) / loadYear;
  const selfShared = 1 - sum((d) => d.shared.importKwh) / loadYear;
  const sharedYear = sum((d) => d.shared.sharedKwh);
  const valueYear = (sum((d) => d.base.importKwh) - sum((d) => d.shared.importKwh)) * buy - (sum((d) => d.base.exportKwh) - sum((d) => d.shared.exportKwh)) * sell;
  const homesIn = take.filter(Boolean).length;
  const nf = (v: number) => Math.round(v).toLocaleString(no ? "nb-NO" : "en-GB");
  const pc = (v: number) => `${(v * 100).toFixed(0)} %`;
  const day = year[month - 1];
  const W = 720, H = 220, top = 12, bottom = 24, left = 6, right = 6, bw = (W - left - right) / 24;
  const maxKw = Math.max(1, ...day.base.imp, ...day.base.exp, ...day.shared.imp, ...day.shared.exp);
  const mid = top + (H - top - bottom) / 2;
  const y = (v: number) => mid - (v / maxKw) * (mid - top);
  const months = no ? ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_1fr] items-start">
      <div className="panel p-5 grid gap-4">
        <Slider label={no ? "Boliger som deler" : "Homes that share"} value={part} set={setPart} min={0} max={100} step={10} unit={`% (${homesIn})`} />
        <Slider label={no ? "Batteri i hver bolig" : "Battery in each home"} value={home} set={setHome} min={0} max={20} step={1} unit="kWh" hint={no ? "Energiregnskapet: 14 kWh" : "The energy budget: 14 kWh"} />
        <Slider label={no ? "Felles batteri" : "Shared battery"} value={hub} set={setHub} min={0} max={600} step={20} unit="kWh" hint={no ? "Ikke bestemt. Prosjekteier: mulig tilgang til felles lager." : "Not decided. Project owner: possible access to shared storage."} />
        <label className="flex items-start gap-2.5 text-[13.5px] rounded-[var(--radius)] border line p-3">
          <input type="checkbox" checked={withOffice} onChange={(e) => setWithOffice(e.target.checked)} className="mt-0.5 accent-[var(--fjord)]" />
          <span><span className="text-ink-2">{no ? "Kontorbygget deltar" : "The office building takes part"}</span><span className="block text-[12px] text-muted mt-0.5">{no ? `Bruker strøm på dagtid; ${officeKwh.toLocaleString("nb-NO")} kWh i året i energiregnskapet.` : `Uses power in the daytime; ${officeKwh.toLocaleString("en-GB")} kWh a year in the energy budget.`}</span></span>
        </label>
        <Slider label={no ? "Felles solanlegg" : "Shared solar plant"} value={plant} set={setPlant} min={0} max={300} step={10} unit="kWp" hint={no ? "Første scenario rundt 600 paneler; effekten er ikke regnet. 600 paneler på 400 W er 240 kWp." : "First scenario around 600 panels; the output is not computed. 600 panels of 400 W is 240 kWp."} />
      </div>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <div className="panel p-5"><div className="text-[13.5px] text-muted">{no ? "Selvforsyning uten deling" : "Self-sufficiency without sharing"}</div><div className="num text-[32px] mt-2">{pc(selfBase)}</div><div className="text-[13px] text-muted mt-1">{no ? "hver bolig for seg" : "each home on its own"}</div></div>
          <div className="panel p-5"><div className="text-[13.5px] text-muted">{no ? "Selvforsyning med deling" : "Self-sufficiency with sharing"}</div><div className="num text-[32px] mt-2 text-pine">{pc(selfShared)}</div><div className="text-[13px] text-muted mt-1">{no ? `${homesIn} av ${n} boliger deler` : `${homesIn} of ${n} homes share`}</div></div>
          <div className="panel p-5"><div className="text-[13.5px] text-muted">{no ? "Delt mellom boligene" : "Shared between homes"}</div><div className="num text-[32px] mt-2">{nf(sharedYear / 1000)} MWh</div><div className="text-[13px] text-muted mt-1">{no ? "per år, anslag" : "a year, estimate"}</div></div>
          <div className="panel p-5"><div className="text-[13.5px] text-muted">{no ? "Verdi av delingen" : "Value of sharing"}</div><div className="num text-[32px] mt-2">{nf(homesIn ? valueYear / homesIn : 0)} kr</div><div className="text-[13px] text-muted mt-1">{no ? "per deltakende bolig og år" : "per taking-part home a year"}</div></div>
        </div>
        {sharedYear < 1000 && (
          <div className="rounded-[var(--radius)] px-4 py-3 text-[14px] bg-[rgba(47,102,136,.08)] text-ink-2">{no ? "Boligene har like store solanlegg og batterier, så de har overskudd og underskudd omtrent samtidig: midt på dagen har alle for mye, om kvelden har alle for lite. Delingen gir mest når kontorbygget, som bruker strøm på dagtid, eller et felles batteri er med." : "The homes have equal solar plants and batteries, so they have surplus and deficit at about the same time: at midday all have too much, in the evening all have too little. Sharing gives most when the office building, which uses power in the daytime, or a shared battery takes part."}</div>
        )}
        <div className="panel p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="text-[14px] font-medium">{no ? `Feltet mot nettet, ${months[month - 1]} (den 21.)` : `The field against the grid, ${months[month - 1]} (the 21st)`}</div>
            <div className="flex flex-wrap gap-1">{months.map((name, i) => <button key={name} type="button" onClick={() => setMonth(i + 1)} className={`chip ${i + 1 === month ? "chip-amber" : ""}`}>{name}</button>)}</div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={no ? "Kjøp og salg time for time" : "Buying and selling hour by hour"}>
            <line x1={left} x2={W - right} y1={mid} y2={mid} stroke="var(--line-strong)" />
            <text x={left + 2} y={top + 10} fontSize="11" fill="var(--muted)">{no ? "kjøp" : "buying"}</text>
            <text x={left + 2} y={H - bottom - 4} fontSize="11" fill="var(--muted)">{no ? "salg" : "selling"}</text>
            {day.shared.imp.map((v, h) => <rect key={`i${h}`} x={left + h * bw + bw * 0.2} y={y(v)} width={bw * 0.6} height={mid - y(v)} rx="2" fill="var(--fjord)"><title>{`${String(h).padStart(2, "0")}:00 ${no ? "kjøp med deling" : "bought with sharing"} ${v.toFixed(1)} kW`}</title></rect>)}
            {day.shared.exp.map((v, h) => <rect key={`e${h}`} x={left + h * bw + bw * 0.2} y={mid} width={bw * 0.6} height={y(-v) - mid} rx="2" fill="var(--pine)"><title>{`${String(h).padStart(2, "0")}:00 ${no ? "salg med deling" : "sold with sharing"} ${v.toFixed(1)} kW`}</title></rect>)}
            <polyline points={day.base.imp.map((v, h) => `${left + (h + 0.5) * bw},${y(v)}`).join(" ")} fill="none" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth="1.3" />
            <polyline points={day.base.exp.map((v, h) => `${left + (h + 0.5) * bw},${y(-v)}`).join(" ")} fill="none" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth="1.3" />
            <polyline points={day.shared.shared.map((v, h) => `${left + (h + 0.5) * bw},${y(v)}`).join(" ")} fill="none" stroke="var(--amber)" strokeWidth="2" />
            {[0, 6, 12, 18].map((h) => <text key={h} x={left + h * bw + 2} y={H - 6} fontSize="11" fill="var(--muted)">{String(h).padStart(2, "0")}</text>)}
          </svg>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted mt-2">
            <span><span className="inline-block w-3 h-3 rounded-sm bg-fjord mr-1.5 align-[-2px]" />{no ? "kjøp fra nettet, med deling" : "bought from the grid, with sharing"}</span>
            <span><span className="inline-block w-3 h-3 rounded-sm bg-pine mr-1.5 align-[-2px]" />{no ? "salg til nettet, med deling" : "sold to the grid, with sharing"}</span>
            <span><span className="inline-block w-4 border-t-2 border-amber mr-1.5 align-middle" />{no ? "delt mellom boligene" : "shared between homes"}</span>
            <span><span className="inline-block w-4 border-t border-dashed border-[var(--muted)] mr-1.5 align-middle" />{no ? "uten deling" : "without sharing"}</span>
          </div>
        </div>
        <div className="panel p-4 md:p-5">
          <div className="text-[14px] font-medium mb-3">{no ? "Selvforsyning gjennom året" : "Self-sufficiency through the year"}</div>
          <div className="grid grid-cols-12 gap-1.5 items-end h-[120px]">
            {year.map((d, m) => {
              const b = 1 - d.base.importKwh / d.base.load, s = 1 - d.shared.importKwh / d.shared.load;
              return (
                <button key={m} type="button" onClick={() => setMonth(m + 1)} className="h-full flex items-end justify-center gap-[2px]" title={`${months[m]}: ${pc(b)} → ${pc(s)}`} aria-label={`${months[m]}`}>
                  <span className="w-[42%] rounded-t-[3px] bg-bone/20" style={{ height: `${Math.max(2, b * 100)}%` }} />
                  <span className={`w-[42%] rounded-t-[3px] ${m + 1 === month ? "bg-amber" : "bg-pine"}`} style={{ height: `${Math.max(2, s * 100)}%` }} />
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-12 gap-1.5 mt-1.5 text-center text-[11px] text-muted">{months.map((x) => <span key={x}>{x}</span>)}</div>
        </div>
      </div>
    </div>
  );
}
