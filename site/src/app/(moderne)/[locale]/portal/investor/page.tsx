import { isAdmin } from "@/lib/auth";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { canSeeDoc, canSeeThread, docs, threads } from "@/lib/server/records";
import { BUDGET, CONTACT, EED, FACT, PV_KWP_PER_HOME, SHARED_PANELS, assumption, fmt } from "@/lib/facts";
import Scenario from "@/components/portal/Scenario";
import NoAccess from "@/components/portal/NoAccess";
import { DocList, UploadForm } from "@/components/portal/Docs";
import { Threads } from "@/components/portal/Threads";
import { PageHead, Section } from "@/components/portal/ui";
import Icon, { type IconName } from "@/components/portal/Icon";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Datarom", "Data room");

/**
 * The investor data room: the case in the project's own figures (savings, running costs,
 * scalability, innovation, ESG), the scenario explorer, the documents and a direct line to the
 * project owner. Every figure carries its source and status; nothing here is a promise.
 */
export default async function InvestorRoom({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/investor", "investor");
  if (!ok) return <NoAccess locale={locale} session={session} area="investor" />;
  const lang = no ? "no" : "en";
  const nb = (v: number) => fmt(Math.round(v), lang);
  const [docState, threadState] = await Promise.all([docs.read(), threads.read()]);
  const roomDocs = docState.docs.filter((d) => canSeeDoc(session, d) && (d.audience.includes("investor") || d.audience.includes("all")));
  const qa = threadState.threads.filter((t) => t.area === "investor" && canSeeThread(session, t));
  const saving = BUDGET.results.saving_per_home_nok;
  const pillars: { icon: IconName; title: string; figure: string; unit: string; text: string; source: string }[] = [
    {
      icon: "bolt",
      title: no ? "Forventet besparelse" : "Expected saving",
      figure: nb(saving), unit: no ? "kr per bolig og år" : "kr per home a year",
      text: no ? `Mot direkte elektrisk oppvarming. For ${BUDGET.homes} boliger blir det om lag ${nb(saving * BUDGET.homes)} kr i året for feltet samlet.` : `Against direct electric heating. For ${BUDGET.homes} homes that is about ${nb(saving * BUDGET.homes)} kr a year for the field.`,
      source: no ? "Energiregnskapet, energisporet. Foreløpig." : "The energy budget, energy track. Provisional.",
    },
    {
      icon: "sliders",
      title: no ? "Lavere driftskostnader" : "Lower running costs",
      figure: fmt(BUDGET.results.self_sufficiency_pct, lang), unit: no ? "% selvforsynt med strøm" : "% self-sufficient in power",
      text: no ? `Egen produksjon på ${nb(BUDGET.results.own_production_kwh)} kWh i året. Bergvarmen gir om lag ${fmt(BUDGET.bedrock.scop, lang)} kWh varme per kWh strøm, og batteri med styring flytter forbruket til billige timer.` : `Own production of ${nb(BUDGET.results.own_production_kwh)} kWh a year. Bedrock heat gives about ${fmt(BUDGET.bedrock.scop, lang)} kWh of heat per kWh of power, and batteries with control move use to cheap hours.`,
      source: no ? "Energiregnskapet. Solstrømmen bør nedjusteres rundt 30 %." : "The energy budget. The solar figure should come down about 30 %.",
    },
    {
      icon: "overview",
      title: no ? "Skalerbart konsept" : "A scalable concept",
      figure: `${BUDGET.homes}`, unit: no ? "boliger i første felt" : "homes in the first field",
      text: no ? `Byggeklossene er de samme i hver bolig: om lag ${PV_KWP_PER_HOME} kWp sol, ${BUDGET.battery.per_home_kwh} kWh batteri og energistyring, pluss en felles brønnpark (${EED.boreholes} brønner) og et fellesanlegg for sol (første scenario rundt ${SHARED_PANELS} paneler). Den digitale plattformen gjenbrukes på neste felt.` : `The building blocks are the same in every home: about ${PV_KWP_PER_HOME} kWp of solar, a ${BUDGET.battery.per_home_kwh} kWh battery and energy management, plus a shared borehole field (${EED.boreholes} boreholes) and a shared solar plant (first scenario around ${SHARED_PANELS} panels). The digital platform is reused for the next field.`,
      source: no ? "Prosjekteiers retning 4. september 2026 og energiregnskapet." : "The project owner's direction of 4 September 2026 and the energy budget.",
    },
    {
      icon: "cube",
      title: no ? "Innovasjonsverdi" : "Innovation value",
      figure: fmt(FACT.trees_detected, lang), unit: no ? "trær målt i laserdata" : "trees measured in laser data",
      text: no ? `En digital tvilling bygget fra Kartverkets laserdata: sol og sikt er regnet for hver av de ${FACT.plots} tomtene, energideling mellom boligene modelleres, og data deles med Universitetet i Agder for forskning.` : `A digital twin built from Kartverket's laser data: sun and view are computed for each of the ${FACT.plots} plots, energy sharing between homes is modelled, and data is shared with the University of Agder for research.`,
      source: no ? "Nettsidens modell, september 2026." : "The website's model, September 2026.",
    },
    {
      icon: "sun",
      title: "ESG",
      figure: nb(BUDGET.results.co2_saved_kg / 1000), unit: no ? "tonn CO₂ spart i året" : "tonnes of CO₂ saved a year",
      text: no ? `Miljø: lokal fornybar energi og bergvarme; i modellens forslag ryddes ${fmt(FACT.trees_cleared, lang)} av trærne. Sosialt: batteri i hver bolig gir lys og varme ved strømbrudd. Styring: hvert tall på nettsiden har kilde og status.` : `Environment: local renewable energy and bedrock heat; the model's proposal clears ${fmt(FACT.trees_cleared, "en")} of the trees. Social: a battery in every home keeps light and heat in an outage. Governance: every figure on the website has a source and a status.`,
      source: no ? `Energiregnskapet, ${fmt(BUDGET.prices.co2_kg_per_kwh, lang)} kg CO₂ per kWh. Foreløpig.` : `The energy budget, ${fmt(BUDGET.prices.co2_kg_per_kwh, "en")} kg CO₂ per kWh. Provisional.`,
    },
  ];
  return (
    <>
      <PageHead
        eyebrow={no ? "For investorer og partnere" : "For investors and partners"}
        title={no ? "Datarom" : "Data room"}
        lede={no ? "Prosjektets egne tall, dokumentene og en direkte linje til prosjekteier. Tallene er arbeidsgrunnlag fra energisporet og nettsidens modell, merket med kilde; de endelige rapportene erstatter dem." : "The project's own figures, the documents and a direct line to the project owner. The figures are the working basis from the energy track and the website's model, marked with their source; the final reports replace them."}
        actions={<a className="btn btn-sm no-underline" href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(no ? "Møte om Knotten" : "Meeting about Knotten")}`}>{no ? "Be om et møte" : "Ask for a meeting"}</a>}
      />

      <Section title={no ? "Verdien i prosjektet" : "The value in the project"} sub={no ? "De fem punktene prosjekteier ba om: besparelse, driftskostnader, skalerbarhet, innovasjon og ESG." : "The five points the project owner asked for: saving, running costs, scalability, innovation and ESG."}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.title} className="panel p-5 md:p-6 grid content-start gap-2">
              <div className="flex items-center gap-2 text-[14px] font-medium"><Icon name={p.icon} className="text-fjord" />{p.title}</div>
              <div className="num text-[38px] mt-1">{p.figure}</div>
              <div className="text-[13.5px] text-muted -mt-1">{p.unit}</div>
              <p className="text-[14.5px] text-ink-2 mt-1">{p.text}</p>
              <div className="provenance mt-auto pt-2">{p.source}</div>
            </div>
          ))}
          <div className="panel-2 p-5 md:p-6 grid content-start gap-3">
            <div className="font-medium text-[14px]">{no ? "Prisforutsetningene i energiregnskapet" : "Price assumptions in the energy budget"}</div>
            <table className="table table-tight">
              <tbody>
                <tr><td>{no ? "Spotpris" : "Spot price"}</td><td className="n">{fmt(BUDGET.prices.spot_nok, lang)} kr/kWh</td></tr>
                <tr><td>{no ? "Nettleie" : "Grid tariff"}</td><td className="n">{fmt(BUDGET.prices.grid_nok, lang)} kr/kWh</td></tr>
                <tr><td>{no ? "Kjøp" : "Buying"}</td><td className="n">{fmt(BUDGET.prices.buy_nok, lang)} kr/kWh</td></tr>
                <tr><td>{no ? "Salg av overskudd" : "Selling surplus"}</td><td className="n">{fmt(BUDGET.prices.sell_nok, lang)} kr/kWh</td></tr>
              </tbody>
            </table>
            <div className="provenance">{no ? "Dagens faktiske priser i NO2 vises under Energi." : "Today's actual NO2 prices are shown under Energy."}</div>
          </div>
        </div>
      </Section>

      <Section title={no ? "Scenarioutforsker" : "Scenario explorer"} sub={no ? "Dra i forutsetningene og se utfallet regnes om. Startverdiene er energiregnskapets; responskurvene er foreløpige til energisporet leverer sine." : "Drag the assumptions and see the outcome recomputed. The starting values are the energy budget's; the response curves are provisional until the energy track delivers its own."}>
        <Scenario locale={locale} homes={assumption("homes").value} />
      </Section>

      <Section title={no ? "Dokumenter i datarommet" : "Documents in the data room"} sub={no ? "Prospekt, finansiell modell, energikonsept, reguleringsstatus og risikoregister legges her etter hvert som de blir klare." : "Prospectus, financial model, energy concept, regulation status and risk register are added here as they become ready."}>
        <div className={isAdmin(session) ? "grid gap-5 lg:grid-cols-[1.6fr_1fr] items-start" : ""}>
          <DocList items={roomDocs} session={session} locale={locale} empty={no ? "Dokumentene legges inn av prosjektet. Du får beskjed når noe nytt er lagt ut." : "The documents are added by the project. You will hear when something new is added."} />
          {isAdmin(session) && <div className="panel p-5 md:p-6"><div className="font-medium mb-3">{no ? "Legg et dokument i datarommet" : "Add a document to the data room"}</div><UploadForm session={session} locale={locale} audience={["investor"]} category="finance" /></div>}
        </div>
      </Section>

      <Section title={no ? "Spørsmål og svar" : "Questions and answers"} sub={no ? "Spør prosjektet direkte. Svar som gjelder alle investorer, kan deles med hele datarommet." : "Ask the project directly. Answers that concern all investors can be shared with the whole data room."}>
        <Threads area="investor" items={qa} session={session} locale={locale} askTitle={no ? "Still et spørsmål" : "Ask a question"} askHint={no ? "Prosjekteier får beskjed og svarer her." : "The project owner is notified and answers here."} empty={no ? "Ingen spørsmål ennå." : "No questions yet."} />
      </Section>
    </>
  );
}
