/**
 * Coordinates for the municipality's maps. The site's data is in local metres around the
 * reference point (x east, y north); Norwegian planning uses UTM zone 32N on ETRS89
 * (EPSG:25832). The projection is the standard transverse Mercator series (Krüger, to n^3),
 * good to well under a millimetre here; GRS80 and WGS84 differ by less than that at this scale.
 */
const ORIGIN = { lat: 58.068057, lon: 7.278401 };

/** Local metres to latitude and longitude, as the data files define it (parcels.json, crs). */
export function localToLatLon(x: number, y: number): [number, number] {
  return [ORIGIN.lat + y / 111132, ORIGIN.lon + x / 58927.4];
}

const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, lon0 = 9, FE = 500000;
const n = f / (2 - f);
const A = (a / (1 + n)) * (1 + (n * n) / 4 + (n ** 4) / 64);
const alpha = [n / 2 - (2 / 3) * n * n + (5 / 16) * n ** 3, (13 / 48) * n * n - (3 / 5) * n ** 3, (61 / 240) * n ** 3];
const rad = Math.PI / 180;

/** Latitude and longitude to UTM 32N easting and northing in metres. */
export function toUtm32(lat: number, lon: number): [number, number] {
  const phi = lat * rad, lam = (lon - lon0) * rad;
  const c = (2 * Math.sqrt(n)) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - c * Math.atanh(c * Math.sin(phi)));
  const xi = Math.atan(t / Math.cos(lam));
  const eta = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let E = eta, N = xi;
  for (let j = 1; j <= 3; j++) {
    E += alpha[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    N += alpha[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
  }
  return [+(FE + k0 * A * E).toFixed(2), +(k0 * A * N).toFixed(2)];
}

/** Local metres straight to EPSG:25832, or to longitude and latitude (EPSG:4326, GeoJSON's default). */
export function project(x: number, y: number, crs: "25832" | "4326"): [number, number] {
  const [lat, lon] = localToLatLon(x, y);
  return crs === "25832" ? toUtm32(lat, lon) : [+lon.toFixed(7), +lat.toFixed(7)];
}
