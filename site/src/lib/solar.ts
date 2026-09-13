/** NOAA solar position, the same routine the pipeline used, so shadows match plots.json. */
export const SITE = { lat: 58.068057, lon: 7.278401 };

export function solarPosition(date: Date, lat = SITE.lat, lon = SITE.lon) {
  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const hourUtc = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let year = y, month = mo;
  if (month <= 2) { year -= 1; month += 12; }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + d + b - 1524.5 + hourUtc / 24;
  const t = (jd - 2451545.0) / 36525.0;
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const Mr = (M * Math.PI) / 180;
  const C = Math.sin(Mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * Mr) * (0.019993 - 0.000101 * t) + Math.sin(3 * Mr) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lam = ((L0 + C - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180)) * Math.PI) / 180;
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = ((eps0 + 0.00256 * Math.cos((omega * Math.PI) / 180)) * Math.PI) / 180;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lam));
  const yy = Math.tan(eps / 2) ** 2;
  const L0r = (L0 * Math.PI) / 180;
  const eot = (4 * 180 / Math.PI) * (yy * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * yy * Math.sin(Mr) * Math.cos(2 * L0r) - 0.5 * yy * yy * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
  const tst = (((hourUtc * 60 + eot + 4 * lon) % 1440) + 1440) % 1440;
  const ha = ((tst / 4 - 180) * Math.PI) / 180;
  const latr = (lat * Math.PI) / 180;
  const zen = Math.acos(Math.sin(latr) * Math.sin(decl) + Math.cos(latr) * Math.cos(decl) * Math.cos(ha));
  let az = (Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(latr) - Math.tan(decl) * Math.cos(latr)) * 180) / Math.PI;
  az = (az + 180 + 360) % 360;
  const elevation = 90 - (zen * 180) / Math.PI;
  return { elevation, azimuth: az };
}

/** Direction *to* the sun in three.js space (x east, y up, z = -north). */
export function sunVector(date: Date) {
  const { elevation, azimuth } = solarPosition(date);
  const el = (Math.max(elevation, -8) * Math.PI) / 180;
  const az = (azimuth * Math.PI) / 180;
  return { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: -Math.cos(el) * Math.cos(az), elevation, azimuth };
}

/** Build a UTC date from a CET/CEST wall-clock time at Knotten. */
export function knottenTime(year: number, month: number, day: number, hourLocal: number) {
  const summer = month >= 4 && month <= 10; // close enough for the dial; DST edges do not matter here
  const offset = summer ? 2 : 1;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + (hourLocal - offset) * 3600 * 1000);
}

export const DEFAULT_DATE = { month: 12, day: 21, hour: 12.0 };
