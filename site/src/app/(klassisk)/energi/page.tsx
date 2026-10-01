import type { Metadata } from "next";
import PageHead from "@/components/klassisk/PageHead";
import EnergyFlow from "@/components/klassisk/EnergyFlow";
import Reveal from "@/components/klassisk/Reveal";
import { Src } from "@/components/klassisk/Source";
import Image from "next/image";
import { EED } from "@/lib/klassisk/maps";
import { BUDGET, EED as SIM, STATUS_SOLAR, fmt, fmtRound, measure } from "@/lib/facts";

export const metadata: Metadata = { title: "Energi og teknologi" };

const CLASS = { yes: "ok", maybe: "maybe", no: "no" } as const;

/** Klassisk's names for the measures it shows; verdict, wording and outage score come from the shared list. */
const MEASURES: [string, string][] = [
  ["Solceller", "solar_roof"],
  ["Varmegjenvinning i ventilasjon", "heat_recovery"],
  ["Smart styring og laststyring", "smart_control"],
  ["Gråvannsgjenvinning", "greywater"],
  ["Bergvarme og energibrønner", "bedrock"],
  ["Batteri i hver bolig", "battery_home"],
  ["Mikronett", "microgrid"],
  ["Sandbatteri", "sand"],
  ["Vindturbin", "wind"],
  ["Bil som batteri (V2H og V2G)", "v2h"],
  ["Ett stort felles litiumbatteri", "large_battery"],
];

export default function Energi() {
  return (
    <>
      <PageHead title="Energi og teknologi" crumb="Energi og teknologi">
        <p>Slik henger solen, vinden, batteriene og byggene sammen. Retningen er satt av prosjekteier i september 2026 og er et arbeidsgrunnlag, ikke endelige beslutninger. <Src id="retning" /></p>
      </PageHead>
      <section className="sec" style={{ paddingTop: 32 }}>
        <div className="wrap">
          <Reveal><EnergyFlow /></Reveal>
          <div className="split" style={{ marginTop: 56 }}>
            <Reveal className="stack">
              <div className="eyebrow">Tiltak som er vurdert</div>
              <h2>Hva som er inne, og hva som er ute</h2>
              <p className="measure">Energisporet har sammenlignet tiltakene etter kostnad, gjennomførbarhet, robusthet ved strømbrudd og hvor mye energi de gir eller sparer. Vurderingene er foreløpige, og byggestandarden for boligene er ikke fastsatt. <Src id="tiltak" /></p>
            </Reveal>
            <Reveal className="tbl" delay={120}>
              <table>
                <thead><tr><th>Tiltak</th><th>Vurdering</th><th>Robusthet ved strømbrudd</th></tr></thead>
                <tbody>
                  {MEASURES.map(([t, id]) => {
                    const m = measure(id);
                    return <tr key={t}><td>{t}</td><td className={CLASS[m.verdict]}>{m.short}</td><td>{`${m.robustness} av 10${m.alone ? " alene" : ""}`}</td></tr>;
                  })}
                </tbody>
              </table>
            </Reveal>
          </div>
          <Reveal className="numrow" style={{ marginTop: 56 }} stagger>
            <div><span className="tag">Foreløpig</span><b>{`ca. ${fmtRound(BUDGET.demand_total_kwh, 10000)} kWh`}</b><span>{`samlet energibehov per år for boliger, kontor og lager, med et realistisk spenn på ±${BUDGET.demand_range_pct} %`} <Src id="budsjett" /></span></div>
            <div><span className="tag">Foreløpig</span><b>{`${fmt(BUDGET.results.self_sufficiency_pct)} %`}</b><span>selvforsyning av strøm i arbeidsversjonen av energiregnskapet. Ventes å gå ned når solproduksjonen korrigeres. <Src id="selvforsyning" /></span></div>
            <div><span className="tag">Foreløpig</span><b>{`${BUDGET.battery.total_kwh} kWh`}</b><span>{`samlet batterikapasitet, ${BUDGET.battery.per_home_kwh} kWh per bolig, én syklus per dag.`} <Src id="budsjett" /></span></div>
          </Reveal>
          <div className="split" style={{ marginTop: 64 }}>
            <Reveal className="stack">
              <div className="eyebrow">Grunnvarme</div>
              <h2>{`Brønnfeltet, simulert over ${SIM.years} år`}</h2>
              <p className="measure">Energisporet har simulert et brønnfelt i Earth Energy Designer, det vanligste verktøyet for grunnvarme i Norge. Bildene er fra analysen. <Src id="eed" /></p>
            </Reveal>
            <Reveal className="eedgrid" stagger>
              {(["temperatur", "grunnlast", "bronn", "notater"] as const).map((k) => {
                const m = EED[k];
                return (
                  <figure key={k} className={k === "temperatur" || k === "notater" ? "wide" : ""}>
                    <div className="mapimg"><Image src={m.src} alt={m.alt} width={m.w} height={m.h} sizes="(max-width: 900px) 100vw, 40vw" quality={90} /></div>
                    <figcaption><b>{m.title}</b> {m.text} <span className="small">{m.credit}</span></figcaption>
                  </figure>
                );
              })}
            </Reveal>
          </div>
          <Reveal className="numrow" style={{ marginTop: 56 }} stagger>
            <div><span className="tag">Foreløpig</span><b>{`${fmt(BUDGET.pv.annual_kwh)} kWh`}</b><span>{`solstrøm per år i energiregnskapet, som selv sier at tallet er om lag 30 % for høyt. Statusoppsummeringen anslår om lag ${fmtRound(STATUS_SOLAR.annual_kwh, 1000)} kWh fra ${fmt(STATUS_SOLAR.area_m2)} m² paneler.`} <Src id="sol" /></span></div>
            <div><span className="tag">Foreløpig</span><b>{`ca. ${fmtRound(BUDGET.results.saving_per_home_nok, 1000)} kr`}</b><span>anslått årlig besparelse per bolig mot direkte elektrisk oppvarming uten sol og batteri, forenklet fordeling. <Src id="besparelse" /></span></div>
            <div><span className="tag">Foreløpig</span><b>{`ca. ${fmtRound(BUDGET.results.co2_saved_kg, 1000)} kg`}</b><span>{`CO₂ spart per år mot referansen, med ${fmt(BUDGET.prices.co2_kg_per_kwh)} kg per kWh nettstrøm som metodevalg.`} <Src id="co2" /></span></div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
