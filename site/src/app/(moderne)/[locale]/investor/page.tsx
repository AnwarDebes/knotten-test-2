import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import { Figure } from "@/components/ui/Provenance";
import { BUDGET, EED, FACT, FINAL_PHASE, assumption, fmt, weeks } from "@/lib/facts";

/** What investors ask, in the project owner's own order, and how the platform answers each with measured figures. */
export default async function Investor({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const nb = (v: number) => fmt(v, no ? "no" : "en");
  const qa = no
    ? [["Hva er besparelsen?", `Energibehovet for hele feltet er regnet til ${nb(BUDGET.demand_total_kwh)} kWh i året. Solstrøm fra takene, varme fra ${EED.boreholes} energibrønner og ${BUDGET.battery.total_kwh} kWh batteri dekker en stor del lokalt. Energiregnskapet anslår en besparelse på om lag ${nb(Math.round(BUDGET.results.saving_per_home_nok / 1000) * 1000)} kr per bolig i året mot direkte elektrisk oppvarming uten sol, vind eller batteri. Foreløpig.`], ["Hva koster det å bo der?", `Driftskostnad per bolig under tre strømprisscenarier over 20 år, med synlige forutsetninger. Regnskapet bruker ${BUDGET.prices.buy_nok.toFixed(2).replace(".", ",")} kr/kWh kjøp og ${BUDGET.prices.sell_nok.toFixed(2).replace(".", ",")} kr/kWh salg i dag.`], ["Kan det gjentas?", "Det stedegne (utsikten, laserterrenget) skilles fra det gjenbrukbare: energikonseptet, delingen, robustheten og plattformen. Om det kan brukes på neste felt, er et av spørsmålene prosjektet skal belyse."], ["Hva er innovasjonsverdien?", "En digital tvilling bygget på målt terreng som salgsverktøy, forberedelse for energideling, robusthet ved strømbrudd som mål, et internship med studenter fra Universitetet i Agder, og ambisjonen om et nasjonalt referanseprosjekt."], ["ESG og bærekraft?", `Spart CO₂ er anslått til om lag ${nb(Math.round(BUDGET.results.co2_saved_kg / 1000) * 1000)} kg per år, regnet med ${nb(BUDGET.prices.co2_kg_per_kwh)} kg per kWh nettstrøm. Selvforsyningsgraden for strøm er ${nb(BUDGET.results.self_sufficiency_pct)} % i arbeidsversjonen av energiregnskapet. Alt med kilde.`], ["Er utsikten ekte?", "Utsiktsbildet er tatt fra nabotomten, litt lavere enn feltet, og modellen kan sammenlignes med fotografiet fra samme punkt. Ønsket er sjøutsikt fra alle tomtene, men det er ikke sikkert at det går fra alle; i modellens forslag ser alle vann."]]
    : [["What is the saving?", `The energy demand for the whole field is computed at ${nb(BUDGET.demand_total_kwh)} kWh a year. Solar from the roofs, heat from ${EED.boreholes} boreholes and ${BUDGET.battery.total_kwh} kWh of battery cover a large share locally. The energy budget estimates a saving of about ${nb(Math.round(BUDGET.results.saving_per_home_nok / 1000) * 1000)} kr per home a year against direct electric heating with no solar, wind or battery. Provisional.`], ["What does it cost to live there?", `Operating cost per home under three electricity-price scenarios over 20 years, with visible assumptions. The budget uses ${BUDGET.prices.buy_nok.toFixed(2)} kr/kWh purchase and ${BUDGET.prices.sell_nok.toFixed(2)} kr/kWh sale today.`], ["Can it be repeated?", "The site-specific (the view, the laser terrain) is separated from the reusable: the energy concept, the sharing, the resilience and the platform. Whether it can be used for the next field is one of the questions the project will look into."], ["What is the innovation value?", "A digital twin built on measured terrain as a sales tool, preparation for energy sharing, resilience in power cuts as a goal, an internship with University of Agder students, and the ambition of a national reference project."], ["ESG and sustainability?", `CO₂ saved is estimated at about ${nb(Math.round(BUDGET.results.co2_saved_kg / 1000) * 1000)} kg a year, computed at ${nb(BUDGET.prices.co2_kg_per_kwh)} kg per kWh of grid power. Self-sufficiency for power is ${nb(BUDGET.results.self_sufficiency_pct)} % in the working energy budget. All with a source.`], ["Is the view real?", "The view photo was taken from the neighbouring plot, a little lower than the field, and the model can be compared with the photograph from the same point. The aim is a sea view from every plot, but it is not certain every plot will get one; in the model's proposal all see water."]];
  const room = no
    ? ["Energiregnskap med forutsetninger, regneark og utskrift", `EED-simulering av brønnparken, ${EED.years} år`, "Vurdering av seksten tiltak med robusthet ved strømbrudd", "Tomtedata: sol, sikt, terreng og horisont for hver tomt", "Eiendom fra Matrikkelen og veinett med stigning", "Arbeidsopplegg, retning fra prosjekteier og møtenotater"]
    : ["Energy budget with assumptions, spreadsheet and print", `EED simulation of the borehole field, ${EED.years} years`, "Assessment of sixteen measures with outage robustness", "Plot data: sun, view, terrain and horizon for every plot", "Parcel from the cadastre and road network with grades", "Work structure, direction from the project owner and meeting notes"];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "For investorer" : "For investors"}
        lede={no
          ? `Rundt ${FACT.plots} boliger på et eget eid felt, med ambisjon om å bli et nasjonalt referanseprosjekt for energi. Tallene står med kilde og dato. Et lukket datarom for investorer er planlagt.`
          : `About ${FACT.plots} homes on a self-owned field, with the ambition of becoming a national reference project for energy. The figures carry a source and a date. A closed data room for investors is planned.`}
        action={<><Link className="btn btn-amber" href={`/${locale}/interesse`}>{no ? "Be om investormateriale" : "Request investor material"}</Link><Link className="btn btn-ghost" href={`/${locale}/login`}>{no ? "Logg inn" : "Log in"}</Link></>}
      />
      <section className="wrap pb-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        <Figure a={assumption("homes")} locale={locale} size="md" />
        <Figure a={assumption("parcel_m2")} locale={locale} size="md" />
        <Figure a={assumption("saving_per_home")} locale={locale} size="md" />
        <Figure a={assumption("co2_saved")} locale={locale} size="md" />
      </section>
      <section className="wrap section-tight">
        <div className="panel p-7 md:p-12 grid gap-x-14 gap-y-10 md:grid-cols-2">
          {qa.map(([q, a]) => (
            <div key={q}><h2 className="display text-[26px]">{q}</h2><p className="mt-2.5 text-bone-2 text-[15.5px] max-w-[50ch]">{a}</p></div>
          ))}
        </div>
      </section>
      <section className="wrap section-tight grid gap-10 lg:grid-cols-[1fr_1fr] items-start">
        <div>
          <h2 className="display text-[clamp(30px,4vw,48px)]">{no ? "Det som skal ligge i dataromet" : "What the data room will hold"}</h2>
          <ul className="mt-5 grid gap-2">
            {room.map((s) => <li key={s} className="grid grid-cols-[10px_1fr] gap-3 text-[15px]"><span className="w-1.5 h-1.5 rounded-full bg-amber mt-2.5" />{s}</li>)}
          </ul>
          <p className="provenance mt-5 max-w-[56ch]">{no ? `De offentlige dokumentene ligger allerede i dokumentbanken. Rapportene fra energi- og markedssporet legges til når de leveres i sluttfasen, ${weeks(FINAL_PHASE.weeks)}.` : `The public documents are already in the document bank. The reports from the energy and market tracks are added when delivered in the final phase, ${weeks(FINAL_PHASE.weeks, "en")}.`}</p>
        </div>
        <div className="paper p-7 md:p-9">
          <div className="display text-[26px]">{no ? "Det investorer skal oppleve" : "What investors should experience"}</div>
          <p className="mt-3 text-[15.5px] text-[#3b4950] max-w-[48ch]">
            {no
              ? "Et felt som er målt før det er tegnet. En tomt du kan stå på i modellen og se fjorden fra. Et energikonsept med tall som kan etterprøves. Og en plattform som følger feltet fra salg til drift, med målt forbruk fra de eksisterende byggene som sammenligning underveis."
              : "A field measured before it is drawn. A plot you can stand on in the model and see the fjord from. An energy concept with figures that can be checked. And a platform that follows the field from sale to operation, with measured consumption from the existing buildings as a comparison along the way."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link className="btn btn-amber btn-sm" href={`/${locale}/energi`}>{no ? "Energikonseptet" : "The energy concept"}</Link>
            <Link className="btn btn-sm btn-ghost !text-[#17232a] !border-[#17232a]/30" href={`/${locale}/dokumenter`}>{no ? "Dokumentbanken" : "The document bank"}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
