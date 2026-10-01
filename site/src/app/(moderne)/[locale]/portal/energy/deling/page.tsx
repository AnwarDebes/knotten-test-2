import { pageTitle, portalPage } from "@/lib/server/portal";
import { loadPlots } from "@/lib/data";
import { homeLoad, pvForPlot } from "@/lib/energy";
import { knottenTime } from "@/lib/solar";
import { BUDGET, PV_KWP_PER_HOME, measure } from "@/lib/facts";
import NoAccess from "@/components/portal/NoAccess";
import SharingSim from "@/components/portal/SharingSim";
import { PageHead, Section } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Energideling", "Energy sharing");

/**
 * Community energy sharing: what the field gains when the homes share surplus solar power with
 * each other and with a shared battery, before selling to the grid. Computed from the model's
 * typical days per plot (sun path and horizon per roof), so it can run before anything is built.
 */
export default async function Sharing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/energy/deling", "energy");
  if (!ok) return <NoAccess locale={locale} session={session} area="energy" />;
  const { plots } = await loadPlots();
  const pv = Array.from({ length: 12 }, (_, m) => plots.map((p) => Array.from({ length: 24 }, (_, h) => +pvForPlot(p, knottenTime(2026, m + 1, 21, h + 0.5)).toFixed(2))));
  const load = Array.from({ length: 12 }, (_, m) => plots.map((_, i) => Array.from({ length: 24 }, (_, h) => +homeLoad(h + 0.5, m + 1, i).toFixed(2))));
  // the office building on the property: daytime use, scaled to the energy budget's working assumption for a year
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const officeRaw = (h: number, m: number) => { const winter = m <= 2 || m >= 11 ? 1 : m <= 4 || m >= 9 ? 0.6 : 0.25; return 0.8 + 1.4 * winter + (h >= 7 && h < 17 ? (5 / 7) * 4 * Math.sin(((h - 7 + 0.5) / 10) * Math.PI) : 0); };
  const officeYear = DAYS.reduce((a, d, m) => a + d * Array.from({ length: 24 }, (_, h) => officeRaw(h, m + 1)).reduce((x, y) => x + y, 0), 0);
  const office = Array.from({ length: 12 }, (_, m) => Array.from({ length: 24 }, (_, h) => +((officeRaw(h, m + 1) * BUDGET.office_kwh) / officeYear).toFixed(2)));
  const micro = measure("microgrid");
  return (
    <>
      <PageHead
        eyebrow={no ? "Energi" : "Energy"}
        title={no ? "Energideling" : "Energy sharing"}
        lede={no ? "Når én bolig har mer sol enn den trenger og naboen mangler, kan strømmen gå til naboen i stedet for ut på nettet. Simuleringen viser hva det betyr for feltet med 30 boliger, med og uten felles batteri og fellesanlegg for sol." : "When one home has more sun than it needs and the neighbour lacks power, the power can go to the neighbour instead of out to the grid. The simulation shows what that means for the field of 30 homes, with and without a shared battery and shared solar plant."}
      />
      <SharingSim pv={pv} load={load} office={office} officeKwh={BUDGET.office_kwh} plotLabels={plots.map((p) => p.id)} kwpPerHome={PV_KWP_PER_HOME} buy={BUDGET.prices.buy_nok} sell={BUDGET.prices.sell_nok} no={no} />
      <Section title={no ? "Forutsetninger" : "Assumptions"}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="panel p-5 text-[14.5px] text-ink-2 grid gap-2">
            <p>{no ? `Hver bolig har om lag ${PV_KWP_PER_HOME} kWp sol med beregnet horisont for sin tomt. Forbruket følger modellens lastprofil for årstiden, men varierer mellom boligene slik husholdninger gjør: morgen- og kveldstoppen kommer tidligere eller senere, noen bruker mer og noen mindre, og noen er hjemme på dagtid. Uten slik variasjon har alle boligene overskudd og underskudd samtidig, og det blir lite å dele. Hjemmebatteriene lader og leverer inntil 5 kW. Kjøp regnes til ${BUDGET.prices.buy_nok.toString().replace(".", ",")} kr og salg til ${BUDGET.prices.sell_nok.toString().replace(".", ",")} kr per kWh, som i energiregnskapet.` : `Each home has about ${PV_KWP_PER_HOME} kWp of solar with the computed horizon for its plot. Use follows the model's load profile for the season but varies between homes the way households do: morning and evening peaks come earlier or later, some use more and some less, and some are home in the daytime. Without such variety all the homes have surplus and deficit at the same time, and there is little to share. Home batteries charge and deliver up to 5 kW. Buying is counted at ${BUDGET.prices.buy_nok} kr and selling at ${BUDGET.prices.sell_nok} kr per kWh, as in the energy budget.`}</p>
            <p>{no ? `Kontorbygget bruker strøm på dagtid, når boligene har overskudd. Det regnes med energiregnskapets arbeidsforutsetning på ${BUDGET.office_kwh.toLocaleString("nb-NO")} kWh i året, fordelt som en gjennomsnittsdag med arbeidstid fra 7 til 17, til målt forbruk finnes.` : `The office building uses power in the daytime, when the homes have surplus. It is counted with the energy budget's working assumption of ${BUDGET.office_kwh.toLocaleString("en-GB")} kWh a year, spread as an average day with working hours from 7 to 17, until measured use exists.`}</p>
            <p>{no ? "Årsanslaget bygger på tolv typiske dager, den 21. i hver måned, med modellens gjennomsnittlige skydekke. Varmen fra bergvarmen er ikke med; dette gjelder strømmen." : "The yearly estimate builds on twelve typical days, the 21st of each month, with the model's average cloudiness. Heat from the bedrock is not included; this is about power."}</p>
          </div>
          <div className="panel p-5 text-[14.5px] text-ink-2 grid gap-2">
            <div className="font-medium text-ink">{no ? "Regelverket" : "The regulations"}</div>
            <p>{micro.why[locale]}</p>
            <p className="provenance">{no ? "Fra energisporets tiltaksvurdering og prosjekteiers retning 4. september 2026." : "From the energy track's measures comparison and the project owner's direction of 4 September 2026."}</p>
          </div>
        </div>
      </Section>
    </>
  );
}
