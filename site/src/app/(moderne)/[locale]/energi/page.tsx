import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import EnergySimulator from "@/components/energy/EnergySimulator";
import { loadPlots } from "@/lib/data";
import { BUDGET, DOCS, EED, MEASURES, DIRECTION, STATUS_SOLAR, dateLong, fmt } from "@/lib/facts";
import { pageMeta } from "@/lib/meta";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const generateMetadata = pageMeta("/energi", {
  no: { title: "Energi", description: "Energikonseptet for Knotten: retningen fra prosjekteier, energiregnskapet for hele feltet, brønnparken og vurderingen av hvert tiltak, med kilde og dato." },
  en: { title: "Energy", description: "The energy concept for Knotten: the direction from the project owner, the energy budget for the whole field, the borehole field and the assessment of every measure, with source and date." },
});

/** One figure in the energy budget: the number, its unit, what it is and where it comes from. */
function Fig({ v, unit, label, note }: { v: string; unit?: string; label: string; note?: string }) {
  return (
    <div>
      <div className="num text-[40px] md:text-[46px]">{v}{unit && <span className="text-[14px] font-body font-normal opacity-70 ml-1.5">{unit}</span>}</div>
      <div className="mt-1.5 text-[15px]">{label}</div>
      {note && <div className="provenance">{note}</div>}
    </div>
  );
}

