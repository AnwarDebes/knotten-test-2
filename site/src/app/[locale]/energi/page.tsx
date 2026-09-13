import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import Stage from "@/components/Stage";
import { loadPlots } from "@/lib/data";
import { BUDGET, EED, MEASURES, DIRECTION, ENERGY_PLAN_DATE } from "@/lib/energyPlan";

export default async function Energy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const { plots } = await loadPlots();
  const nb = (v: number) => v.toLocaleString(no ? "nb-NO" : "en-GB");
  const verdict = { yes: no ? "Ja" : "Yes", maybe: no ? "Kanskje" : "Maybe", no: no ? "Nei" : "No" };
  const verdictClass = { yes: "chip-pine", maybe: "chip-amber", no: "" };
  const cat = { production: no ? "Produksjon" : "Production", storage: no ? "Lagring og varme" : "Storage and heat", efficiency: no ? "Bygget" : "The building", control: no ? "Styring" : "Control" };
  const Fig = ({ v, unit, label, note }: { v: string; unit?: string; label: string; note?: string }) => (
    <div>
      <div className="num text-[40px] md:text-[46px]">{v}{unit && <span className="text-[14px] font-body font-normal opacity-60 ml-1.5">{unit}</span>}</div>
      <div className="mt-1.5 text-[15px]">{label}</div>
      {note && <div className="provenance">{note}</div>}
    </div>
  );

  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Energien, tegnet på landskapet." : "Energy, drawn on the landscape."}
        lede={no
          ? "Målet er Norges mest energieffektive, robuste og attraktive boligfelt. Under er konseptet slik det står nå: retningen fra prosjekteier, energiregnskapet for hele feltet, den dimensjonerte brønnparken, og vurderingen av hvert tiltak. Alt er arbeidsgrunnlag med kilde og dato, ikke løfter."
          : "The goal is Norway's most energy-efficient, robust and attractive housing field. Below is the concept as it stands: the direction from the project owner, the energy budget for the whole field, the dimensioned borehole field, and the assessment of every measure. All of it is a working basis with source and date, not promises."}
      />

      {/* the living field */}
      <section className="wrap pb-6">
        <Stage plots={plots} locale={locale} initialMode="field" compact journey={false} />
        <div className="marks"><span /><span /><em className="not-italic">{no ? "Feltet som lever: produksjon på takene, forbruk i vinduene, deling langs veien. Slå av nettet og se." : "The living field: production on the roofs, consumption in the windows, sharing along the road. Cut the grid and watch."}</em><span /><span /></div>
      </section>

      {/* the budget */}
      <section className="wrap section-tight">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="rise">
            <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch]">{no ? "Regnskapet for et år." : "The budget for one year."}</h2>
            <p className="lede mt-5 max-w-[44ch]">{no ? "Hele feltet: 30 boliger, kontorbygget og lager- og verkstedbygget. Behov mot det som kan produseres og lagres lokalt." : "The whole field: 30 homes, the office building and the workshop. Demand against what can be produced and stored locally."}</p>
            <p className="small mt-4 text-granite max-w-[44ch]">{BUDGET.notes[locale]}</p>
          </div>
          <div className="panel p-7 md:p-9 grid gap-x-8 gap-y-8 sm:grid-cols-2 rise rise-late">
            <Fig v={nb(BUDGET.demand_total_kwh)} unit="kWh/år" label={no ? "Energibehov, el og varme" : "Energy demand, power and heat"} note={no ? `${BUDGET.homes} boliger à ${nb(BUDGET.el_per_home_kwh)} kWh el og ${nb(BUDGET.heat_per_home_kwh)} kWh varme, kontor ${nb(BUDGET.office_kwh)}, lager ${nb(BUDGET.storage_kwh)}` : `${BUDGET.homes} homes at ${nb(BUDGET.el_per_home_kwh)} kWh power and ${nb(BUDGET.heat_per_home_kwh)} kWh heat, office ${nb(BUDGET.office_kwh)}, storage ${nb(BUDGET.storage_kwh)}`} />
            <Fig v={nb(BUDGET.pv.annual_kwh)} unit="kWh/år" label={no ? "Solstrøm fra takene" : "Solar from the roofs"} note={no ? `${nb(BUDGET.pv.roof_total_m2)} m² tak, ${BUDGET.pv.installed_kwp} kWp, ${BUDGET.pv.yield_kwh_per_kwp} kWh/kWp` : `${nb(BUDGET.pv.roof_total_m2)} m² of roof, ${BUDGET.pv.installed_kwp} kWp, ${BUDGET.pv.yield_kwh_per_kwp} kWh/kWp`} />
            <Fig v={nb(BUDGET.bedrock.delivered_kwh)} unit="kWh/år" label={no ? "Varme fra bergvarmeanlegget" : "Heat from the bedrock plant"} note={no ? `${nb(BUDGET.bedrock.extracted_kwh)} kWh fra brønnene, årsvarmefaktor ${BUDGET.bedrock.scop}` : `${nb(BUDGET.bedrock.extracted_kwh)} kWh from the boreholes, seasonal factor ${BUDGET.bedrock.scop}`} />
            <Fig v={nb(BUDGET.wind.annual_kwh)} unit="kWh/år" label={no ? "Vind, hvis det bygges" : "Wind, if built"} note={no ? `${BUDGET.wind.turbines} turbiner à ${BUDGET.wind.kw_each} kW, kapasitetsfaktor ${BUDGET.wind.capacity_factor_pct} %, krever vindmåling` : `${BUDGET.wind.turbines} turbines at ${BUDGET.wind.kw_each} kW, capacity factor ${BUDGET.wind.capacity_factor_pct} %, needs a wind measurement`} />
            <Fig v={String(BUDGET.battery.total_kwh)} unit="kWh" label={no ? "Batteri, hele feltet" : "Battery, whole field"} note={no ? `${BUDGET.battery.per_home_kwh} kWh i hver bolig, ${BUDGET.battery.round_trip_pct} % rundtur` : `${BUDGET.battery.per_home_kwh} kWh in every home, ${BUDGET.battery.round_trip_pct} % round trip`} />
            <Fig v={BUDGET.prices.buy_nok.toFixed(2).replace(".", no ? "," : ".")} unit="kr/kWh" label={no ? "Kjøpspris strøm i regnskapet" : "Purchase price in the budget"} note={no ? `Salg ${BUDGET.prices.sell_nok} kr/kWh, ${BUDGET.prices.co2_kg_per_kwh} kg CO₂/kWh` : `Sale ${BUDGET.prices.sell_nok} kr/kWh, ${BUDGET.prices.co2_kg_per_kwh} kg CO₂/kWh`} />
            <div className="sm:col-span-2 provenance">{no ? "Energiregnskap, forutsetninger for månedlig regnskap, energigruppen ved UiA, august 2026. Fullt regneark i dokumentbanken." : "Energy budget, assumptions for the monthly budget, the UiA energy group, August 2026. Full spreadsheet in the document bank."}</div>
          </div>
        </div>
      </section>

      {/* the boreholes */}
      <section className="wrap section-tight">
        <div className="dark rounded-[var(--radius-lg)] overflow-hidden grid lg:grid-cols-[1fr_1fr]">
          <div className="p-8 md:p-12 grid content-center">
            <h2 className="display text-[clamp(32px,4.2vw,56px)] max-w-[14ch]">{no ? "Varmen hentes fra fjellet." : "The heat comes from the rock."}</h2>
            <p className="lede mt-5 max-w-[46ch]">
              {no
                ? `Brønnparken er dimensjonert i Earth Energy Designer: ${EED.boreholes} brønner i ${EED.config}, ${EED.depth_m} meter dype, ${EED.spacing_m} meter fra hverandre. Med ${EED.base_heat_mwh} MWh varme og ${EED.dhw_mwh} MWh tappevann i året holder væsketemperaturen seg mellom ${EED.fluid_min_c} og ${EED.fluid_max_c} grader etter ${EED.years} år. Den stabiliserer seg, og det er det som teller.`
                : `The borehole field is dimensioned in Earth Energy Designer: ${EED.boreholes} boreholes in a ${EED.config}, ${EED.depth_m} metres deep, ${EED.spacing_m} metres apart. With ${EED.base_heat_mwh} MWh of heat and ${EED.dhw_mwh} MWh of hot water a year, the fluid stays between ${EED.fluid_min_c} and ${EED.fluid_max_c} degrees after ${EED.years} years. It settles, and that is what matters.`}
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-3 max-w-[520px]">
              <Fig v={String(EED.boreholes)} label={no ? "brønner" : "boreholes"} />
              <Fig v={String(EED.depth_m)} unit="m" label={no ? "dybde" : "depth"} />
              <Fig v={String(EED.fluid_min_c).replace(".", no ? "," : ".")} unit="°C" label={no ? "laveste temperatur, år 35" : "lowest temperature, year 35"} />
            </div>
          </div>
          <figure className="paper p-4 md:p-6">
            <img src="/assets/energy/eed_fluid_temperatures.webp" alt="EED" className="w-full rounded-[10px]" loading="lazy" />
            <figcaption className="provenance !text-granite mt-3">{no ? "Væsketemperatur i brønnene gjennom 35 år, månedlig simulering i EED. Energigruppen ved UiA." : "Fluid temperature in the boreholes over 35 years, monthly simulation in EED. The UiA energy group."}</figcaption>
          </figure>
        </div>
      </section>

      {/* the measures */}
      <section className="wrap section-tight">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr] items-end">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Hvert tiltak, vurdert." : "Every measure, assessed."}</h2>
          <p className="lede max-w-[54ch] rise rise-late">{no ? "Seksten tiltak sammenlignet på kostnad, gjennomførbarhet, robusthet ved strømbrudd og hva de faktisk gir. Ja betyr inn i konseptet, kanskje betyr utredes videre, nei betyr lagt bort med begrunnelse." : "Sixteen measures compared on cost, feasibility, robustness in an outage and what they actually give. Yes means into the concept, maybe means studied further, no means set aside with a reason."}</p>
        </div>
        <div className="mt-10 grid gap-3">
          {(["production", "storage", "efficiency", "control"] as const).map((c) => (
            <div key={c} className="grid gap-3">
              <div className="label mt-4">{cat[c]}</div>
              {MEASURES.filter((m) => m.category === c).map((m) => (
                <div key={m.name.en} className="panel p-5 md:p-6 grid gap-3 md:grid-cols-[220px_1fr_1fr_auto] items-start">
                  <div className="display text-[20px] leading-tight">{m.name[locale]}</div>
                  <p className="text-[14.5px] text-bone-2">{m.what[locale]}</p>
                  <p className="text-[14.5px] text-granite">{m.why[locale]}</p>
                  <div className="flex md:flex-col items-center md:items-end gap-2">
                    <span className={`chip ${verdictClass[m.verdict]}`}>{verdict[m.verdict]}</span>
                    {m.robustness !== null && <span className="text-[12px] text-granite whitespace-nowrap">{no ? "strømbrudd" : "outage"} {m.robustness}/10</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="provenance mt-5 max-w-[80ch]">{no ? "Sammenligningstabell fra energigruppen ved UiA, 28. august 2026, og retning fra prosjekteier 4. september 2026. Foreløpig." : "Comparison table from the UiA energy group, 28 August 2026, and direction from the project owner, 4 September 2026. Provisional."}</p>
      </section>

      {/* the direction */}
      <section className="wrap section-tight grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="rise">
          <h2 className="display text-[clamp(32px,4.2vw,56px)] max-w-[12ch]">{no ? "Retningen." : "The direction."}</h2>
          <p className="lede mt-5 max-w-[42ch]">{no ? `Åtte punkter fra prosjekteier, ${ENERGY_PLAN_DATE}. Ikke endelige beslutninger, men det som skal undersøkes nå.` : `Eight points from the project owner, ${ENERGY_PLAN_DATE}. Not final decisions, but what is to be investigated now.`}</p>
          <Link className="btn btn-ghost mt-7" href={`/${locale}/dokumenter`}>{no ? "Les notatet" : "Read the note"}</Link>
        </div>
        <ol className="grid gap-3 rise rise-late">
          {DIRECTION[locale].map((line, i) => (
            <li key={i} className="grid grid-cols-[36px_1fr] gap-3 items-baseline panel px-5 py-4">
              <span className="num text-[22px] text-fjord">{i + 1}</span>
              <span className="text-[15.5px]">{line}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap section-tight">
        <div className="dark rounded-[var(--radius-lg)] p-8 md:p-12 grid gap-6 md:grid-cols-[1fr_auto] items-center">
          <div>
            <div className="display text-[clamp(28px,3.5vw,40px)]">{no ? "Eksisterende bygg som bevis" : "Existing buildings as proof"}</div>
            <p className="mt-3 opacity-85 max-w-[56ch]">{no ? "Kontorbygget og boligen på eiendommen har målere i dag. Der møtes teorien virkeligheten." : "The office and the house on the property have meters today. That is where theory meets reality."}</p>
          </div>
          <Link className="btn btn-amber" href={`/${locale}/energi/eksisterende`}>{no ? "Se byggene" : "See the buildings"}</Link>
        </div>
      </section>
    </>
  );
}
