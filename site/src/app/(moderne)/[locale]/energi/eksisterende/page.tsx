import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import ConsumptionChart from "@/components/charts/ConsumptionChart";
import { BUDGET, FACT, fmt } from "@/lib/facts";

export default async function Existing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const nb = (v: number) => fmt(v, no ? "no" : "en");
  const range = `±${BUDGET.office_storage_range_pct} %`;
  const extension = FACT.offices_after - FACT.offices_now;
  const buildings: { name: string; status: string; text: string; figure: string; note: string }[] = no
    ? [
        { name: "Kontorbygget", status: "Står i dag", text: `Ved Rødbergsveien. ${FACT.offices_now} kontorer i dag, ${FACT.offices_after} når utvidelsen står. Faktisk strømforbruk hentes inn for dagens bygg, deles på ferdige kontorer og skaleres til ${FACT.offices_after}, med felleslastene skilt ut.`, figure: `${nb(BUDGET.office_kwh)} kWh/år`, note: `Arbeidsforutsetning i energiregnskapet, ${range}. Byttes ut med målt forbruk.` },
        { name: "Boligen", status: "Står i dag", text: "Ved Rødbergsveien, nederst på eiendommen. Forbruket er ikke hentet inn ennå, og blir et sammenligningsgrunnlag for de nye boligene.", figure: "Ikke tallfestet", note: "Bolighuset har ingen egen rad i energiregnskapet ennå." },
        { name: "Tilbygg til kontoret", status: "Planlagt", text: `Utvidelsen som tar kontorbygget fra ${FACT.offices_now} til ${FACT.offices_after} kontorer. Ligger i modellen ved vestenden av dagens bygg, plassering og størrelse foreløpig.`, figure: `${extension} kontorer`, note: "Planlagt, prosjekteier september 2026." },
        { name: "Lager og verksted", status: "Planlagt", text: "Nytt bygg rett bak boligen. Forventes å bruke mindre strøm enn en bolig, men regnes som én bolig inntil målte tall finnes, tydelig merket.", figure: `${nb(BUDGET.storage_kwh)} kWh/år`, note: `Arbeidsforutsetning i energiregnskapet, ${range}.` },
      ]
    : [
        { name: "The office building", status: "Existing", text: `By Rødbergsveien. ${FACT.offices_now} offices today, ${FACT.offices_after} when the extension stands. Actual consumption is to be collected for today's building, divided by completed offices and scaled to ${FACT.offices_after}, with shared loads separated.`, figure: `${nb(BUDGET.office_kwh)} kWh/yr`, note: `Working assumption in the energy budget, ${range}. Replaced by measured consumption.` },
        { name: "The house", status: "Existing", text: "By Rødbergsveien, at the bottom of the property. Its consumption has not been collected yet, and becomes a basis of comparison for the new homes.", figure: "Not quantified", note: "The house has no row of its own in the energy budget yet." },
        { name: "Office extension", status: "Planned", text: `The extension taking the office from ${FACT.offices_now} to ${FACT.offices_after} offices. Sits in the model at the west end of today's building, position and size provisional.`, figure: `${extension} offices`, note: "Planned, project owner, September 2026." },
        { name: "Warehouse and workshop", status: "Planned", text: "A new building directly behind the house. Expected to use less power than a home, but counted as one home until measured figures exist, clearly labelled.", figure: `${nb(BUDGET.storage_kwh)} kWh/yr`, note: `Working assumption in the energy budget, ${range}.` },
      ];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Bygg som allerede bruker strøm." : "Buildings that already use power."}
        lede={no
          ? "To bygg på eiendommen står i dag, og to er planlagt. De er en del av det samlede energibildet for Knotten, og målt forbruk blir et sammenligningsgrunnlag for de nye boligene. Målte data er ikke hentet inn ennå; historikk, tiltak og virkning vises her når målerdataene er koblet til."
          : "Two buildings on the property stand today, and two are planned. They are part of the overall energy picture for Knotten, and their measured consumption becomes a basis of comparison for the new homes. Measured data has not been collected yet; history, interventions and effect are shown here once the meter data is connected."}
      />
      <section className="wrap pb-12 grid gap-4 md:grid-cols-2">
        {buildings.map((b, i) => (
          <div key={b.name} className="panel p-6 md:p-7 rise" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-baseline justify-between gap-4">
              <div className="display text-[26px]">{b.name}</div>
              <span className={`chip ${b.status === "Planlagt" || b.status === "Planned" ? "chip-amber" : "chip-pine"}`}>{b.status}</span>
            </div>
            <p className="mt-3 text-[15.5px] text-bone-2">{b.text}</p>
            <div className="mt-5 num text-[30px]">{b.figure}</div>
            <div className="provenance mt-1">{b.note}</div>
          </div>
        ))}
      </section>
      <section className="wrap pb-16 grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="display text-[32px]">{no ? "Kontorbygget" : "The office"}</h2>
          <div className="mt-4"><ConsumptionChart seed={3} locale={locale} /></div>
        </div>
        <div>
          <h2 className="display text-[32px]">{no ? "Boligen" : "The house"}</h2>
          <div className="mt-4"><ConsumptionChart seed={7} locale={locale} /></div>
        </div>
      </section>
      <section className="wrap pb-24">
        <div className="panel p-7 max-w-[70ch]">
          <div className="font-medium">{no ? "Slik kobles målingene til" : "How the meters get connected"}</div>
          <ol className="mt-3 list-decimal ml-5 text-[15px] grid gap-1.5">
            <li>{no ? "Målepunkt-ID (Elhub) for begge bygg, og samtykke til å vise aggregerte tall." : "Metering-point IDs (Elhub) for both buildings, and consent to show aggregated figures."}</li>
            <li>{no ? "Historikk per time så langt tilbake som mulig, og tiltak med dato (varmepumpe, isolasjon, solceller)." : "Hourly history as far back as possible, and interventions with dates (heat pump, insulation, PV)."}</li>
            <li>{no ? "Graddagskorrigering, så vær ikke forveksles med besparelse." : "Degree-day correction, so weather is not mistaken for saving."}</li>
            <li>{no ? "Målt forbruk mot modellen: grunnlaget for å sammenligne med de nye boligene." : "Measured consumption against the model: the basis for comparing with the new homes."}</li>
          </ol>
          <p className="provenance mt-4">{no ? "Grafene over er eksempeldata for å vise formen. De byttes ut ved tilkobling." : "The charts above are sample data to show the shape. They are replaced on connection."}</p>
        </div>
      </section>
    </>
  );
}
