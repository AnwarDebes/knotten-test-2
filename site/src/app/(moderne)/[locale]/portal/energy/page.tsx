import Image from "next/image";
import Link from "next/link";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { loadPlots } from "@/lib/data";
import { frameFor, loadProfile, pvForPlot } from "@/lib/energy";
import { BUDGET, EED, PV_KWP_PER_HOME, fmt } from "@/lib/facts";
import { cloudFactor, current, hourly, nowMs, osloDate, osloHourNow, spotPrices, symbolText, weather } from "@/lib/server/live";
import DayChart from "@/components/charts/DayChart";
import NoAccess from "@/components/portal/NoAccess";
import { Bars, PriceSteps } from "@/components/portal/charts";
import { PageHead, Section, Stat, Waiting } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Energi", "Energy");

/**
 * The energy dashboard. Live today: the power price in NO2 and the weather at the property, with
 * the field's solar production estimated from the forecast cloud cover. From the energy budget:
 * the year in balance and the borehole field. Measured values from the homes take the model's
 * place when the meters exist; until then this page says so.
 */
export default async function EnergyDashboard({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ month?: string }> }) {
  const { locale, no, session, ok, base } = await portalPage(params, "/energy", "energy");
  if (!ok) return <NoAccess locale={locale} session={session} area="energy" />;
  const { month: m } = await searchParams;
  const lang = no ? "no" : "en";
  const nb = (v: number) => fmt(Math.round(v), lang);
  const dec = (v: number, d = 2) => v.toFixed(d).replace(".", no ? "," : ".");

  const [{ plots }, today, tomorrow, w] = await Promise.all([loadPlots(), spotPrices(osloDate()), spotPrices(osloDate(1)), weather()]);
  const hNow = osloHourNow();
  const todayH = today ? hourly(today) : null;
  const tomorrowH = tomorrow ? hourly(tomorrow) : null;
  const priceNow = todayH?.find((p) => p.hour === Math.floor(hNow))?.nok;
  const cheapest = todayH ? todayH.reduce((a, b) => (b.nok < a.nok ? b : a)) : null;
  const dearest = todayH ? todayH.reduce((a, b) => (b.nok > a.nok ? b : a)) : null;
  const wx = current(w);
  const monthNow = Number(osloDate().slice(5, 7));
  const fieldPv = (d: Date, cloud: number) => plots.reduce((a, p) => a + (pvForPlot(p, d) / 0.75) * cloudFactor(cloud), 0);
  const pvNow = wx ? fieldPv(new Date(nowMs()), wx.cloud) : null;
  const loadNow = plots.length * loadProfile(hNow, monthNow);
  const forecast = (w?.hours ?? []).filter((h) => Date.parse(h.time) >= nowMs() - 3600e3).slice(0, 36).map((h) => {
    const d = new Date(h.time);
    const label = d.toLocaleTimeString(no ? "nb-NO" : "en-GB", { timeZone: "Europe/Oslo", hour: "2-digit" });
    return { label, value: fieldPv(d, h.cloud), title: `${d.toLocaleString(no ? "nb-NO" : "en-GB", { timeZone: "Europe/Oslo", weekday: "short", hour: "2-digit", minute: "2-digit" })}: ${nb(fieldPv(d, h.cloud))} kW, ${Math.round(h.cloud)} % ${no ? "skydekke" : "cloud"}, ${dec(h.temp, 1)} °C` };
  });
  const forecastKwh = forecast.slice(0, 24).reduce((a, b) => a + b.value, 0);

  const month = Math.min(12, Math.max(1, +(m ?? monthNow)));
  const hours = Array.from({ length: 24 }, (_, h) => frameFor(plots, month, 21, h + 0.5));
  const pvDay = hours.reduce((a, f) => a + f.field.pv_kw, 0);
  const loadDay = hours.reduce((a, f) => a + f.field.load_kw, 0);
  const importDay = hours.reduce((a, f) => a + f.field.import_kw, 0);
  const produced = BUDGET.pv.annual_kwh + BUDGET.wind.annual_kwh;
  const elDemand = BUDGET.homes * BUDGET.el_per_home_kwh + BUDGET.office_kwh + BUDGET.storage_kwh;
  const heatDemand = BUDGET.homes * BUDGET.heat_per_home_kwh;
  const bars: [string, number, string][] = [
    [no ? "Strømbehov" : "Power demand", elDemand, "var(--fjord)"],
    [no ? "Strøm til varmepumpen" : "Power to the heat pump", BUDGET.heat_pump_el_kwh, "#6c8ea5"],
    [no ? "Sol og vind" : "Solar and wind", produced, "var(--amber)"],
    [no ? "Varmebehov" : "Heat demand", heatDemand, "#7b8794"],
    [no ? "Levert bergvarme" : "Bedrock heat delivered", BUDGET.bedrock.delivered_kwh, "var(--pine)"],
  ];
  const max = Math.max(...bars.map((b) => b[1]));
  const months = no ? ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <>
      <PageHead
        eyebrow={no ? "Energi" : "Energy"}
        title={no ? "Energidashbord" : "Energy dashboard"}
        lede={no ? "Strømprisen og været er ekte og oppdateres løpende. Produksjon og forbruk er modellens tall for feltet med 30 boliger, til målerne er på plass." : "The power price and the weather are real and update continuously. Production and use are the model's figures for the field of 30 homes, until the meters are in place."}
        actions={<><span className="chip chip-pine">{no ? "Pris og vær: direkte" : "Price and weather: live"}</span><span className="chip chip-amber">{no ? "Målere: ikke tilkoblet" : "Meters: not connected"}</span></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={no ? "Strømpris nå, NO2" : "Power price now, NO2"} value={priceNow !== undefined ? `${dec(priceNow)} kr` : "…"} sub={cheapest && dearest ? (no ? `per kWh. I dag ${dec(cheapest.nok)} til ${dec(dearest.nok)} kr` : `per kWh. Today ${dec(cheapest.nok)} to ${dec(dearest.nok)} kr`) : (no ? "Prisene svarer ikke akkurat nå" : "Prices unavailable right now")} />
        <Stat label={no ? "Været på Knotten" : "Weather at Knotten"} value={wx ? `${dec(wx.temp, 1)} °C` : "…"} sub={wx ? `${symbolText(wx.symbol, no)}, ${Math.round(wx.cloud)} % ${no ? "skydekke" : "cloud"}, ${dec(wx.wind, 1)} m/s` : (no ? "Værvarselet svarer ikke akkurat nå" : "The forecast is unavailable right now")} />
        <Stat label={no ? "Sol nå, hele feltet" : "Solar now, whole field"} value={pvNow !== null ? `${nb(pvNow)} kW` : "…"} sub={no ? `modell med dagens skydekke, ${PV_KWP_PER_HOME} kWp per bolig` : `model with today's cloud cover, ${PV_KWP_PER_HOME} kWp per home`} />
        <Stat label={no ? "Forbruk nå, hele feltet" : "Use now, whole field"} value={`${nb(loadNow)} kW`} sub={no ? "modellens lastprofil for årstiden" : "the model's load profile for the season"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={no ? "Strømprisen i dag" : "The power price today"} sub={no ? `Spotpris i NO2 per kWh, uten mva og nettleie.${tomorrowH ? " Morgendagens priser er publisert (skyggelagt)." : " Morgendagens priser kommer rundt klokka 13."}` : `Spot price in NO2 per kWh, without VAT and grid tariff.${tomorrowH ? " Tomorrow's prices are published (shaded)." : " Tomorrow's prices arrive around 13:00."}`}>
          <div className="panel p-4 md:p-5">
            {todayH ? <PriceSteps today={todayH} tomorrow={tomorrowH} nowHour={hNow} no={no} /> : <p className="text-[14.5px] text-muted p-2">{no ? "Prisene kunne ikke hentes akkurat nå. Siden prøver igjen ved neste besøk." : "The prices could not be fetched right now. The page tries again on the next visit."}</p>}
            <div className="provenance mt-2 flex flex-wrap gap-x-4">
              {cheapest && <span><span className="inline-block w-2 h-2 rounded-full bg-pine mr-1.5" />{no ? "billigst" : "cheapest"} {String(cheapest.hour).padStart(2, "0")}:00</span>}
              {dearest && <span><span className="inline-block w-2 h-2 rounded-full bg-amber mr-1.5" />{no ? "dyrest" : "dearest"} {String(dearest.hour).padStart(2, "0")}:00</span>}
              <span>{no ? "Kilde: hvakosterstrommen.no (ENTSO-E)" : "Source: hvakosterstrommen.no (ENTSO-E)"}</span>
            </div>
          </div>
        </Section>
        <Section title={no ? "Sol neste døgn" : "Solar over the next day"} sub={no ? `Feltets solproduksjon time for time fra MET-varselets skydekke. Om lag ${nb(forecastKwh)} kWh de neste 24 timene.` : `The field's solar production hour by hour from MET's forecast cloud cover. About ${nb(forecastKwh)} kWh over the next 24 hours.`}>
          <div className="panel p-4 md:p-5">
            {forecast.length ? <Bars data={forecast.map((f) => ({ ...f, tone: "amber" as const }))} unit="kW" every={4} ariaLabel={no ? "Solproduksjon neste døgn" : "Solar production next day"} /> : <p className="text-[14.5px] text-muted p-2">{no ? "Værvarselet kunne ikke hentes akkurat nå." : "The forecast could not be fetched right now."}</p>}
            <div className="provenance mt-2">{no ? "Kilde: Meteorologisk institutt (Locationforecast), beregnet horisont per tomt. Modell, ikke måling." : "Source: Norwegian Meteorological Institute (Locationforecast), computed horizon per plot. Model, not measurement."}</div>
          </div>
        </Section>
      </div>

      <Waiting no={no} title={no ? "Målte verdier fra boligene og anleggene" : "Measured values from the homes and plants"} needs={no ? ["En HAN-leser på hver strømmåler (under 1 000 kr, ingen elektriker), eller måledata fra Elhub", "Produksjonsmåler på solcelleanleggene og loggføring fra batteri og varmepumpe", "Energikontrakten fra energisporet: hvilke verdier, hvor ofte og i hvilket format", "Samtykke fra hver beboer (lagres under Mitt hjem)"] : ["A HAN reader on each power meter (under 1,000 kr, no electrician), or meter data from Elhub", "Production meters on the solar plants and logging from battery and heat pump", "The energy contract from the energy track: which values, how often, in what format", "Consent from each resident (saved under My home)"]}>
        {no ? "Dashbordet er bygget for målte verdier i samme format som modellen bruker. Når målerne kobles til, bytter tallene over uten at siden må lages på nytt. For byggene som står i dag kan historikk lastes inn allerede nå: " : "The dashboard is built for measured values in the same format the model uses. When the meters are connected, the figures switch over without rebuilding the page. For the buildings standing today, history can be loaded already: "}
        <Link href={`${base}/energy/eksisterende`}>{no ? "eksisterende bygg" : "existing buildings"}</Link>.
      </Waiting>

      <Section title={no ? "Året i balanse" : "The year in balance"} sub={no ? `Behov mot lokal produksjon i energiregnskapet. Bergvarmen dekker det meste av varmebehovet med ${nb(BUDGET.heat_pump_el_kwh)} kWh strøm til varmepumpen (årsvarmefaktor ${fmt(BUDGET.bedrock.scop, lang)}). Solstrømmen bør nedjusteres rundt 30 % før tallet brukes videre.` : `Demand against local production in the energy budget. Bedrock heat covers most of the heat demand with ${nb(BUDGET.heat_pump_el_kwh)} kWh of power to the heat pump (seasonal factor ${fmt(BUDGET.bedrock.scop, "en")}). The solar figure should come down about 30 % before it is used further.`}>
        <div className="panel p-5 md:p-6 grid gap-3">
          {bars.map(([label, v, color]) => (
            <div key={label} className="grid grid-cols-[minmax(120px,190px)_1fr_auto] items-center gap-3 text-[14px]">
              <span>{label}</span>
              <div className="h-[12px] rounded-full bg-bone/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} /></div>
              <span className="num text-[16px]">{nb(v)} kWh</span>
            </div>
          ))}
          <div className="provenance">{no ? "Energiregnskapet, energisporet. Foreløpig." : "The energy budget, energy track. Provisional."}</div>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Section title={no ? "Brønnparken" : "The borehole field"}>
          <div className="panel p-5 md:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[[String(EED.boreholes), no ? "brønner" : "boreholes"], [`${fmt(EED.depth_m, lang)} m`, no ? "dybde" : "depth"], [`${EED.spacing_m} m`, no ? "avstand" : "spacing"], [`${EED.base_heat_mwh} MWh`, no ? "varme per år" : "heat per year"], [`${EED.dhw_mwh} MWh`, no ? "tappevann per år" : "hot water per year"], [`${fmt(EED.fluid_min_c, lang)} °C`, no ? `laveste væsketemperatur, år ${EED.years}` : `lowest fluid temperature, year ${EED.years}`]].map(([v, l2]) => (
                <div key={l2}><div className="num text-[24px]">{v}</div><div className="text-[13px] text-muted">{l2}</div></div>
              ))}
            </div>
            <div className="provenance mt-4">{no ? `Earth Energy Designer, månedlig simulering over ${EED.years} år. Energisporet.` : `Earth Energy Designer, monthly simulation over ${EED.years} years. The energy track.`}</div>
          </div>
        </Section>
        <figure className="panel p-3 self-end">
          <Image src="/assets/energy/eed_fluid_temperatures.webp" alt={no ? "Væsketemperaturer i brønnparken over 35 år" : "Fluid temperatures in the borehole field over 35 years"} width={1600} height={886} sizes="(min-width: 1024px) 40vw, 100vw" className="w-full h-auto rounded-[10px]" />
        </figure>
      </div>

      <Section
        title={no ? "En typisk dag, time for time" : "A typical day, hour by hour"}
        sub={no ? `Den 21. i valgt måned, hele feltet: ${nb(pvDay)} kWh produksjon, ${nb(loadDay)} kWh forbruk, ${nb(importDay)} kWh fra nettet.` : `The 21st of the chosen month, the whole field: ${nb(pvDay)} kWh produced, ${nb(loadDay)} kWh used, ${nb(importDay)} kWh from the grid.`}
        actions={<div className="flex flex-wrap gap-1">{months.map((name, i) => <Link key={name} href={`?month=${i + 1}`} scroll={false} className={`chip no-underline ${i + 1 === month ? "chip-amber" : ""}`}>{name}</Link>)}</div>}
      >
        <div className="panel p-4 md:p-5">
          <DayChart frames={hours.map((f) => ({ pv: f.field.pv_kw, load: f.field.load_kw, soc: f.field.soc }))} locale={locale} />
          <div className="provenance mt-3">{no ? `Modell: om lag ${PV_KWP_PER_HOME} kWp og ${BUDGET.battery.per_home_kwh} kWh batteri per bolig fra energiregnskapet, beregnet horisont per tomt, lastprofil per årstid.` : `Model: about ${PV_KWP_PER_HOME} kWp and a ${BUDGET.battery.per_home_kwh} kWh battery per home from the energy budget, computed horizon per plot, seasonal load profile.`}</div>
        </div>
      </Section>
    </>
  );
}
