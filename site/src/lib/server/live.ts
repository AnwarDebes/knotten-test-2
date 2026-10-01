import { CONTACT, FACT } from "@/lib/facts";

/**
 * Live data from open services, fetched on the server and cached for a while:
 * - day-ahead power prices for price area NO2 (southern Norway, where Lindesnes is), from
 *   hvakosterstrommen.no, which republishes ENTSO-E's prices in NOK. Without VAT and grid tariff.
 * - the weather forecast for the property from MET Norway (Locationforecast 2.0), which asks
 *   every caller to say who it is in the User-Agent.
 * When a service does not answer, the pages say so and carry on with the model.
 */
const UA = `Knotten-prosjektportal/1.0 (+https://knotten.no; ${CONTACT.email})`;

export type Price = { start: string; end: string; nok: number };

/** Today's date in Norway, and the next, as YYYY-MM-DD. */
export function osloDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400e3).toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

export async function spotPrices(day: string): Promise<Price[] | null> {
  const [y, m, d] = day.split("-");
  try {
    const res = await fetch(`https://www.hvakosterstrommen.no/api/v1/prices/${y}/${m}-${d}_NO2.json`, { next: { revalidate: day === osloDate() ? 3600 : 900 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const rows = (await res.json()) as { NOK_per_kWh: number; time_start: string; time_end: string }[];
    return Array.isArray(rows) && rows.length ? rows.map((r) => ({ start: r.time_start, end: r.time_end, nok: r.NOK_per_kWh })) : null;
  } catch {
    return null;
  }
}

/** Prices per whole hour (the market moved to 15-minute prices in 2025; the average of each hour is used here). */
export function hourly(prices: Price[]): { hour: number; nok: number }[] {
  const by = new Map<number, number[]>();
  for (const p of prices) {
    const h = Number(p.start.slice(11, 13));
    by.set(h, [...(by.get(h) ?? []), p.nok]);
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([hour, v]) => ({ hour, nok: v.reduce((a, b) => a + b, 0) / v.length }));
}

export type WeatherHour = { time: string; temp: number; cloud: number; wind: number; symbol?: string; precip?: number };
export type Weather = { updated: string; hours: WeatherHour[] };

export async function weather(): Promise<Weather | null> {
  const lat = Number(FACT.lat).toFixed(4), lon = Number(FACT.lon).toFixed(4);
  try {
    const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, { headers: { "User-Agent": UA }, next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { properties: { meta: { updated_at: string }; timeseries: { time: string; data: { instant: { details: Record<string, number> }; next_1_hours?: { summary: { symbol_code: string }; details: { precipitation_amount?: number } } } }[] } };
    const hours = j.properties.timeseries.slice(0, 60).map((t) => ({
      time: t.time,
      temp: t.data.instant.details.air_temperature,
      cloud: t.data.instant.details.cloud_area_fraction,
      wind: t.data.instant.details.wind_speed,
      symbol: t.data.next_1_hours?.summary.symbol_code,
      precip: t.data.next_1_hours?.details.precipitation_amount,
    }));
    return { updated: j.properties.meta.updated_at, hours };
  } catch {
    return null;
  }
}

/** The hour of the forecast closest to now. */
export function current(w: Weather | null) {
  if (!w) return null;
  const t = Date.now();
  return w.hours.reduce((best, h) => (Math.abs(Date.parse(h.time) - t) < Math.abs(Date.parse(best.time) - t) ? h : best), w.hours[0]);
}

/** Share of clear-sky sunshine that gets through a cloud cover (Kasten and Czeplak, 1980). */
export const cloudFactor = (cloudPct: number) => 1 - 0.75 * Math.pow(Math.max(0, Math.min(100, cloudPct)) / 100, 3.4);

const SYMBOL_NO: Record<string, string> = { clearsky: "klarvær", fair: "lettskyet", partlycloudy: "delvis skyet", cloudy: "skyet", fog: "tåke", lightrain: "lett regn", rain: "regn", heavyrain: "kraftig regn", lightrainshowers: "lette regnbyger", rainshowers: "regnbyger", heavyrainshowers: "kraftige regnbyger", lightsleet: "lett sludd", sleet: "sludd", lightsnow: "lett snø", snow: "snø", heavysnow: "kraftig snø", rainandthunder: "regn og torden", sleetshowers: "sluddbyger", snowshowers: "snøbyger" };
const SYMBOL_EN: Record<string, string> = { clearsky: "clear sky", fair: "fair", partlycloudy: "partly cloudy", cloudy: "cloudy", fog: "fog", lightrain: "light rain", rain: "rain", heavyrain: "heavy rain", lightrainshowers: "light showers", rainshowers: "showers", heavyrainshowers: "heavy showers", lightsleet: "light sleet", sleet: "sleet", lightsnow: "light snow", snow: "snow", heavysnow: "heavy snow", rainandthunder: "rain and thunder", sleetshowers: "sleet showers", snowshowers: "snow showers" };
export function symbolText(code: string | undefined, no: boolean) {
  if (!code) return "";
  const base = code.replace(/_(day|night|polartwilight)$/, "");
  return (no ? SYMBOL_NO : SYMBOL_EN)[base] ?? base;
}

/** The moment a Norwegian wall-clock time happens: date YYYY-MM-DD, hour and minute in Oslo time. */
export function osloInstant(date: string, hour: number, minute = 30) {
  const [y, m, d] = date.split("-").map(Number);
  for (const off of [2, 1]) {
    const t = new Date(Date.UTC(y, m - 1, d, hour - off, minute));
    if (Number(t.toLocaleString("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", hour12: false })) % 24 === hour) return t;
  }
  return new Date(Date.UTC(y, m - 1, d, hour - 1, minute));
}

/** Hours and minutes since midnight in Oslo, as a decimal hour. */
export function osloHourNow() {
  const [h, m] = new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return (h % 24) + m / 60;
}

/** The clock, read in one place so pages stay free of direct clock calls. */
export const nowMs = () => Date.now();