export default async function Energy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const no = locale === "no";
  const { plots } = await loadPlots();
  const nb = (v: number) => fmt(v, no ? "no" : "en");
  const verdict = { yes: no ? "Ja" : "Yes", maybe: no ? "Kanskje" : "Maybe", no: no ? "Nei" : "No" };
  const verdictClass = { yes: "chip-pine", maybe: "chip-amber", no: "" };
  const cat = { production: no ? "Produksjon" : "Production", storage: no ? "Lagring og varme" : "Storage and heat", efficiency: no ? "Bygget" : "The building", control: no ? "Styring" : "Control" };
  const perYear = no ? "kWh/år" : "kWh/year";

  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Energien, tegnet på landskapet." : "Energy, drawn on the landscape."}
        lede={no
          ? "Målet er Norges mest energieffektive, robuste og attraktive boligfelt. Under er konseptet slik det står nå: retningen fra prosjekteier, energiregnskapet for hele feltet, den simulerte brønnparken, og vurderingen av hvert tiltak. Alt er arbeidsgrunnlag med kilde og dato, ikke løfter."
          : "The goal is Norway's most energy-efficient, robust and attractive housing field. Below is the concept as it stands: the direction from the project owner, the energy budget for the whole field, the simulated borehole field, and the assessment of every measure. All of it is a working basis with source and date, not promises."}
      />

      {/* the energy simulator: the field hour by hour through a typical year, on the 3D model */}
      <section className="wrap pb-6">
        <EnergySimulator plots={plots} locale={locale} />
      </section>

      {/* the budget */}
      <section className="wrap section-tight">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="rise">
            <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch]">{no ? "Regnskapet for et år." : "The budget for one year."}</h2>
            <p className="lede mt-5 max-w-[44ch]">{no ? `Hele feltet: ${BUDGET.homes} boliger, kontorbygget og lager- og verkstedbygget. Behov mot det som kan produseres og lagres lokalt.` : `The whole field: ${BUDGET.homes} homes, the office building and the warehouse and workshop. Demand against what can be produced and stored locally.`}</p>
            <p className="small mt-4 text-granite max-w-[44ch]">{BUDGET.notes[locale]}</p>
          </div>
          <div className="panel p-7 md:p-9 grid gap-x-8 gap-y-8 sm:grid-cols-2 rise rise-late">
            <Fig v={nb(BUDGET.demand_total_kwh)} unit={perYear} label={no ? "Energibehov, el og varme" : "Energy demand, power and heat"} note={no ? `${BUDGET.homes} boliger à ${nb(BUDGET.el_per_home_kwh)} kWh el og ${nb(BUDGET.heat_per_home_kwh)} kWh varme, kontor ${nb(BUDGET.office_kwh)}, lager ${nb(BUDGET.storage_kwh)}` : `${BUDGET.homes} homes at ${nb(BUDGET.el_per_home_kwh)} kWh power and ${nb(BUDGET.heat_per_home_kwh)} kWh heat, office ${nb(BUDGET.office_kwh)}, storage ${nb(BUDGET.storage_kwh)}`} />
            <Fig v={nb(BUDGET.pv.annual_kwh)} unit={perYear} label={no ? "Solstrøm fra takene" : "Solar from the roofs"} note={no ? `${nb(BUDGET.pv.roof_total_m2)} m² tak, ${BUDGET.pv.installed_kwp} kWp, ${BUDGET.pv.yield_kwh_per_kwp} kWh/kWp. Arket sier selv at tallet er om lag 30 % for høyt; statusoppsummeringen anslår om lag ${nb(Math.round(STATUS_SOLAR.annual_kwh / 1000) * 1000)} fra ${nb(STATUS_SOLAR.area_m2)} m²` : `${nb(BUDGET.pv.roof_total_m2)} m² of roof, ${BUDGET.pv.installed_kwp} kWp, ${BUDGET.pv.yield_kwh_per_kwp} kWh/kWp. The sheet itself says the figure is about 30 % too high; the status summary estimates about ${nb(Math.round(STATUS_SOLAR.annual_kwh / 1000) * 1000)} from ${nb(STATUS_SOLAR.area_m2)} m²`} />
            <Fig v={nb(BUDGET.bedrock.delivered_kwh)} unit={perYear} label={no ? "Varme fra bergvarmeanlegget" : "Heat from the bedrock plant"} note={no ? `${nb(BUDGET.bedrock.extracted_kwh)} kWh fra brønnene, årsvarmefaktor ${nb(BUDGET.bedrock.scop)}` : `${nb(BUDGET.bedrock.extracted_kwh)} kWh from the boreholes, seasonal factor ${nb(BUDGET.bedrock.scop)}`} />
            <Fig v={nb(BUDGET.wind.annual_kwh)} unit={perYear} label={no ? "Vind, hvis det bygges" : "Wind, if built"} note={no ? `${BUDGET.wind.turbines} turbiner à ${BUDGET.wind.kw_each} kW, kapasitetsfaktor ${BUDGET.wind.capacity_factor_pct} %, krever vindmåling` : `${BUDGET.wind.turbines} turbines at ${BUDGET.wind.kw_each} kW, capacity factor ${BUDGET.wind.capacity_factor_pct} %, needs a wind measurement`} />
            <Fig v={String(BUDGET.battery.total_kwh)} unit="kWh" label={no ? "Batteri, hele feltet" : "Battery, whole field"} note={no ? `${BUDGET.battery.per_home_kwh} kWh i hver bolig, ${BUDGET.battery.round_trip_pct} % rundtur` : `${BUDGET.battery.per_home_kwh} kWh in every home, ${BUDGET.battery.round_trip_pct} % round trip`} />
            <Fig v={BUDGET.prices.buy_nok.toFixed(2).replace(".", no ? "," : ".")} unit="kr/kWh" label={no ? "Kjøpspris strøm i regnskapet" : "Purchase price in the budget"} note={no ? `Salg ${nb(BUDGET.prices.sell_nok)} kr/kWh, ${nb(BUDGET.prices.co2_kg_per_kwh)} kg CO₂/kWh` : `Sale ${nb(BUDGET.prices.sell_nok)} kr/kWh, ${nb(BUDGET.prices.co2_kg_per_kwh)} kg CO₂/kWh`} />
            <div className="sm:col-span-2 provenance">{no ? "Energiregnskap, forutsetninger for månedlig regnskap, energisporet, september 2026. Fullt regneark i dokumentbanken." : "Energy budget, assumptions for the monthly budget, the energy track, September 2026. Full spreadsheet in the document bank."}</div>
          </div>
        </div>
      </section>

      {/* the boreholes */}
      <section className="wrap section-tight">
        <div className="dark rounded-[var(--radius-lg)] overflow-hidden grid lg:grid-cols-[1fr_1fr]">
          <div className="p-8 md:p-12 grid content-center">
            <h2 className="display text-[clamp(32px,4.2vw,56px)] max-w-[14ch]">{no ? "Varmen kan hentes fra fjellet." : "The heat can come from the rock."}</h2>
            <p className="lede mt-5 max-w-[46ch]">
              {no
                ? `Brønnparken er simulert i Earth Energy Designer: ${EED.boreholes} brønner i et åpent rektangel, ${EED.grid}, ca. ${nb(Math.round(EED.depth_m))} meter dype, ${EED.spacing_m} meter fra hverandre. Med ${EED.base_heat_mwh} MWh varme og ${EED.dhw_mwh} MWh tappevann i året stabiliserer væsketemperaturen seg over ${EED.years} år; siste år ligger den mellom ${nb(EED.fluid_min_c)} og ${nb(EED.fluid_max_c)} grader. Energisporet vurderer begge deler som bra.`
                : `The borehole field is simulated in Earth Energy Designer: ${EED.boreholes} boreholes in a ${EED.config}, about ${nb(Math.round(EED.depth_m))} metres deep, ${EED.spacing_m} metres apart. With ${EED.base_heat_mwh} MWh of heat and ${EED.dhw_mwh} MWh of hot water a year, the fluid temperature settles over ${EED.years} years; in the last year it stays between ${nb(EED.fluid_min_c)} and ${nb(EED.fluid_max_c)} degrees. The energy track judges both to be good.`}
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-3 max-w-[520px]">
              <Fig v={String(EED.boreholes)} label={no ? "brønner" : "boreholes"} />
              <Fig v={String(Math.round(EED.depth_m))} unit="m" label={no ? "dybde" : "depth"} />
              <Fig v={nb(EED.fluid_min_c)} unit="°C" label={no ? `laveste temperatur, år ${EED.years}` : `lowest temperature, year ${EED.years}`} />
            </div>
          </div>
          <figure className="paper p-4 md:p-6">
            <img src="/assets/energy/eed_fluid_temperatures.webp" alt="EED" className="w-full rounded-[10px]" loading="lazy" />
            <figcaption className="provenance !text-granite mt-3">{no ? `Væsketemperatur i brønnene gjennom ${EED.years} år, månedlig simulering i EED. Energisporet.` : `Fluid temperature in the boreholes over ${EED.years} years, monthly simulation in EED. The energy track.`}</figcaption>
          </figure>
        </div>
      </section>

      {/* the measures */}
      <section className="wrap section-tight">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr] items-end">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Hvert tiltak, vurdert." : "Every measure, assessed."}</h2>
          <p className="lede max-w-[54ch] rise rise-late">{no ? "Seksten tiltak sammenlignet av energisporet på kostnad, gjennomførbarhet, robusthet ved strømbrudd og hva de faktisk gir. Ja, kanskje og nei er den foreløpige vurderingen; der energisporet og prosjekteier er uenige, står begge i teksten." : "Sixteen measures compared by the energy track on cost, feasibility, robustness in an outage and what they actually give. Yes, maybe and no are the provisional assessment; where the energy track and the project owner differ, both are in the text."}</p>
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
        <p className="provenance mt-5 max-w-[80ch]">{no ? `Sammenligningstabell fra energisporet, ${dateLong(DOCS.measures.date)}, retning fra prosjekteier ${dateLong(DOCS.direction.date)}, og avklaringer i prosjektet 27. september 2026. Foreløpig.` : `Comparison table from the energy track, ${dateLong(DOCS.measures.date, "en")}, direction from the project owner, ${dateLong(DOCS.direction.date, "en")}, and clarifications in the project, 27 September 2026. Provisional.`}</p>
      </section>

      {/* the direction */}
      <section className="wrap section-tight grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="rise">
          <h2 className="display text-[clamp(32px,4.2vw,56px)] max-w-[12ch]">{no ? "Retningen." : "The direction."}</h2>
          <p className="lede mt-5 max-w-[42ch]">{no ? `Retningen fra prosjekteier, ${dateLong(DOCS.direction.date)}. Ikke endelige beslutninger, men det som skal undersøkes nå.` : `The direction from the project owner, ${dateLong(DOCS.direction.date, "en")}. Not final decisions, but what is to be investigated now.`}</p>
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
            <p className="mt-3 opacity-85 max-w-[56ch]">{no ? "Kontorbygget og boligen på eiendommen bruker strøm i dag og kan måles. Der kan teorien møte virkeligheten." : "The office and the house on the property use power today and can be measured. That is where theory can meet reality."}</p>
          </div>
          <Link className="btn btn-amber" href={`/${locale}/energi/eksisterende`}>{no ? "Se byggene" : "See the buildings"}</Link>
        </div>
      </section>
    </>
  );
}
