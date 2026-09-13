"use client";
import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * Scenario explorer: the response curves are stand-ins with the shape the energy group will
 * replace (a small table, not a black box). Every output states its assumptions version.
 */
export default function Scenario({ locale, homes }: { locale: Locale; homes: number }) {
  const no = locale === "no";
  const [price, setPrice] = useState(1.1);      // NOK/kWh incl. grid
  const [pv, setPv] = useState(8);              // kWp per home
  const [battery, setBattery] = useState(10);   // kWh per home
  const [v2h, setV2h] = useState(30);           // % of homes
  const [subsidy, setSubsidy] = useState(35);   // % of premium (Enova-like)
  const r = useMemo(() => {
    const demand = 9500;                                         // kWh/yr per home, low-energy
    const yieldPer = 820;                                        // kWh/kWp/yr at this latitude with ridge shading
    const production = pv * yieldPer;
    const selfUse = Math.min(demand, production * (0.42 + 0.03 * battery + 0.002 * v2h));
    const importKwh = Math.max(0, demand - selfUse);
    const exportKwh = Math.max(0, production - selfUse);
    const costRef = demand * price;
    const cost = importKwh * price - exportKwh * price * 0.55;
    const saving = costRef - cost;
    const premium = pv * 12000 + battery * 6500 + (v2h / 100) * 15000;
    const netPremium = premium * (1 - subsidy / 100);
    const payback = saving > 0 ? netPremium / saving : Infinity;
    const co2 = ((selfUse + exportKwh) * 0.13) / 1000;            // t/yr with a Nordic marginal factor
    return { production, selfUse, importKwh, exportKwh, saving, netPremium, payback, co2, selfSufficiency: selfUse / demand };
  }, [price, pv, battery, v2h]);
  const nok = (v: number) => Math.round(v).toLocaleString(no ? "nb-NO" : "en-GB");
  const Slider = ({ label, value, min, max, step, unit, set }: { label: string; value: number; min: number; max: number; step: number; unit: string; set: (v: number) => void }) => (
    <label className="block text-[14px]">
      <div className="flex justify-between"><span>{label}</span><span className="font-semibold">{value} {unit}</span></div>
      <input className="w-full" type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} />
    </label>
  );
  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <div className="bg-bone border line rounded-[2px] p-5 grid gap-4">
        <Slider label={no ? "Strømpris inkl. nett" : "Electricity price incl. grid"} value={price} min={0.5} max={3} step={0.05} unit="kr/kWh" set={setPrice} />
        <Slider label={no ? "Solceller per bolig" : "PV per home"} value={pv} min={0} max={16} step={1} unit="kWp" set={setPv} />
        <Slider label={no ? "Batteri per bolig" : "Battery per home"} value={battery} min={0} max={30} step={1} unit="kWh" set={setBattery} />
        <Slider label={no ? "Boliger med V2H" : "Homes with V2H"} value={v2h} min={0} max={100} step={5} unit="%" set={setV2h} />
        <Slider label={no ? "Støtte av merkostnad" : "Subsidy on premium"} value={subsidy} min={0} max={60} step={5} unit="%" set={setSubsidy} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 content-start">
        {[
          [no ? "Selvforsyning" : "Self-sufficiency", `${Math.round(r.selfSufficiency * 100)} %`],
          [no ? "Sparte kostnader per bolig" : "Saving per home", `${nok(r.saving)} kr/${no ? "år" : "yr"}`],
          [no ? "Hele feltet" : "Whole field", `${nok(r.saving * homes)} kr/${no ? "år" : "yr"}`],
          [no ? "Merkostnad etter støtte" : "Premium after subsidy", `${nok(r.netPremium)} kr`],
          [no ? "Tilbakebetaling" : "Payback", isFinite(r.payback) ? `${r.payback.toFixed(1)} ${no ? "år" : "yrs"}` : ""],
          [no ? "Unngått CO₂, feltet" : "CO₂ avoided, field", `${(r.co2 * homes).toFixed(0)} t/${no ? "år" : "yr"}`],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="num text-[36px] leading-none">{v}</div>
            <div className="text-[14px] mt-1">{l}</div>
          </div>
        ))}
        <div className="provenance sm:col-span-2 lg:col-span-3">
          {no
            ? "Responskurver er plassholdere (forutsetninger 2026-09-A): 9 500 kWh/bolig/år, 820 kWh/kWp/år med åsskygge, 0,13 kg CO₂/kWh. Energigruppen leverer de endelige kurvene i kontraktsformatet."
            : "Response curves are placeholders (assumptions 2026-09-A): 9,500 kWh/home/yr, 820 kWh/kWp/yr with ridge shading, 0.13 kg CO₂/kWh. The energy group delivers the final curves in the contract format."}
        </div>
      </div>
    </div>
  );
}
