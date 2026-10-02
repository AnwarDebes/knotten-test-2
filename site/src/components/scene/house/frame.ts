/**
 * Where a house stands: its own frame (u along the long side, v towards the view, z up from the main
 * floor) placed on its plot, mirrored on every other plot, and the fit of the house to the ground
 * (public/twin/houses.json, from pipeline/twin_houses.py).
 *
 * The builder works in three.js-style local axes: x = u, y = z (up), z = -v. A house-local point
 * (u, v, z) is therefore drawn at local (u, z, -v), and houseMatrix() takes that to the scene.
 */
import * as THREE from "three";
import type { Plot } from "@/lib/types";
import type { HouseFit } from "@/lib/house/plan";
import { TWIN_BASE } from "../twin/twinData";

export type HousesFile = { version: number; houses: HouseFit[] };

let cached: Promise<HousesFile | null> | null = null;
/**
 * The fit of each house to its plot; the promise is shared, so the file is fetched once. Without the
 * file every house is drawn on one floor (the scene never fails for want of it).
 */
export function loadHouses(): Promise<HousesFile | null> {
  if (!cached) cached = fetch(TWIN_BASE + "houses.json").then((r) => (r.ok ? r.json() : null)).catch(() => { cached = null; return null; });
  return cached;
}

/** The fit for a plot, or a plain house on one floor when the file has none. */
export function fitFor(file: HousesFile | null, p: Plot): HouseFit {
  const f = file?.houses.find((h) => h.id === p.id);
  return f ?? { id: p.id, mirror: false, lower: false, floor_z: p.local.z_floor, lower_z: null, patio_z: null };
}

/** House-local builder coordinates (u, height, -v) to the scene, for a plot (mirrored or not). */
export function houseMatrix(p: Plot, mirror: boolean, lift = 0) {
  const f = (p.house.facing_deg * Math.PI) / 180;
  const ca = Math.cos(f), sa = Math.sin(f);
  const s = mirror ? -1 : 1;
  // columns: local x (u), local y (up), local z (-v)
  return new THREE.Matrix4().set(
    ca * s, 0, -sa, p.local.x,
    0, 1, 0, p.local.z_floor + lift,
    sa * s, 0, ca, -p.local.y,
    0, 0, 0, 1,
  );
}

/** A house-local point (u, v, z above the main floor) in scene coordinates. */
export function toScene(p: Plot, mirror: boolean, u: number, v: number, z: number, out = new THREE.Vector3()) {
  return out.set(u, z, -v).applyMatrix4(houseMatrix(p, mirror));
}

/** A house-local point in the project's local metres (x east, y north). */
export function toLocal(p: Plot, mirror: boolean, u: number, v: number) {
  const f = (p.house.facing_deg * Math.PI) / 180;
  const ca = Math.cos(f), sa = Math.sin(f);
  const uu = mirror ? -u : u;
  return { x: p.local.x + uu * ca + v * sa, y: p.local.y - uu * sa + v * ca };
}

/** Scene coordinates to the house's own (u, v, z), the inverse of toScene. */
export function fromScene(p: Plot, mirror: boolean, x: number, y: number, z: number) {
  const f = (p.house.facing_deg * Math.PI) / 180;
  const ca = Math.cos(f), sa = Math.sin(f);
  const dx = x - p.local.x, dn = -z - p.local.y;   // east and north from the plot centre
  // local x = u*ca + v*sa, north = -u*sa + v*ca
  const u = dx * ca - dn * sa, v = dx * sa + dn * ca;
  return { u: mirror ? -u : u, v, z: y - p.local.z_floor };
}
