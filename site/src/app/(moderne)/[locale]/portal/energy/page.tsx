import type { Locale } from "@/lib/i18n";
import { getRole, allowed } from "@/lib/auth";
import Gate from "@/components/portal/Gate";
import { loadPlots } from "@/lib/data";
import { frameFor } from "@/lib/energy";
import { BUDGET, EED, PV_KWP_PER_HOME, fmt } from "@/lib/facts";
import DayChart from "@/components/charts/DayChart";

/**
 * The energy dashboard: the year from the working budget, and one day of the field hour by hour
 * from the model. Meter readings with the same shape can replace the model frames later.
 */
export default async function EnergyDashboard({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ month?: string }> }) {
  const { locale: l } = await params;
  const { month: m } = await searchParams;
  const locale = l as Locale;
  const no = locale === "no";
  const role = await getRole();
  if (!allowed(role, "energy")) return <Gate locale={locale} role={role} need={["energy"]} />;
  const month = Math.min(12, Math.max(1, +(m ?? 12)));
  const { plots } = await loadPlots();
  const hours = Array.from({ length: 24 }, (_, h) => frameFor(plots, month, 21, h + 0.5));
  const pvDay = hours.reduce((a, f) => a + f.field.pv_kw, 0);
  const loadDay = hours.reduce((a, f) => a + f.field.load_kw, 0);
  const importDay = hours.reduce((a, f) => a + f.field.import_kw, 0);
  const lang = no ? "no" : "en";
  const nb = (v: number) => fmt(Math.round(v), lang);
  const dec = (v: number) => fmt(v, lang);
  const produced = BUDGET.pv.annual_kwh + BUDGET.wind.annual_kwh;
  const heatCovered = BUDGET.bedrock.delivered_kwh;
  const elDemand = BUDGET.homes * BUDGET.el_per_home_kwh + BUDGET.office_kwh + BUDGET.storage_kwh;
  const heatDemand = BUDGET.homes * BUDGET.heat_per_home_kwh;
  const pumpEl = BUDGET.heat_pump_el_kwh;
  const bars: [string, number, string][] = [
    [no ? "El-behov" : "Power demand", elDemand, "#24506b"],
    [no ? "Strøm til varmepumpe" : "Power to heat pump", pumpEl, "#4b6b7c"],
    [no ? "Sol og vind" : "Solar and wind", produced, "#e8a33d"],
    [no ? "Varmebehov" : "Heat demand", heatDemand, "#5f6d74"],
    [no ? "Levert bergvarme" : "Bedrock heat delivered", heatCovered, "#274536"],
  ];
  const max = Math.max(...bars.map((b) => b[1]));
  return (
    <div className="grid gap-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr] items-end">
        <div>
          <h1 className="display text-[clamp(36px,5vw,60px)]">{no ? "Energidashbord" : "Energy dashboard"}</h1>
          <p className="lede mt-4 max-w-[52ch]">{no ? "Året fra energiregnskapet, og én dag time for time fra modellen. Senere kan modellrammene byttes ut med målte verdier, i samme visning." : "The year from the energy budget, and one day hour by hour from the model. Later the model frames can be replaced by measured values, in the same view."}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[[no ? "Behov, el og varme" : "Demand, power and heat", `${nb(BUDGET.demand_total_kwh)} kWh`], [no ? "Sol og vind" : "Solar and wind", `${nb(produced)} kWh`], [no ? "Bergvarme levert" : "Bedrock heat delivered", `${nb(heatCovered)} kWh`]].map(([a, b]) => (
            <div key={a}><div className="num text-[34px] leading-none">{b}</div><div className="text-[14px] mt-1.5">{a}</div><div className="provenance">{no ? "per år, arbeidsgrunnlag" : "per year, working basis"}</div></div>
          ))}
        </div>
      </div>

      <div className="panel p-6 md:p-8">
        <div className="display text-[26px]">{no ? "Året i balanse" : "The year in balance"}</div>
        <p className="text-[14.5px] text-granite mt-1 max-w-[70ch]">{no ? `Behov mot lokal produksjon. Bergvarmen dekker det meste av varmebehovet med ${nb(pumpEl)} kWh strøm til varmepumpen (årsvarmefaktor ${dec(BUDGET.bedrock.scop)}); om lag ${nb(BUDGET.peak_heat_el_kwh)} kWh spisslast dekkes med direkte strøm. Solstrømmen bør nedjusteres rundt 30 % før tallet brukes videre.` : `Demand against local production. Bedrock heat covers most of the heat demand with ${nb(pumpEl)} kWh of power to the heat pump (seasonal factor ${dec(BUDGET.bedrock.scop)}); about ${nb(BUDGET.peak_heat_el_kwh)} kWh of peak heat is covered by direct power. The solar figure should come down about 30 % before it is used further.`}</p>
        <div className="mt-6 grid gap-3">
          {bars.map(([label, v, color]) => (
            <div key={label} className="grid grid-cols-[180px_1fr_auto] items-center gap-3 text-[14px]">
              <span>{label}</span>
              <div className="h-[14px] rounded-full bg-bone/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} /></div>
              <span className="num text-[16px] tabular-nums">{nb(v)} kWh</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="panel p-6 md:p-8">
          <div className="display text-[24px]">{no ? "Brønnparken" : "The borehole field"}</div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[[String(EED.boreholes), no ? "brønner" : "boreholes"], [`${dec(EED.depth_m)} m`, no ? "dybde" : "depth"], [`${EED.spacing_m} m`, no ? "avstand" : "spacing"], [`${EED.base_heat_mwh} MWh`, no ? "varme per år" : "heat per year"], [`${EED.dhw_mwh} MWh`, no ? "tappevann per år" : "hot water per year"], [`${dec(EED.fluid_min_c)} °C`, no ? `laveste væsketemperatur, år ${EED.years}` : `lowest fluid temperature, year ${EED.years}`]].map(([v, l2]) => (
              <div key={l2}><div className="num text-[24px]">{v}</div><div className="text-[13px] text-granite">{l2}</div></div>
            ))}
          </div>
          <div className="provenance mt-4">{no ? `Earth Energy Designer, månedlig simulering, ${EED.years} år. Energisporet.` : `Earth Energy Designer, monthly simulation, ${EED.years} years. The energy track.`}</div>
        </div>
        <figure className="panel p-4">
          <img src="/assets/energy/eed_fluid_temperatures.webp" alt="EED" className="w-full rounded-[10px]" loading="lazy" />
        </figure>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="display text-[30px]">{no ? "Én dag, time for time" : "One day, hour by hour"}</h2>
            <p className="text-[14.5px] text-granite mt-1">{no ? "Den 21. i valgt måned, modellramme med beregnet horisont per tak." : "The 21st of the chosen month, model frame with the computed horizon per roof."}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => (
              <a key={mm} href={`?month=${mm}`} className={`chip no-underline ${mm === month ? "chip-amber" : ""}`}>{mm}</a>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-8 sm:grid-cols-3">
          {[[no ? "Produksjon" : "Production", `${pvDay.toFixed(0)} kWh`], [no ? "Forbruk" : "Load", `${loadDay.toFixed(0)} kWh`], [no ? "Import fra nett" : "Grid import", `${importDay.toFixed(0)} kWh`]].map(([a, b]) => (
            <div key={a}><div className="num text-[40px] leading-none">{b}</div><div className="text-[14px] mt-1">{a}, {no ? "hele feltet, døgn" : "whole field, day"}</div></div>
          ))}
        </div>
        <div className="mt-6"><DayChart frames={hours.map((f) => ({ pv: f.field.pv_kw, load: f.field.load_kw, soc: f.field.soc }))} locale={locale} /></div>
        <div className="provenance mt-3">{no ? `Illustrasjon: PV om lag ${PV_KWP_PER_HOME} kWp og ${BUDGET.battery.per_home_kwh} kWh batteri per bolig fra energiregnskapet, med beregnet horisont per tomt, lastprofil per årstid, SOC som døgnkurve. Kilde: lib/energy.ts.` : `Illustration: PV about ${PV_KWP_PER_HOME} kWp and a ${BUDGET.battery.per_home_kwh} kWh battery per home from the energy budget, with the computed horizon per plot, seasonal load profile, SOC as a diurnal curve. Source: lib/energy.ts.`}</div>
      </div>
    </div>
  );
}
