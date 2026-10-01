import { promises as fs } from "fs";
import path from "path";
import { can, getSession, isAdmin } from "@/lib/auth";
import { loadPlots } from "@/lib/data";
import { project } from "@/lib/geo";
import { recordEvent } from "@/lib/server/stats";

type XY = [number, number];
const read = async <T,>(name: string) => JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "data", name), "utf-8")) as T;

/**
 * The regulation basis as GeoJSON for the municipality's map tools: the properties from the land
 * register, the 30 house footprints of the provisional layout, the road and footpath, and the
 * clearing. EPSG:25832 by default (UTM 32N, what Norwegian planning uses), or ?crs=4326.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !(isAdmin(session) || can(session, "municipality") || can(session, "project") || can(session, "research"))) {
    return new Response("Logg inn med tilgang til kommunerommet.", { status: 401 });
  }
  const crs = new URL(req.url).searchParams.get("crs") === "4326" ? "4326" : "25832";
  const P = (p: XY) => project(p[0], p[1], crs);
  const ring = (pts: XY[]) => { const r = pts.map(P); const [a, b] = [r[0], r[r.length - 1]]; return a[0] === b[0] && a[1] === b[1] ? r : [...r, r[0]]; };

  const [{ plots }, parcels, road, clearing] = await Promise.all([
    loadPlots(),
    read<{ source: string; parcels: { gnr: number; bnr: number; area_matrikkel_m2: number; ring: XY[] }[] }>("parcels.json"),
    read<{ rows: { id: string; level: number; length_m: number; mean_grade_pct: number; share_over_6pct: number; pts: XY[] }[]; ramps: { id: string; length_m: number; climb_m: number; length_needed_at_6pct_m: number; pts: XY[] }[]; paths: { id: string; length_m: number; note?: string; pts: XY[] }[] }>("road.json"),
    read<{ polygon_local: XY[]; note: string }>("clearing.json"),
  ]);

  const features: object[] = [];
  for (const p of parcels.parcels) {
    features.push({ type: "Feature", properties: { lag: "eiendom", gnr: p.gnr, bnr: p.bnr, areal_m2: p.area_matrikkel_m2, kilde: "Kartverket, Matrikkelen" }, geometry: { type: "Polygon", coordinates: [ring(p.ring)] } });
  }
  for (const p of plots) {
    const f = (p.house.facing_deg * Math.PI) / 180;
    const u: XY = [Math.sin(f), Math.cos(f)], v: XY = [Math.cos(f), -Math.sin(f)];
    const hd = p.house.depth_m / 2, hw = p.house.width_m / 2, c: XY = [p.local.x, p.local.y];
    const corner = (a: number, b: number): XY => [c[0] + u[0] * a * hd + v[0] * b * hw, c[1] + u[1] * a * hd + v[1] * b * hw];
    features.push({
      type: "Feature",
      properties: {
        lag: "bolig (foreløpig utlegg v6)", tomt: Number(p.id.slice(5)), rekke: p.row_label ?? p.row, terreng_moh: p.local.z_ground, gulv_moh: p.local.z_floor,
        bredde_m: p.house.width_m, dybde_m: p.house.depth_m, mone_m: p.house.ridge_m, fasade_mot_grader: p.house.facing_deg, etasjer: p.house.storeys ?? 1,
        sol_21des_timer: p.sun.dec21.hours, sol_21jun_timer: p.sun.jun21.hours, sjoutsikt_grader: p.view.water_visible_deg, apent_hav: p.view.open_sea_visible, status: "foreløpig, modellens forslag",
      },
      geometry: { type: "Polygon", coordinates: [ring([corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)])] },
    });
  }
  for (const r of road.rows) features.push({ type: "Feature", properties: { lag: "vei", id: r.id, niva_moh: r.level, lengde_m: r.length_m, snittstigning_pst: r.mean_grade_pct, andel_over_6pst: r.share_over_6pct, status: "tegnet på dagens terreng" }, geometry: { type: "LineString", coordinates: r.pts.map(P) } });
  for (const r of road.ramps) features.push({ type: "Feature", properties: { lag: "vei, sving eller adkomst", id: r.id, lengde_m: r.length_m, stigning_m: r.climb_m, lengde_ved_6pst_m: r.length_needed_at_6pct_m, status: "plassholder til reguleringsplanen" }, geometry: { type: "LineString", coordinates: r.pts.map(P) } });
  for (const r of road.paths) features.push({ type: "Feature", properties: { lag: "gangsti", id: r.id, lengde_m: r.length_m }, geometry: { type: "LineString", coordinates: r.pts.map(P) } });
  features.push({ type: "Feature", properties: { lag: "ryddeområde (referanse)", merknad: clearing.note }, geometry: { type: "Polygon", coordinates: [ring(clearing.polygon_local)] } });

  const body = {
    type: "FeatureCollection",
    name: `Knotten, foreløpig utlegg v6, EPSG:${crs}`,
    ...(crs === "25832" ? { crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::25832" } } } : {}),
    metadata: { prosjekt: "Knotten, gnr 355 bnr 10 og 368, Lindesnes kommune", generert: new Date().toISOString(), kilder: "Kartverket (DTM 1 m, Matrikkelen), nettsidens modell", merknad: "Utlegget er et beregnet forslag, ikke en vedtatt plan." },
    features,
  };
  await recordEvent("geo_download");
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/geo+json; charset=utf-8", "Content-Disposition": `attachment; filename="knotten-utlegg-v6-EPSG${crs}.geojson"`, "Cache-Control": "private, no-store" },
  });
}
