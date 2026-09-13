import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import ConsumptionChart from "@/components/charts/ConsumptionChart";
import { BUDGET } from "@/lib/energyPlan";

export default async function Existing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const nb = (v: number) => v.toLocaleString(no ? "nb-NO" : "en-GB");
  const buildings: { name: string; status: string; text: string; figure: string; note: string }[] = no
    ? [
        { name: "Kontorbygget", status: "Står i dag", text: "Rødbergsveien 121. 19 kontorer i dag, 28 når utvidelsen står. Faktisk strømforbruk hentes for dagens bygg, deles på ferdige kontorer og skaleres til 28, med felleslastene skilt ut.", figure: `${nb(BUDGET.office_kwh)} kWh/år`, note: "Arbeidsforutsetning i energiregnskapet, ±30 %. Byttes ut med målt forbruk." },
        { name: "Boligen", status: "Står i dag", text: "Rødbergsveien 123, boligen nederst på eiendommen. Har måler. Forbruket blir kalibreringen for de nye husene: der modellen sier hva et tak burde gi, sier måleren hva det ga.", figure: `${nb(BUDGET.el_per_home_kwh + BUDGET.heat_per_home_kwh)} kWh/år`, note: "Som én bolig i regnskapet inntil målt forbruk er koblet til." },
        { name: "Tilbygg til kontoret", status: "Planlagt", text: "Utvidelsen som tar kontorbygget fra 19 til 28 kontorer. Ligger i modellen ved vestenden av dagens bygg, plassering og størrelse foreløpig.", figure: "9 kontorer", note: "Planlagt, prosjekteier september 2026." },
        { name: "Lager og verksted", status: "Planlagt", text: "Nytt bygg rett bak boligen. Forventes å bruke mindre strøm enn en bolig, men regnes som én bolig inntil målte tall finnes, tydelig merket.", figure: `${nb(BUDGET.storage_kwh)} kWh/år`, note: "Arbeidsforutsetning i energiregnskapet, ±30 %." },
      ]
    : [
        { name: "The office building", status: "Existing", text: "Rødbergsveien 121. 19 offices today, 28 when the extension stands. Measured consumption is taken for today's building, divided by completed offices and scaled to 28, with shared loads separated.", figure: `${nb(BUDGET.office_kwh)} kWh/yr`, note: "Working assumption in the energy budget, ±30 %. Replaced by measured consumption." },
        { name: "The house", status: "Existing", text: "Rødbergsveien 123, the house at the bottom of the parcel. It has a meter. Its consumption becomes the calibration for the new homes: where the model says what a roof should yield, the meter says what it did.", figure: `${nb(BUDGET.el_per_home_kwh + BUDGET.heat_per_home_kwh)} kWh/yr`, note: "As one home in the budget until measured consumption is connected." },
        { name: "Office extension", status: "Planned", text: "The extension taking the office from 19 to 28 offices. Sits in the model at the west end of today's building, position and size provisional.", figure: "9 offices", note: "Planned, project owner, September 2026." },
        { name: "Workshop and storage", status: "Planned", text: "A new building directly behind the house. Expected to use less power than a home, but counted as one home until measured figures exist, clearly labelled.", figure: `${nb(BUDGET.storage_kwh)} kWh/yr`, note: "Working assumption in the energy budget, ±30 %." },
      ];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Bygg som allerede måler." : "Buildings that already measure."}
        lede={no
          ? "To bygg på eiendommen produserer data i dag, og to er planlagt. De er en del av det samlede energibildet for Knotten, og de er kalibreringen: der modellen sier hva et tak burde gi, sier måleren hva det ga. Historikk, tiltak og virkning vises her når målerdataene er koblet til."
          : "Two buildings on the parcel produce data today, and two are planned. They are part of the overall energy picture for Knotten, and they are the calibration: where the model says what a roof should yield, the meter says what it did. History, interventions and effect are shown here once the meter data is connected."}
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
            <li>{no ? "Modell mot måler: samme metode som for feltets tak." : "Model against meter: the same method as for the field's roofs."}</li>
          </ol>
          <p className="provenance mt-4">{no ? "Grafene over er eksempeldata for å vise formen. De byttes ut ved tilkobling." : "The charts above are sample data to show the shape. They are replaced on connection."}</p>
        </div>
      </section>
    </>
  );
}
