import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { loadPlots } from "@/lib/data";
import { assumption } from "@/lib/assumptions";
import { BUDGET, DIRECTION, EED, MEASURES } from "@/lib/energyPlan";
import Nav from "@/components/ui/Nav";
import Ambient from "@/components/ui/Ambient";
import Film from "@/components/ui/Film";
import Stage from "@/components/Stage";
import ProofSlider from "@/components/ui/ProofSlider";
import Passport from "@/components/ui/Passport";
import Src from "@/components/ui/Source";
import TerrainCut from "@/components/ui/TerrainCut";
import MapJourney from "@/components/ui/MapJourney";
import { Figure } from "@/components/ui/Provenance";
import { Words } from "@/components/ui/Motion";

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const d = t(locale);
  const no = locale === "no";
  const { plots } = await loadPlots();
  const withSea = plots.filter((p) => p.view.water_visible_deg > 0).length;
  const openSea = plots.filter((p) => p.view.open_sea_visible).length;
  const rows = new Set(plots.map((p) => p.row)).size;
  const best = [...plots].sort((a, b) => b.sun.dec21.hours - a.sun.dec21.hours || b.view.water_visible_deg - a.view.water_visible_deg).slice(0, 3);
  const nb = (v: number) => v.toLocaleString(no ? "nb-NO" : "en-GB");
  const facts: string[] = no
    ? [`${plots.length} tomter i ${rows} rekker`, `${withSea} av ${plots.length} med målt sjøutsikt`, `${openSea} med åpent hav i sikt`, "87,4 meter over havet", "31 823 målte trær", "40 181 m² eiendom", "1 m laserterreng", "Rødberg, Lindesnes"]
    : [`${plots.length} plots in ${rows} rows`, `${withSea} of ${plots.length} with a measured sea view`, `${openSea} with open sea in view`, "87.4 metres above sea level", "31,823 measured trees", "40,181 m² parcel", "1 m laser terrain", "Rødberg, Lindesnes"];
  const photos: [string, string][] = no
    ? [["photo_fjord_wide.webp", "Snigsfjorden fra åsen, sett mot sør. Audna kommer inn fra høyre."], ["photo_fjord_farm.webp", "Gården på Rødberg og elvesvingen rett nedenfor feltet."], ["photo_sea_summer.webp", "Sommer over fjorden, med havet i glipen mellom åsene."]]
    : [["photo_fjord_wide.webp", "Snigsfjorden from the hill, looking south. The Audna comes in from the right."], ["photo_fjord_farm.webp", "The farm at Rødberg and the river bend right below the field."], ["photo_sea_summer.webp", "Summer over the fjord, with the sea in the gap between the hills."]];
  const yes = MEASURES.filter((m) => m.verdict === "yes"), maybe = MEASURES.filter((m) => m.verdict === "maybe"), noM = MEASURES.filter((m) => m.verdict === "no");
  const pvAdjusted = Math.round(BUDGET.pv.annual_kwh * 0.7 / 1000) * 1000;
  const phases: [string, string, boolean][] = no
    ? [["Regulering", "Pågår. Prosjektet starter før reguleringsplanen, så energikonsept og marked utvikles samtidig.", true], ["Energikonsept", "Energiregnskap, brønnpark og vurdering av tiltak foreligger som arbeidsgrunnlag. Teknisk rapport kommer.", false], ["Salg gjennom megler", "Tomter, priser og fremdrift oppgis når planen er vedtatt. Meld interesse for å få beskjed.", false], ["Bygging og måling", "Faktisk ytelse publiseres når boligene står, målt mot de eksisterende byggene.", false]]
    : [["Zoning", "In progress. The project starts before the zoning plan, so the energy concept and the market are developed together.", true], ["Energy concept", "The energy budget, the borehole field and the assessment of measures exist as a working basis. The technical report follows.", false], ["Sale through an agent", "Plots, prices and schedule are given when the plan is adopted. Register interest to be told.", false], ["Building and measuring", "Actual performance is published when the homes stand, measured against the existing buildings.", false]];

  return (
    <>
      <Ambient />
      <Nav locale={locale} />

      {/* 1. the journey is the front page */}
      <section id="modell" className="wrap pt-3 md:pt-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] items-end mb-5 md:mb-7">
          <Words as="h1" className="display text-[clamp(40px,6.6vw,104px)] max-w-[13ch]" text={no ? "Norges mest energivennlige boligfelt." : "Norway's most energy-friendly housing field."} />
          <p className="lede max-w-[38ch] lg:pb-3 rise-in rise-in-2">
            {no
              ? `${plots.length} boliger i terrasser over sørhellingen på Knotten, rekke under rekke, over Snigsfjorden i Lindesnes. Sjøutsikt fra hver tomt, målt i terrenget. Reisen under går fra fjorden og helt inn i stua.`
              : `${plots.length} homes in terraces across the south face of Knotten, row under row, above Snigsfjorden in Lindesnes. A sea view from every plot, measured in the terrain. The journey below runs from the fjord all the way into the living room.`}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] items-stretch">
          <div className="rise-in rise-in-2"><Stage plots={plots} locale={locale} hero /></div>
          <aside className="grid gap-4 lg:grid-rows-[auto_1fr] rise-in rise-in-3">
            <div>
              <Film locale={locale} />
              <div className="marks !pt-2.5"><span /><em className="not-italic">{no ? "Flyturen, rendret fra samme modell" : "The fly-in, rendered from the same model"}</em><span /></div>
            </div>
            <div className="paper p-5 flex flex-col gap-5">
              {[[`${plots.length}`, no ? `tomter i ${rows} rekker, ${withSea} av ${plots.length} med målt sjøutsikt` : `plots in ${rows} rows, ${withSea} of ${plots.length} with a measured sea view`], [`${EED.boreholes}`, no ? "energibrønner, 106 m dype, dimensjonert for 35 år" : "boreholes, 106 m deep, dimensioned for 35 years"], ["87", no ? "meter over havet på toppen av Knotten" : "metres above sea level on the top of Knotten"]].map(([n, s]) => (
                <div key={s} className="grid grid-cols-[76px_1fr] items-baseline gap-3">
                  <div className="num text-[34px]">{n}</div>
                  <div className="text-[14px] leading-snug">{s}</div>
                </div>
              ))}
              <Link className="btn btn-amber btn-sm self-start mt-auto" href={`/${locale}/interesse`}>{d.cta.register}</Link>
            </div>
          </aside>
        </div>
        <div className="marks"><span /><span /><em className="not-italic">{no ? "Reisen starter av seg selv. Klikk i modellen for å styre den, Escape gir siden tilbake." : "The journey starts on its own. Click the model to take control, Escape hands the page back."}</em><span /><span /></div>
      </section>

      {/* 2. the facts, each with its source */}
      <section className="wrap mt-8 md:mt-12">
        <div className="facts rise">
          <div className="fact"><b>{no ? "Rundt 30" : "About 30"}</b><span>{no ? "tomter, alle planlagt med sjøutsikt" : "plots, all planned with a sea view"} <Src id="sigve30" locale={locale} /></span></div>
          <div className="fact"><b>40 181 m²</b><span>{no ? "samlet tomteareal, gnr 355 bnr 10 og 368" : "parcel in all, cadastral 355/10 and 355/368"} <Src id="areal" locale={locale} /></span></div>
          <div className="fact"><b>{no ? "Maks 6 %" : "Max 6 %"}</b><span>{no ? "stigning på veiene i feltet" : "grade on the roads in the field"} <Src id="vei" locale={locale} /></span></div>
          <div className="fact"><b>{no ? "Regulering" : "Zoning"}</b><span>{no ? "pågår. Prosjektet starter før reguleringsplanen" : "in progress. The project starts before the zoning plan"} <Src id="regulering" locale={locale} /></span></div>
        </div>
      </section>

      {/* 3. the place */}
      <section className="wrap section-tight grid gap-8 lg:grid-cols-[5fr_7fr] items-center">
        <div className="rise">
          <div className="label mb-3">{no ? "Stedet" : "The place"}</div>
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch]">{no ? "Fra elva og opp på Knotten." : "From the river up onto Knotten."}</h2>
          <p className="lede mt-5 max-w-[46ch]">
            {no
              ? "Feltet ligger på en knaus rett vest for Rødbergsveien, der Audna vider seg ut i Snigsfjorden. Nederst, ved veien, er det flatt. Så stiger terrenget bratt, og fra rekkene oppover hellingen går siktlinjen sørover, ut fjorden og til åpent hav."
              : "The field sits on a knoll just west of Rødbergsveien, where the Audna widens into Snigsfjorden. At the bottom, by the road, it is flat. Then the ground rises steeply, and from the rows up the slope the sight line runs south, out the fjord and to open sea."}
          </p>
          <p className="mt-4 text-[15px] text-ink-2 max-w-[48ch]">
            {no ? "Terrengprofilen er tegnet i Norgeskart fra Spangereidveien til Knotten: 409,5 meter, fra 0 til 60 meter over havet." : "The terrain profile is drawn in Norgeskart from Spangereidveien to Knotten: 409.5 metres, from 0 to 60 metres above the sea."} <Src id="profil" locale={locale} />
          </p>
        </div>
        <div className="rise rise-late"><TerrainCut locale={locale} /></div>
      </section>

      {/* 4. the place, photographed */}
      <section className="section-tight">
        <div className="wrap grid gap-4 md:grid-cols-[1fr_1fr] items-end mb-6">
          <h2 className="display text-[clamp(36px,5.4vw,80px)] max-w-[12ch] rise">{no ? "Slik ser det ut i dag." : "This is how it looks today."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no
              ? "Fotografier fra åsen, tatt av prosjekteier gjennom året fra nabotomten, litt lavere enn feltet. Modellen på forsiden står på samme sted og ser samme vei."
              : "Photographs from the hill, taken by the project owner through the year from the neighbouring plot, a little lower than the field. The model on the front page stands in the same place and looks the same way."}
            {" "}<Src id="foto" locale={locale} />
          </p>
        </div>
        <div className="wrap">
          <div className="grid gap-4 md:grid-cols-3">
            {photos.map(([f, cap], i) => (
              <figure key={f} className="frame">
                <img src={`/assets/incoming/web/${f}`} alt={cap} className="w-full aspect-[4/3] object-cover" loading={i === 0 ? "eager" : "lazy"} />
                <figcaption className="provenance px-4 py-3">{cap}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 5. the maps behind the plan */}
      <section className="wrap section-tight">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-end mb-8">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Kartene bak planen." : "The maps behind the plan."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no ? "Prosjekteiers egne kart, fra siktlinjen ut til havet og helt ned til den første skissen av boligrekkene. Bla nedover, så bytter kartet." : "The project owner's own maps, from the sight line out to the sea down to the first sketch of the rows. Scroll, and the map changes."}
          </p>
        </div>
        <MapJourney locale={locale} />
      </section>

      {/* 6. measured, not drawn */}
      <section className="section-tight">
        <div className="marquee py-2">
          <div>
            {[...facts, ...facts].map((f, i) => (
              <span key={i} className="display text-[clamp(28px,3.6vw,52px)] whitespace-nowrap text-bone/80">{f}<span className="inline-block w-2.5 h-2.5 rounded-full bg-amber ml-12 align-middle" /></span>
            ))}
          </div>
        </div>
        <div className="wrap mt-12 grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div className="rise">
            <h2 className="display text-[clamp(36px,5vw,72px)] max-w-[10ch]">{no ? "Målt, ikke tegnet." : "Measured, not drawn."}</h2>
            <p className="lede mt-5 max-w-[44ch]">
              {no
                ? "Terrenget er Kartverkets laserskanning på én meter. Trærne er talt i det samme datasettet. Eiendomsgrensen er hentet fra Matrikkelen. Solen går sin ekte bane over den ekte åsen, og hver tomt i terrassene er sjekket mot vannet med nabohusene stående."
                : "The terrain is Kartverket's one-metre laser scan. The trees are counted in the same dataset. The parcel boundary comes from the cadastre. The sun follows its real path over the real ridge, and every plot in the terraces is checked against the water with the neighbouring houses standing."}
              {" "}<Src id="modell" locale={locale} />
            </p>
            <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2">
              <Figure a={assumption("knoll_top")} locale={locale} size="md" />
              <Figure a={assumption("sea_corridor_deg")} locale={locale} size="md" />
              <Figure a={assumption("open_sea_plots")} locale={locale} size="md" />
              <Figure a={assumption("parcel_m2")} locale={locale} size="md" />
            </div>
          </div>
          <div className="rise rise-late grid gap-3 content-start">
            <ProofSlider photo="/assets/incoming/web/view_from_grillbu.webp" model="/renders/web/grillbu_photo_match.webp" labels={[no ? "Fotografi" : "Photograph", no ? "Modell" : "Model"]} />
            <p className="provenance max-w-[60ch]">
              {no
                ? "Fotografiet er tatt fra naboens grillbu, litt lavere enn feltet. Modellkameraet står på samme punkt, 1,7 meter over bakken, mot 150 grader. Dra i skillet."
                : "The photograph was taken from the neighbour's grill hut, a little lower than the field. The model camera stands on the same point, 1.7 metres above the ground, towards 150 degrees. Drag the divider."}
            </p>
          </div>
        </div>
      </section>

      {/* 7. the energy concept, as it stands */}
      <section className="wrap section-tight">
        <div className="panel overflow-hidden">
          <div className="grid lg:grid-cols-[1.1fr_1fr]">
            <div className="p-7 md:p-12 grid content-start gap-7">
              <div>
                <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch]">{no ? "Et felt som klarer seg selv." : "A field that looks after itself."}</h2>
                <p className="lede mt-5 max-w-[50ch]">
                  {no
                    ? "Energikonseptet utvikles sammen med Universitetet i Agder. Grunnlaget finnes allerede: et energiregnskap for hele feltet, en brønnpark dimensjonert i EED, og en vurdering av seksten tiltak. Tallene er foreløpige og står med kilde."
                    : "The energy concept is developed with the University of Agder. The basis already exists: an energy budget for the whole field, a borehole field dimensioned in EED, and an assessment of sixteen measures. The figures are provisional and carry their source."}
                  {" "}<Src id="retning" locale={locale} />
                </p>
              </div>
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 max-w-[560px]">
                <div><div className="num text-[38px]">{nb(BUDGET.demand_total_kwh)}<span className="text-[14px] font-body font-normal opacity-60 ml-1.5">kWh/{no ? "år" : "yr"}</span></div><div className="mt-1.5 text-[15px]">{no ? "Energibehov, hele feltet" : "Energy demand, whole field"} <Src id="budsjett" locale={locale} /></div><div className="provenance">{no ? "30 boliger, kontor og lager. Energiregnskap, arbeidsgrunnlag" : "30 homes, office and storage. Energy budget, working basis"}</div></div>
                <div><div className="num text-[38px]">{nb(pvAdjusted)}<span className="text-[14px] font-body font-normal opacity-60 ml-1.5">kWh/{no ? "år" : "yr"}</span></div><div className="mt-1.5 text-[15px]">{no ? "Solstrøm fra takene" : "Solar from the roofs"}</div><div className="provenance">{no ? `Regnearket sier ${nb(BUDGET.pv.annual_kwh)} med 31 % moduler; her nedjustert til 22 %` : `The spreadsheet says ${nb(BUDGET.pv.annual_kwh)} with 31 % modules; adjusted here to 22 %`}</div></div>
                <div><div className="num text-[38px]">{nb(BUDGET.bedrock.delivered_kwh)}<span className="text-[14px] font-body font-normal opacity-60 ml-1.5">kWh/{no ? "år" : "yr"}</span></div><div className="mt-1.5 text-[15px]">{no ? "Varme fra berget" : "Heat from the bedrock"} <Src id="eed" locale={locale} /></div><div className="provenance">{no ? `${EED.boreholes} brønner, ${EED.depth_m} m, årsvarmefaktor ${BUDGET.bedrock.scop}` : `${EED.boreholes} boreholes, ${EED.depth_m} m, seasonal factor ${BUDGET.bedrock.scop}`}</div></div>
                <div><div className="num text-[38px]">{BUDGET.battery.total_kwh}<span className="text-[14px] font-body font-normal opacity-60 ml-1.5">kWh</span></div><div className="mt-1.5 text-[15px]">{no ? "Batteri i feltet" : "Battery in the field"}</div><div className="provenance">{no ? `${BUDGET.battery.per_home_kwh} kWh i hver bolig, lys og varme ved strømbrudd` : `${BUDGET.battery.per_home_kwh} kWh in every home, light and heat in an outage`}</div></div>
              </div>
              <div className="grid gap-3 text-[14px]">
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted mr-1 w-[92px]">{no ? "Anbefalt" : "Recommended"}</span>{yes.map((m) => <span key={m.name.no} className="chip chip-pine">{m.name[locale]}</span>)}</div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted mr-1 w-[92px]">{no ? "Vurderes" : "Under review"}</span>{maybe.map((m) => <span key={m.name.no} className="chip chip-amber">{m.name[locale]}</span>)}</div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted mr-1 w-[92px]">{no ? "Ikke nå" : "Not now"}</span>{noM.map((m) => <span key={m.name.no} className="chip opacity-70">{m.name[locale]}</span>)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="btn btn-amber" href={`/${locale}/energi`}>{no ? "Hele energikonseptet" : "The whole energy concept"}</Link>
                <Link className="btn btn-ghost" href={`/${locale}/portal/energy`}>{no ? "Energidashbordet" : "The energy dashboard"}</Link>
              </div>
            </div>
            <div className="grid content-between gap-6 p-7 md:p-12 bg-bone/4 border-t lg:border-t-0 lg:border-l line">
              <figure className="paper p-3 md:p-4">
                <img src="/assets/energy/eed_fluid_temperatures.webp" alt={no ? "Væsketemperatur i brønnparken over 35 år" : "Fluid temperature in the borehole field over 35 years"} className="w-full rounded-[8px]" loading="lazy" />
                <figcaption className="provenance mt-2.5">{no ? `Brønnparken simulert i Earth Energy Designer: ${EED.config}, ${EED.spacing_m} m avstand. Væsken holder seg mellom ${EED.fluid_min_c} og ${EED.fluid_max_c} °C gjennom ${EED.years} år, så berget tømmes ikke.` : `The borehole field simulated in Earth Energy Designer: ${EED.config}, ${EED.spacing_m} m apart. The fluid stays between ${EED.fluid_min_c} and ${EED.fluid_max_c} °C through ${EED.years} years, so the bedrock is not depleted.`}</figcaption>
              </figure>
              <div>
                <div className="text-[14px] text-muted mb-3">{no ? "Retningen fra prosjekteier, 4. september 2026" : "The direction from the project owner, 4 September 2026"}</div>
                <ul className="grid gap-2 text-[14.5px] text-bone-2 max-w-[52ch]">
                  {DIRECTION[locale].slice(0, 5).map((s) => <li key={s} className="grid grid-cols-[10px_1fr] gap-3"><span className="w-1.5 h-1.5 rounded-full bg-amber mt-2" />{s}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. passports */}
      <section className="wrap section-tight">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] items-end">
          <div className="rise">
            <h2 className="display text-[clamp(36px,5vw,72px)] max-w-[12ch]">{no ? "Mest vintersol." : "Most winter sun."}</h2>
            <p className="lede mt-5 max-w-[50ch]">
              {no
                ? "Solpasset er regnet ut fra terrenget rundt hver tomt den 21. desember, i stuehøyde. Det er tallet en kjøper på 58 grader nord faktisk lurer på."
                : "The sun passport is computed from the terrain around each plot on 21 December, at living-room height. It is the number a buyer at 58 degrees north actually wonders about."}
            </p>
          </div>
          <Link className="btn" href={`/${locale}/tomter`}>{no ? `Alle ${plots.length} tomter` : `All ${plots.length} plots`}</Link>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {best.map((p, i) => <div key={p.id} className="rise" style={{ animationDelay: `${i * 60}ms` }}><Passport plot={p} locale={locale} /></div>)}
        </div>
      </section>

      {/* 9. what is there today, and what is planned */}
      <section className="wrap section-tight grid gap-8 lg:grid-cols-[1fr_1fr] items-center">
        <figure className="rise frame">
          <img src="/assets/incoming/web/knotten_map.webp" alt={no ? "Knotten på eiendomskartet med de planlagte byggene i grønt" : "Knotten on the cadastral map with the planned buildings in green"} className="w-full" loading="lazy" />
          <figcaption className="provenance px-4 py-3">{no ? "Knotten på eiendomskartet. Kontorbygget og boligen ved Rødbergsveien er der i dag; de to grønne byggene er planlagt." : "Knotten on the cadastral map. The office and the house by Rødbergsveien are there today; the two green buildings are planned."}</figcaption>
        </figure>
        <div className="rise rise-late">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch]">{no ? "Bygg som allerede måler." : "Buildings that already measure."}</h2>
          <p className="lede mt-5 max-w-[46ch]">
            {no
              ? "Kontorbygget med 19 kontorer i dag og 28 når utvidelsen står, og boligen nedenfor, er en del av energibildet fra dag én. De har målere. Der modellen sier hva et tak burde gi, sier måleren hva det ga. Et tilbygg til kontoret og et lager- og verkstedbygg bak boligen er planlagt, og ligger i modellen."
              : "The office with 19 offices today and 28 when the extension stands, and the house below it, are part of the energy picture from day one. They have meters. Where the model says what a roof should yield, the meter says what it did. An extension to the office and a workshop behind the house are planned, and sit in the model."}
            {" "}<Src id="kontor" locale={locale} />
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link className="btn btn-ghost" href={`/${locale}/energi/eksisterende`}>{no ? "Eksisterende bygg" : "Existing buildings"}</Link>
            <Link className="btn btn-ghost" href={`/${locale}/omradet`}>{no ? "Området" : "The area"}</Link>
          </div>
        </div>
      </section>

      {/* 10. where the project stands */}
      <section className="wrap section-tight">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-end mb-8">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Hvor prosjektet står." : "Where the project stands."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no
              ? "Det som kan dokumenteres i dag, og det som må på plass før neste steg. Alt på denne siden oppdateres når planen og rapportene kommer."
              : "What can be documented today, and what has to be in place before the next step. Everything on this page is updated when the plan and the reports arrive."}
          </p>
        </div>
        <div className="phases rise">
          {phases.map(([h, s, now]) => <div key={h} className={now ? "now" : ""}><b>{h}</b><span>{s}</span></div>)}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link className="btn btn-ghost" href={`/${locale}/prosjektet`}>{no ? "Om prosjektet" : "About the project"}</Link>
          <Link className="btn btn-ghost" href={`/${locale}/investor`}>{d.cta.investor}</Link>
          <Link className="btn btn-ghost" href={`/${locale}/dokumenter`}>{no ? "Dokumenter" : "Documents"}</Link>
        </div>
      </section>

      {/* 11. invitation */}
      <section className="wrap pb-6">
        <div className="paper p-8 md:p-14 grid gap-8 md:grid-cols-[1fr_auto] items-center">
          <div className="rise">
            <div className="display text-[clamp(32px,4.6vw,64px)] max-w-[14ch]">{no ? "Vil du ha beskjed når tomtene slippes?" : "Want to know when the plots are released?"}</div>
            <p className="lede mt-4 max-w-[44ch] !text-[#3b4950]">{no ? "Meld interesse. Du velger selv hva vi får bruke kontakten til." : "Register interest. You choose what we may use your contact for."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-amber" href={`/${locale}/interesse`}>{d.cta.register}</Link>
            <Link className="btn btn-ghost !text-[#17232a] !border-[#17232a]/30" href={`/${locale}/investor`}>{d.cta.investor}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
