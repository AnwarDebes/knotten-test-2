import type { Metadata } from "next";
import PageHead from "@/components/klassisk/PageHead";
import EnergyFlow from "@/components/klassisk/EnergyFlow";
import Reveal from "@/components/klassisk/Reveal";
import { Src } from "@/components/klassisk/Source";
import Image from "next/image";
import { EED } from "@/lib/klassisk/maps";

export const metadata: Metadata = { title: "Energi og teknologi" };

const MEASURES: [string, string, "ok" | "maybe" | "no", string][] = [
  ["Solceller", "Ja, kan dekke store deler av behovet", "ok", "10 av 10"],
  ["Varmegjenvinning i ventilasjon", "Ja, sparer mye varmetap", "ok", "2 av 10"],
  ["Smart styring og laststyring", "Ja", "ok", "0 av 10"],
  ["Gråvannsgjenvinning", "Ja, sparer en del energi", "ok", "8 av 10"],
  ["Bergvarme og energibrønner", "Ja eller kanskje, lagring eller fangst avklares", "maybe", "0 av 10 alene"],
  ["Batteri i hver bolig", "Ja, kan bli dyrt over tid", "maybe", "9 av 10"],
  ["Mikronett", "Vanskelig, må utredes videre", "maybe", "8 av 10"],
  ["Sandbatteri", "Holdes som mulighet, ingen betalt forstudie nå", "maybe", "0 av 10 alene"],
  ["Vindturbin", "Krevende, vurderes som supplement", "maybe", "7 av 10"],
  ["Bil som batteri (V2H og V2G)", "Nei, liten nytte mot kostnad", "no", "10 av 10"],
  ["Ett stort felles litiumbatteri", "Nei, juridisk krevende", "no", "5 av 10"],
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
              <p className="measure">Energisporet har rangert tiltakene etter kostnad, gjennomførbarhet, robusthet ved strømbrudd og hvor mye energi de gir eller sparer. Vurderingene er foreløpige, og byggestandarden for boligene er ikke fastsatt. <Src id="henrik" /></p>
            </Reveal>
            <Reveal className="tbl" delay={120}>
              <table>
                <thead><tr><th>Tiltak</th><th>Vurdering</th><th>Robusthet ved strømbrudd</th></tr></thead>
                <tbody>
                  {MEASURES.map(([t, v, c, r]) => (
                    <tr key={t}><td>{t}</td><td className={c}>{v}</td><td>{r}</td></tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>
          <Reveal className="numrow" style={{ marginTop: 56 }} stagger>
            <div><span className="tag">Foreløpig</span><b>ca. 720 000 kWh</b><span>samlet energibehov per år for boliger, kontor og lager, med et realistisk spenn på ±25 % <Src id="budsjett" /></span></div>
            <div><span className="tag">Foreløpig</span><b>52,5 %</b><span>selvforsyning av strøm i arbeidsversjonen av energiregnskapet. Ventes å gå ned når solproduksjonen korrigeres. <Src id="selvforsyning" /></span></div>
            <div><span className="tag">Foreløpig</span><b>420 kWh</b><span>samlet batterikapasitet, 14 kWh per bolig, én syklus per dag. <Src id="budsjett" /></span></div>
          </Reveal>
          <div className="split" style={{ marginTop: 64 }}>
            <Reveal className="stack">
              <div className="eyebrow">Grunnvarme</div>
              <h2>Brønnfeltet, simulert over 35 år</h2>
              <p className="measure">Energisporet har dimensjonert et brønnfelt i Earth Energy Designer, det vanligste verktøyet for grunnvarme i Norge. Bildene er fra analysen. <Src id="eed" /></p>
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
            <div><span className="tag">Foreløpig</span><b>ca. 235 000 kWh</b><span>solstrøm per år fra 1 350 m² paneler i statusoppsummeringen. Energiregnskapet regner 244 000 kWh med en modulvirkningsgrad arket selv kaller for høy. <Src id="sol" /></span></div>
            <div><span className="tag">Foreløpig</span><b>ca. 39 000 kr</b><span>anslått årlig besparelse per bolig mot direkte elektrisk oppvarming uten sol og batteri, forenklet fordeling. <Src id="besparelse" /></span></div>
            <div><span className="tag">Foreløpig</span><b>ca. 104 000 kg</b><span>CO₂ spart per år mot referansen, med 0,2 kg per kWh nettstrøm som metodevalg. <Src id="budsjett" /></span></div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
