import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import { Figure } from "@/components/ui/Provenance";
import { assumption } from "@/lib/assumptions";
import { BUDGET, EED } from "@/lib/energyPlan";

/** What investors ask, in the project owner's own order, and how the platform answers each with measured figures. */
export default async function Investor({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const nb = (v: number) => v.toLocaleString(no ? "nb-NO" : "en-GB");
  const qa = no
    ? [["Hva er besparelsen?", `Energibehovet for hele feltet er regnet til ${nb(BUDGET.demand_total_kwh)} kWh i året. Solstrøm fra takene, varme fra ${EED.boreholes} energibrønner og ${BUDGET.battery.total_kwh} kWh batteri dekker en stor del lokalt. Besparelsen mot en TEK17-referansebolig per hustype kommer i energigruppens sluttrapport; inntil da vises et merket anslag.`], ["Hva koster det å bo der?", `Driftskostnad per bolig under tre strømprisscenarier over 20 år, med synlige forutsetninger. Regnskapet bruker ${BUDGET.prices.buy_nok.toFixed(2).replace(".", ",")} kr/kWh kjøp og ${BUDGET.prices.sell_nok.toFixed(2).replace(".", ",")} kr/kWh salg i dag.`], ["Kan det gjentas?", "Det stedegne (utsikten, laserterrenget) skilles fra det gjenbrukbare: energikonseptet, delingen, robustheten og plattformen. Det siste er en pakke som kan brukes på neste felt."], ["Hva er innovasjonsverdien?", "En målt digital tvilling som salgsverktøy, energideling i feltet, drift uten nett ved strømbrudd, samarbeid med Universitetet i Agder, og ambisjonen om et nasjonalt referanseprosjekt."], ["ESG og bærekraft?", `Unngått CO₂ per år regnes med ${BUDGET.prices.co2_kg_per_kwh} kg per kWh, selvforsyningsgrad, lokal energiandel, og trær beholdt mot ryddet. Alt fra modellen, alt med kilde.`], ["Er utsikten ekte?", "Ja. Siktanalyse per tomt fra terrenget, alle tomtene på åsen med målt sjøutsikt, og fotografi mot modell fra samme punkt."]]
    : [["What is the saving?", `The energy demand for the whole field is computed at ${nb(BUDGET.demand_total_kwh)} kWh a year. Solar from the roofs, heat from ${EED.boreholes} boreholes and ${BUDGET.battery.total_kwh} kWh of battery cover a large share locally. The saving against a TEK17 reference home per house type comes in the energy group's final report; until then a labelled estimate is shown.`], ["What does it cost to live there?", `Operating cost per home under three electricity-price scenarios over 20 years, with visible assumptions. The budget uses ${BUDGET.prices.buy_nok.toFixed(2)} kr/kWh purchase and ${BUDGET.prices.sell_nok.toFixed(2)} kr/kWh sale today.`], ["Can it be repeated?", "The site-specific (the view, the laser terrain) is separated from the reusable: the energy concept, the sharing, the resilience and the platform. The latter is a kit for the next field."], ["What is the innovation value?", "A measured digital twin as sales tool, energy sharing in the field, off-grid operation in an outage, collaboration with the University of Agder, and the ambition of a national reference project."], ["ESG and sustainability?", `CO₂ avoided per year is computed at ${BUDGET.prices.co2_kg_per_kwh} kg per kWh, plus self-sufficiency, local energy share, and trees kept against cleared. All from the model, all with a source.`], ["Is the view real?", "Yes. Per-plot sight analysis from the terrain, every plot on the hill with a measured sea view, and photograph against model from the same point."]];
  const room = no
    ? ["Energiregnskap med forutsetninger, regneark og utskrift", "EED-simulering av brønnparken, 35 år", "Vurdering av seksten tiltak med robusthet ved strømbrudd", "Tomtedata: sol, sikt, terreng og horisont for hver tomt", "Eiendom fra Matrikkelen og veinett med stigning", "Arbeidsopplegg, retning fra prosjekteier og møtenotater"]
    : ["Energy budget with assumptions, spreadsheet and print", "EED simulation of the borehole field, 35 years", "Assessment of sixteen measures with outage robustness", "Plot data: sun, view, terrain and horizon for every plot", "Parcel from the cadastre and road network with grades", "Work structure, direction from the project owner and meeting notes"];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "For investorer" : "For investors"}
        lede={no
          ? "Rundt 30 boliger på et eget eid felt, utviklet som nasjonalt referanseprosjekt for energi. Alt vi hevder står med kilde og dato. Dataromet åpnes etter NDA."
          : "About 30 homes on a self-owned field, developed as a national reference project for energy. Everything we claim carries a source and a date. The data room opens after NDA."}
        action={<><Link className="btn btn-amber" href={`/${locale}/interesse`}>{no ? "Be om tilgang til dataromet" : "Request data-room access"}</Link><Link className="btn btn-ghost" href={`/${locale}/login`}>{no ? "Logg inn" : "Log in"}</Link></>}
      />
      <section className="wrap pb-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        <Figure a={assumption("homes")} locale={locale} size="md" />
        <Figure a={assumption("parcel_m2")} locale={locale} size="md" />
        <Figure a={assumption("energy_saving_pct")} locale={locale} size="md" />
        <Figure a={assumption("co2_avoided_t")} locale={locale} size="md" />
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
          <h2 className="display text-[clamp(30px,4vw,48px)]">{no ? "Det som ligger i dataromet" : "What sits in the data room"}</h2>
          <ul className="mt-5 grid gap-2">
            {room.map((s) => <li key={s} className="grid grid-cols-[10px_1fr] gap-3 text-[15px]"><span className="w-1.5 h-1.5 rounded-full bg-amber mt-2.5" />{s}</li>)}
          </ul>
          <p className="provenance mt-5 max-w-[56ch]">{no ? "De offentlige dokumentene ligger allerede i dokumentbanken. Rapportene fra energi- og markedsgruppen legges til når de leveres i desember 2026." : "The public documents are already in the document bank. The reports from the energy and market groups are added when delivered in December 2026."}</p>
        </div>
        <div className="paper p-7 md:p-9">
          <div className="display text-[26px]">{no ? "Det investorer skal oppleve" : "What investors should experience"}</div>
          <p className="mt-3 text-[15.5px] text-[#3b4950] max-w-[48ch]">
            {no
              ? "Et felt som er målt før det er tegnet. En tomt du kan stå på i modellen og se fjorden fra. Et energikonsept med tall som kan etterprøves. Og en plattform som følger feltet fra salg til drift, med de eksisterende byggenes målere som bevis underveis."
              : "A field measured before it is drawn. A plot you can stand on in the model and see the fjord from. An energy concept with figures that can be checked. And a platform that follows the field from sale to operation, with the existing buildings' meters as proof along the way."}
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
