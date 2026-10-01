"use client";
import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { BUDGET, PV_KWP_PER_HOME, fmt } from "@/lib/facts";

/**
 * Scenario explorer: the response curves are stand-ins with the shape the energy track will
 * replace (a small table, not a black box). The starting values are the energy budget's.
 */
export default function Scenario({ locale, homes }: { locale: Locale; homes: number }) {
  const no = locale === "no";
  const [price, setPrice] = useState(BUDGET.prices.buy_nok);      // NOK/kWh incl. grid
  const [pv, setPv] = useState(PV_KWP_PER_HOME);              // kWp per home
  const [battery, setBattery] = useState(BUDGET.battery.per_home_kwh);   // kWh per home
  const [v2h, setV2h] = useState(0);           // % of homes
  const [subsidy, setSubsidy] = useState(35);   // % of premium (Enova-like)
  const r = useMemo(() => {
    const demand = 9500;                                         // kWh/yr per home, a placeholder (not from the budget)
    const yieldPer = BUDGET.pv.yield_kwh_per_kwp;                // kWh/kWp/yr, the energy budget's production factor
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
    const co2 = ((selfUse + exportKwh) * BUDGET.prices.co2_kg_per_kwh) / 1000;            // t/yr with the energy budget's emission factor
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
            ? `Responskurver er plassholdere. Forbruket på 9 500 kWh per bolig og år er en plassholder; ${BUDGET.pv.yield_kwh_per_kwp} kWh/kWp/år og ${fmt(BUDGET.prices.co2_kg_per_kwh)} kg CO₂/kWh er som i energiregnskapet. Energisporet leverer de endelige tallene.`
            : `Response curves are placeholders. The consumption of 9,500 kWh per home a year is a placeholder; ${BUDGET.pv.yield_kwh_per_kwp} kWh/kWp/yr and ${fmt(BUDGET.prices.co2_kg_per_kwh, "en")} kg CO₂/kWh are as in the energy budget. The energy track delivers the final figures.`}
        </div>
      </div>
    </div>
  );
}
