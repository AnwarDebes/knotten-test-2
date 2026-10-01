import { pageTitle, portalPage } from "@/lib/server/portal";
import { loadPlots } from "@/lib/data";
import { loadProfile, pvForPlot } from "@/lib/energy";
import { BUDGET } from "@/lib/facts";
import { cloudFactor, hourly, osloDate, osloInstant, spotPrices, weather } from "@/lib/server/live";
import NoAccess from "@/components/portal/NoAccess";
import Optimizer, { type OptDay } from "@/components/portal/Optimizer";
import { PageHead, Section, Waiting } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Smart styring", "Smart control");

/**
 * Smart control on real data: today's and (after about 13:00) tomorrow's power prices in NO2 and
 * MET's forecast for the property. The planner itself runs in the browser (Optimizer.tsx), so
 * the owner can try other battery sizes and habits and see the effect at once.
 */
export default async function SmartControl({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/energy/optimering", "energy");
  if (!ok) return <NoAccess locale={locale} session={session} area="energy" />;
  const [{ plots }, w] = await Promise.all([loadPlots(), weather()]);
  const dates = [osloDate(), osloDate(1)];
  const prices = await Promise.all(dates.map((d) => spotPrices(d)));
  const cloudAt = new Map((w?.hours ?? []).map((h) => [h.time.slice(0, 13), h.cloud]));

  const days: OptDay[] = [];
  dates.forEach((date, i) => {
    const p = prices[i];
    if (!p) return;
    const hours = hourly(p);
    if (hours.length < 23) return;
    const byHour = new Map(hours.map((x) => [x.hour, x.nok]));
    const month = Number(date.slice(5, 7));
    const live: boolean[] = [];
    const instants = Array.from({ length: 24 }, (_, h) => osloInstant(date, h));
    for (const t of instants) live.push(cloudAt.has(new Date(Math.floor(t.getTime() / 3600e3) * 3600e3).toISOString().slice(0, 13)));
    const pv: Record<string, number[]> = {};
    for (const plot of plots) {
      pv[plot.id] = instants.map((t) => {
        const cloud = cloudAt.get(new Date(Math.floor(t.getTime() / 3600e3) * 3600e3).toISOString().slice(0, 13));
        const clear = pvForPlot(plot, t);
        return +(cloud === undefined ? clear : (clear / 0.75) * cloudFactor(cloud)).toFixed(2);
      });
    }
    days.push({
      key: date,
      label: i === 0 ? (no ? "I dag" : "Today") : (no ? "I morgen" : "Tomorrow"),
      prices: Array.from({ length: 24 }, (_, h) => byHour.get(h) ?? byHour.get(h - 1) ?? hours[0].nok),
      live,
      pv,
      load: Array.from({ length: 24 }, (_, h) => +loadProfile(h + 0.5, month).toFixed(2)),
    });
  });

  const options = plots.map((p) => ({ id: p.id, label: `${no ? "Tomt" : "Plot"} ${Number(p.id.slice(5))}${p.row_label ? `, ${no ? "rekke" : "row"} ${p.row_label}` : ""}` }));
  const defaultPlot = session.plot && plots.some((p) => p.id === session.plot) ? session.plot : plots[Math.floor(plots.length / 2)]?.id ?? plots[0].id;

  return (
    <>
      <PageHead
        eyebrow={no ? "Energi" : "Energy"}
        title={no ? "Smart styring" : "Smart control"}
        lede={no ? "Hvordan en bolig på Knotten kan bruke strøm når den er billig: planen for batteri, varmtvann og elbil, regnet på dagens faktiske strømpriser i NO2 og værvarselet for tomta. Prøv andre batteristørrelser og vaner; resultatet regnes om med en gang." : "How a home at Knotten can use power when it is cheap: the plan for battery, hot water and electric car, computed on today's actual NO2 power prices and the forecast for the plot. Try other battery sizes and habits; the result is recomputed at once."}
      />
      {days.length ? (
        <Optimizer days={days} plots={options} defaultPlot={defaultPlot} gridFee={BUDGET.prices.grid_nok} no={no} />
      ) : (
        <Waiting no={no} title={no ? "Strømprisene svarer ikke akkurat nå" : "The power prices are unavailable right now"}>{no ? "Planen trenger dagens priser. Siden prøver igjen ved neste besøk." : "The plan needs today's prices. The page tries again on the next visit."}</Waiting>
      )}
      <Section title={no ? "Slik virker det" : "How it works"}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel p-5 text-[14.5px] text-ink-2"><div className="font-medium text-ink mb-1.5">{no ? "1. Varsel" : "1. Forecast"}</div>{no ? "Strømprisene for døgnet publiseres dagen før. Solproduksjonen regnes fra solens gang, horisonten fra hver tomt og skydekket i MET-varselet. Forbruket er modellens lastprofil for årstiden." : "The day's power prices are published the day before. Solar production comes from the sun's path, the horizon from each plot and the cloud cover in MET's forecast. Use is the model's load profile for the season."}</div>
          <div className="panel p-5 text-[14.5px] text-ink-2"><div className="font-medium text-ink mb-1.5">{no ? "2. Optimering" : "2. Optimisation"}</div>{no ? "Batteriplanen løses eksakt: den billigste veien gjennom batteriets ladetilstand time for time, uten å tømme batteriet mot slutten av døgnet. Varmtvann og billading legges i de billigste timene de har lov til å gå." : "The battery plan is solved exactly: the cheapest path through the battery's state of charge hour by hour, without emptying the battery by the end of the day. Hot water and car charging go in the cheapest hours they may run."}</div>
          <div className="panel p-5 text-[14.5px] text-ink-2"><div className="font-medium text-ink mb-1.5">{no ? "3. Læring, neste steg" : "3. Learning, the next step"}</div>{no ? "Når målerne er på plass, lærer systemet hver boligs faktiske forbruk og hvordan huset holder på varmen (maskinlæring), og planen styrer utstyret direkte med beboerens samtykke og mulighet til å overstyre." : "When the meters are in place, the system learns each home's actual use and how the house keeps its heat (machine learning), and the plan controls the equipment directly with the resident's consent and the option to override."}</div>
        </div>
      </Section>
      <Waiting no={no} title={no ? "Styring av utstyret i boligene" : "Control of the equipment in the homes"} needs={no ? ["Målerdata fra boligene for å lære forbruket (se Energi)", "Tilkobling til batteri, varmepumpe og lader (se Smarthus)", "Beboerens samtykke til styring, med overstyring (under Mitt hjem)"] : ["Meter data from the homes to learn the use (see Energy)", "Connection to battery, heat pump and charger (see Smart home)", "The resident's consent to control, with override (under My home)"]}>
        {no ? "I dag viser siden planen. Å utføre den krever utstyr som ennå ikke finnes på feltet." : "Today the page shows the plan. Carrying it out needs equipment that does not exist on the field yet."}
      </Waiting>
    </>
  );
}
