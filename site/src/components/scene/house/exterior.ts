/**
 * The outside of every house: the same example house on each of the 30 plots, fitted to its ground.
 *
 *   walls     standing timber cladding over a 0.35 m insulated wall, down to a concrete plinth that
 *             follows the ground (or, with a lower floor, down to the patio)
 *   openings  real openings with reveals, aluminium-clad frames and sashes, sills, triple glazing
 *             (one glass layer drawn), the front door with its glass strip, sliding doors
 *   roof      dark standing-seam steel at the measured pitch, fascia, soffits, verges, ridge cap,
 *             half-round gutters, downpipes to the ground, snow guards, the ventilation hood and the
 *             drain vent on the north side, and the solar modules on rails on the view side
 *   outside   the terrace on posts with a glass railing and a stair down, the entrance landing with
 *             steps, a canopy, a lamp, the house number and the car charger; with a lower floor, the
 *             patio in front of it
 *
 * Everything shares a handful of materials, and every vertex knows its house (aHouse), so one draw
 * call per material covers all 30 houses and the energy layer can still light one house. Parts that
 * move (the front door, the sliding doors) are marked (aMove) so the house being visited can hide
 * them here and draw them moving.
 */
import * as THREE from "three";
import type { Plot } from "@/lib/types";
import { HOUSE, OPENINGS, keep, roofTop, levelZ, holeRect, type HouseFit, type Opening, type Side } from "@/lib/house/plan";
import { Builders, type Builder, type V3 } from "./kit";
import { houseMatrix } from "./frame";

export const MODULE = { w: 1.134, h: 1.762, wp: 430 };   // a 430 Wp module, portrait

// stained and painted standing cladding: charcoal, weathered grey, white, natural larch, dark green, light grey
export const FACADES = ["#3a3f43", "#8d867b", "#e4e1da", "#9b7a55", "#3f4a40", "#c9c6bf"];
const TRIM = ["#2c3033", "#e8e6e1", "#f2f0ec", "#2f3236", "#2b322c", "#f2f0ec"];

const H = HOUSE;
/** depth of the window frames' outer face behind the cladding, and their own depth */
export const FRAME = { at: 0.11, depth: 0.09, w: 0.07, sash: 0.055 };

/** (u, v, z) in the house frame to builder coordinates (x = u, y = z, z = -v). */
export const L = (u: number, v: number, z: number): V3 => [u, z, -v];

/** A wall face in the house frame: s runs along the wall, z up, d into the wall from its outer face. */
export function sidePoint(side: Side, s: number, z: number, d = 0): V3 {
  switch (side) {
    case "front": return L(s, H.hd - d, z);
    case "back": return L(s, -H.hd + d, z);
    case "left": return L(-H.hw + d, s, z);
    case "right": return L(H.hw - d, s, z);
  }
}
/** Outward normal of a side, in builder coordinates. */
const OUT: Record<Side, V3> = { front: [0, 0, -1], back: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0] };

/** A quad turned to face `n` whatever order the corners come in. */
export function facing(b: Builder, n: V3, a: V3, bb: V3, c: V3, d: V3, uv?: [number, number][]) {
  const e1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) b.quad(a, bb, c, d, uv);
  else b.quad(d, c, bb, a, uv ? [uv[3], uv[2], uv[1], uv[0]] : undefined);
}

/** A box given by its corners in the house frame (u, v, z ranges). */
export function hbox(b: Builder, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, skip: string[] = []) {
  b.box(Math.min(u0, u1), Math.min(z0, z1), -Math.max(v0, v1), Math.max(u0, u1), Math.max(z0, z1), -Math.min(v0, v1), skip);
}

type Hole = { s0: number; s1: number; z0: number; z1: number };

/**
 * A wall's outer face with rectangular holes, split into vertical strips at every hole edge (and
 * the gable's apex) and, in each strip, into the pieces between the holes. `top` gives the height of
 * the wall's top edge along it (a gable rises to the roof).
 */
export function wallFace(b: Builder, side: Side, s0: number, s1: number, zBottom: number, top: (s: number) => number, holes: Hole[], depth = 0, breaks: number[] = []) {
  const xs = new Set<number>([s0, s1, ...breaks.filter((x) => x > s0 && x < s1)]);
  for (const h of holes) { xs.add(Math.max(s0, Math.min(s1, h.s0))); xs.add(Math.max(s0, Math.min(s1, h.s1))); }
  const cuts = [...xs].sort((a, c) => a - c);
  const n = OUT[side];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], c = cuts[i + 1];
    if (c - a < 1e-4) continue;
    const mid = (a + c) / 2;
    const spans = holes.filter((h) => h.s0 <= mid && h.s1 >= mid).map((h) => [h.z0, h.z1]).sort((p, q) => p[0] - q[0]);
    let z = zBottom;
    for (const [h0, h1] of spans) {
      if (h0 > z + 1e-4) facing(b, n, sidePoint(side, a, z, depth), sidePoint(side, c, z, depth), sidePoint(side, c, h0, depth), sidePoint(side, a, h0, depth), [[a, z], [c, z], [c, h0], [a, h0]]);
      z = Math.max(z, h1);
    }
    const ta = top(a), tc = top(c);
    if (Math.max(ta, tc) > z + 1e-4) facing(b, n, sidePoint(side, a, z, depth), sidePoint(side, c, z, depth), sidePoint(side, c, Math.max(z, tc), depth), sidePoint(side, a, Math.max(z, ta), depth), [[a, z], [c, z], [c, tc], [a, ta]]);
  }
}

/** The extent of a side's wall along s (front and back run along u, the gables along v). */
const extent = (side: Side) => (side === "front" || side === "back" ? H.hw : H.hd);

/** The opening's rectangle on its wall, in the house frame (z above the main floor). */
export function holeOf(o: Opening): Hole {
  return holeRect(o);
}

/** The part of a sliding door or a door leaf that moves; drawn separately for the house being visited. */
export type Movable = { id: string; kind: "swing" | "slide"; opening: Opening; hinge: number; dir: 1 | -1 };

/** Which side of an opening is hinged, and which way a door opens, for this house type. */
export function movablesOf(lower: boolean): Movable[] {
  const out: Movable[] = [];
  for (const o of OPENINGS) {
    if (!keep(o, lower)) continue;
    // the front door is hinged on the side away from the hall's bench and opens outwards (as in Norway)
    if (o.kind === "entry") out.push({ id: o.id, kind: "swing", opening: o, hinge: o.c + o.w / 2, dir: 1 });
    // a sliding door's right-hand sash slides behind the fixed one
    if (o.kind === "slide" || o.kind === "garden") out.push({ id: o.id, kind: "slide", opening: o, hinge: o.c, dir: -1 });
  }
  return out;
}

/**
 * One window or door in its opening: the reveals from the cladding to the frame, the sill flashing,
 * the frame, the sashes and the glass. Movable parts (the front door leaf, the sliding sash) are left
 * to drawMovable().
 */
function drawOpening(B: Builders, o: Opening, seed: number, floorY: number) {
  const side = o.side;
  const h = holeOf(o);
  const n = OUT[side];
  const isDoor = o.kind === "entry" || o.kind === "garden" || o.kind === "slide";
  const reveal = B.get("paint");
  // reveals: from the outer face (d = 0) to the frame (d = FRAME.at)
  const P = (s: number, z: number, d: number) => sidePoint(side, s, z, d);
  const along: V3 = side === "front" || side === "back" ? [1, 0, 0] : [0, 0, -1];
  // the reveal on the low-s side faces +s, the one on the high-s side faces -s (in builder axes)
  const sDir = (sign: number): V3 => [along[0] * sign, along[1] * sign, along[2] * sign];
  const flipS = side === "front" || side === "left" ? -1 : 1;   // builder axis direction of +s on this side
  void flipS;
  facing(reveal, sDir(1), P(h.s0, h.z0, 0), P(h.s0, h.z0, FRAME.at), P(h.s0, h.z1, FRAME.at), P(h.s0, h.z1, 0));
  facing(reveal, sDir(-1), P(h.s1, h.z0, 0), P(h.s1, h.z0, FRAME.at), P(h.s1, h.z1, FRAME.at), P(h.s1, h.z1, 0));
  facing(reveal, [0, -1, 0], P(h.s0, h.z1, 0), P(h.s1, h.z1, 0), P(h.s1, h.z1, FRAME.at), P(h.s0, h.z1, FRAME.at));
  if (!isDoor) {
    // sloped aluminium sill flashing, standing 4 cm proud of the cladding
    const m = B.get("metal").tint("#3b3f43");
    const a = P(h.s0 - 0.03, h.z0 - 0.02, -0.045), c = P(h.s1 + 0.03, h.z0 - 0.02, -0.045), d = P(h.s1 + 0.03, h.z0 + 0.012, FRAME.at), e = P(h.s0 - 0.03, h.z0 + 0.012, FRAME.at);
    facing(m, [0, 1, 0], a, c, d, e);
    facing(m, n, P(h.s0 - 0.03, h.z0 - 0.05, -0.045), P(h.s1 + 0.03, h.z0 - 0.05, -0.045), c, a);
  } else {
    // threshold
    const m = B.get("metal").tint("#55595d");
    facing(m, [0, 1, 0], P(h.s0, h.z0 + 0.012, -0.02), P(h.s1, h.z0 + 0.012, -0.02), P(h.s1, h.z0 + 0.012, FRAME.at + FRAME.depth), P(h.s0, h.z0 + 0.012, FRAME.at + FRAME.depth));
  }
  // the frame: a ring of four bars at the frame depth
  const fr = B.get("frame").tint("#2b2f33");
  const f0 = FRAME.at, f1 = FRAME.at + FRAME.depth, w = FRAME.w;
  const bar = (s0: number, s1: number, z0: number, z1: number, d0 = f0, d1 = f1) => boxOnSide(fr, side, s0, s1, z0, z1, d0, d1);
  bar(h.s0, h.s1, h.z1 - w, h.z1);
  if (!isDoor) bar(h.s0, h.s1, h.z0, h.z0 + w);
  bar(h.s0, h.s0 + w, h.z0, h.z1);
  bar(h.s1 - w, h.s1, h.z0, h.z1);
  const gl = B.get("glass");
  gl.attr("aWin", [floorY, o.frosted ? 1 : 0, seed, o.level === "lower" ? 1 : 0]);
  const glassAt = (s0: number, s1: number, z0: number, z1: number, d: number) =>
    facing(gl, n, P(s0, z0, d), P(s1, z0, d), P(s1, z1, d), P(s0, z1, d), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  const i0 = h.s0 + w, i1 = h.s1 - w, j0 = isDoor ? h.z0 : h.z0 + w, j1 = h.z1 - w;
  const sw = FRAME.sash;
  if (o.kind === "window") {
    // opening sashes; a mullion splits wide windows
    const parts = o.w > 1.3 ? 2 : 1;
    const step = (i1 - i0) / parts;
    for (let k = 0; k < parts; k++) {
      const a = i0 + k * step + (k > 0 ? 0.03 : 0), c = i0 + (k + 1) * step - (k < parts - 1 ? 0.03 : 0);
      sashRing(fr, side, a, c, j0, j1, sw, f0 + 0.012, f1 - 0.012);
      glassAt(a + sw, c - sw, j0 + sw, j1 - sw, f0 + FRAME.depth / 2);
    }
    if (parts > 1) bar((i0 + i1) / 2 - 0.03, (i0 + i1) / 2 + 0.03, j0, j1);
  } else if (o.kind === "fixed" || o.kind === "gable") {
    glassAt(i0, i1, j0, j1, f0 + FRAME.depth / 2);
  } else if (o.kind === "slide" || o.kind === "garden") {
    // the fixed sash on the left half, in the outer track; the sliding one is a Movable
    const mid = (i0 + i1) / 2;
    sashRing(fr, side, i0, mid + 0.03, j0 + 0.02, j1, sw + 0.01, f0 + 0.005, f0 + 0.045);
    glassAt(i0 + sw + 0.01, mid + 0.03 - sw - 0.01, j0 + 0.02 + sw + 0.01, j1 - sw - 0.01, f0 + 0.025);
    bar(i0, i1, h.z0, h.z0 + 0.04);   // the track
  }
  // entry door: frame only; the leaf is a Movable
}

/** A box on a wall face: s along the wall, z up, d into the wall. */
export function boxOnSide(b: Builder, side: Side, s0: number, s1: number, z0: number, z1: number, d0: number, d1: number) {
  const p = sidePoint(side, s0, z0, d0), q = sidePoint(side, s1, z1, d1);
  b.box(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2]));
}

function sashRing(b: Builder, side: Side, s0: number, s1: number, z0: number, z1: number, w: number, d0: number, d1: number) {
  boxOnSide(b, side, s0, s1, z0, z0 + w, d0, d1);
  boxOnSide(b, side, s0, s1, z1 - w, z1, d0, d1);
  boxOnSide(b, side, s0, s0 + w, z0 + w, z1 - w, d0, d1);
  boxOnSide(b, side, s1 - w, s1, z0 + w, z1 - w, d0, d1);
}

/**
 * A movable part in its own frame (origin at the hinge or the track, s along the wall, z up, d into
 * the wall), drawn into `B` at the current placement. The visited house's doors use this to swing
 * and slide; the other houses get it in place (closed) in the merged meshes.
 */
export function drawMovable(B: Builders, m: Movable, floorY: number, seed: number) {
  const o = m.opening, h = holeOf(o), side = o.side;
  const fr = B.get("frame");
  const gl = B.get("glass");
  gl.attr("aWin", [floorY, 0, seed, o.level === "lower" ? 1 : 0]);
  const n = OUT[side];
  const P = (s: number, z: number, d: number) => sidePoint(side, s, z, d);
  const glassAt = (s0: number, s1: number, z0: number, z1: number, d: number) =>
    facing(gl, n, P(s0, z0, d), P(s1, z0, d), P(s1, z1, d), P(s0, z1, d), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  if (m.kind === "swing") {
    // a timber front door with a vertical glass strip, painted outside, oak inside
    const i0 = h.s0 + FRAME.w, i1 = h.s1 - FRAME.w, top = h.z1 - FRAME.w;
    const d0 = FRAME.at + 0.01, d1 = FRAME.at + 0.075;
    const leaf = B.get("paint").tint("#2a2d30");
    const gs0 = i0 + 0.16, gs1 = i0 + 0.3;
    boxOnSide(leaf, side, i0, gs0, h.z0 + 0.012, top, d0, d1);
    boxOnSide(leaf, side, gs1, i1, h.z0 + 0.012, top, d0, d1);
    boxOnSide(leaf, side, gs0, gs1, h.z0 + 0.012, h.z0 + 0.3, d0, d1);
    boxOnSide(leaf, side, gs0, gs1, top - 0.2, top, d0, d1);
    glassAt(gs0, gs1, h.z0 + 0.3, top - 0.2, (d0 + d1) / 2);
    // the handle and the lock, on both faces
    const met = B.get("metal").tint("#9aa0a6");
    const hs = m.hinge > o.c ? i0 + 0.08 : i1 - 0.08;
    boxOnSide(met, side, hs - 0.015, hs + 0.015, h.z0 + 0.98, h.z0 + 1.08, d0 - 0.06, d0);
    boxOnSide(met, side, hs - 0.015, hs + 0.015 + (m.hinge > o.c ? 0.13 : -0.13), h.z0 + 1.03, h.z0 + 1.055, d0 - 0.075, d0 - 0.055);
    boxOnSide(met, side, hs - 0.015, hs + 0.015, h.z0 + 0.98, h.z0 + 1.08, d1, d1 + 0.06);
    boxOnSide(met, side, hs - 0.015, hs + 0.015 + (m.hinge > o.c ? 0.13 : -0.13), h.z0 + 1.03, h.z0 + 1.055, d1 + 0.055, d1 + 0.075);
    void fr;
  } else {
    const i0 = h.s0 + FRAME.w, i1 = h.s1 - FRAME.w, j0 = h.z0 + 0.02, j1 = h.z1 - FRAME.w;
    const mid = (i0 + i1) / 2;
    const sw = FRAME.sash + 0.01;
    // the sliding sash, in the inner track, on the right half
    sashRing(fr.tint("#2b2f33"), side, mid - 0.03, i1, j0, j1, sw, FRAME.at + 0.05, FRAME.at + 0.09);
    glassAt(mid - 0.03 + sw, i1 - sw, j0 + sw, j1 - sw, FRAME.at + 0.07);
    // a slim pull handle
    const met = B.get("metal").tint("#9aa0a6");
    boxOnSide(met, side, mid + 0.02, mid + 0.04, j0 + 0.9, j0 + 1.25, FRAME.at + 0.09, FRAME.at + 0.11);
  }
}

/** Ground height relative to the main floor at a house-local point. */
export type GroundFn = (u: number, v: number) => number;

/**
 * Build the outside of one house into the shared builders (already placed in the house's frame).
 * `g` is the graded ground relative to the main floor.
 */
export function buildHouseExterior(B: Builders, p: Plot, fit: HouseFit, index: number, g: GroundFn, modules: number) {
  const lower = fit.lower;
  const facade = new THREE.Color(FACADES[index % FACADES.length]);
  const trim = new THREE.Color(TRIM[index % TRIM.length]);
  const LZ = H.lower;
  const patio = lower && fit.patio_z !== null ? fit.patio_z - fit.floor_z : 0;
  const floorY = fit.floor_z;
  const seed = (index * 0.6180339) % 1;

  const openings = OPENINGS.filter((o) => keep(o, lower));
  const holesOn = (side: Side) => openings.filter((o) => o.side === side).map(holeOf);

  // ---------------- walls: cladding from its bottom edge to the roof, with the openings cut out
  const clad = B.get("clad").tint(facade);
  const cladBottom = (side: Side) => (lower && side !== "back" ? LZ + 0.15 : -0.25);
  const wallTop = (side: Side) => (side === "front" || side === "back" ? () => H.eave - 0.3 : (s: number) => roofTop(s) - 0.3);
  for (const side of ["front", "back", "left", "right"] as Side[]) {
    const e = extent(side);
    wallFace(clad, side, -e, e, cladBottom(side), wallTop(side), holesOn(side), 0, side === "left" || side === "right" ? [0] : []);
  }
  // corner boards
  const paint = B.get("paint").tint(trim);
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const zb = lower && sv > 0 ? LZ + 0.15 : -0.25;
    const top = H.eave - 0.3;
    hbox(paint, su * H.hw - (su > 0 ? 0.0 : 0.025), su * H.hw + (su > 0 ? 0.025 : 0.0), sv * H.hd - (sv > 0 ? 0.12 : -0.0), sv * H.hd + (sv > 0 ? 0.0 : 0.12), zb, top);
    hbox(paint, su * H.hw - (su > 0 ? 0.12 : -0.0), su * H.hw + (su > 0 ? 0.0 : 0.12), sv * H.hd - (sv > 0 ? 0.0 : 0.025), sv * H.hd + (sv > 0 ? 0.025 : 0.0), zb, top);
  }

  // ---------------- openings
  for (const o of openings) drawOpening(B, o, seed + o.c * 0.13, floorY + levelZ(o.level));
  // the moving parts, closed (the visited house hides them here and draws them moving)
  B.attr("aMove", [1]);
  for (const m of movablesOf(lower)) drawMovable(B, m, floorY + levelZ(m.opening.level), seed);
  B.attr("aMove", [0]);

  // ---------------- the plinth: concrete from below the cladding down into the ground
  const conc = B.get("concrete").tint("#8e8c87");
  const minGround = (pts: [number, number][]) => Math.min(...pts.map(([u, v]) => g(u, v)));
  const along = (side: Side, n = 12): [number, number][] => Array.from({ length: n + 1 }, (_, i) => {
    const t = -1 + (2 * i) / n;
    return side === "front" ? [t * H.hw, H.hd] : side === "back" ? [t * H.hw, -H.hd] : side === "left" ? [-H.hw, t * H.hd] : [H.hw, t * H.hd];
  });
  for (const side of ["front", "back", "left", "right"] as Side[]) {
    const bottom = Math.min(cladBottom(side), minGround(along(side))) - 0.35;
    const top = cladBottom(side);
    if (top - bottom < 0.05) continue;
    const e = extent(side);
    // 2 cm behind the cladding's face, as a plinth sits under a ventilated cladding
    boxOnSide(conc, side, -e + 0.005, e - 0.005, bottom, top, 0.02, 0.3);
  }

  // ---------------- the roof
  buildRoof(B, index, modules, trim);

  // ---------------- the terrace on the view side
  buildTerrace(B, g, lower, patio, index);

  // ---------------- the entrance: landing, steps, canopy, lamp, house number, car charger
  buildEntrance(B, g, p, index, trim);

  // ---------------- the patio in front of the lower floor
  if (lower) buildPatio(B, g, patio);

  // ---------------- outdoor lamps on the view side (lit at night)
  const lampAt = (s: number, z: number, side: Side = "front") => {
    const met = B.get("metal").tint("#24272a");
    boxOnSide(met, side, s - 0.06, s + 0.06, z - 0.12, z + 0.12, -0.12, 0);
    const lamp = B.get("lamp");
    const q = sidePoint(side, s, z - 0.121, -0.06);
    lamp.quad([q[0] - 0.04, q[1], q[2] - 0.04], [q[0] + 0.04, q[1], q[2] - 0.04], [q[0] + 0.04, q[1], q[2] + 0.04], [q[0] - 0.04, q[1], q[2] + 0.04]);
  };
  lampAt(-0.15, 2.25);
  lampAt(2.55, 2.25);
  if (lower) lampAt(-1.15, LZ + 2.2);
}

/** The roof: two slopes of standing-seam steel with their edges, gutters, downpipes and fittings. */
function buildRoof(B: Builders, index: number, modules: number, trim: THREE.Color) {
  const ov = H.overhang;
  const slope = (H.ridge - H.eave) / H.hd;
  const zEdge = H.eave - slope * ov;          // the roof surface at the eave edge
  const eu = H.hw + ov;                        // the verge edge along u
  const ev = H.hd + ov;                        // the eave edge along v
  const roof = B.get("roof").tint("#2c3034");
  const rafter = 0.3;                          // from the roof surface down to the soffit
  for (const s of [-1, 1]) {
    // the slope itself (s = +1 towards the view)
    const a = L(-eu, s * ev, zEdge), b = L(eu, s * ev, zEdge), c = L(eu, 0, H.ridge), d = L(-eu, 0, H.ridge);
    facing(roof, [0, 1, -s * 0.5], a, b, c, d, [[-eu, 0], [eu, 0], [eu, Math.hypot(ev, H.ridge - zEdge)], [-eu, Math.hypot(ev, H.ridge - zEdge)]]);
    // the fascia and the soffit under the overhang
    const paint = B.get("paint").tint(trim);
    facing(paint, [0, 0, -s], L(-eu, s * ev, zEdge - rafter - 0.04), L(eu, s * ev, zEdge - rafter - 0.04), L(eu, s * ev, zEdge + 0.02), L(-eu, s * ev, zEdge + 0.02));
    facing(paint, [0, -1, 0], L(-eu, s * ev, zEdge - rafter), L(eu, s * ev, zEdge - rafter), L(eu, s * H.hd, H.eave - rafter), L(-eu, s * H.hd, H.eave - rafter));
    // the gutter (half-round, 125 mm) and the downpipes at both ends
    const met = B.get("metal").tint("#3a3e42");
    met.tube(L(-eu - 0.02, s * (ev + 0.07), zEdge - 0.09), L(eu + 0.02, s * (ev + 0.07), zEdge - 0.11), 0.0625, 10);
    // snow guard: a bar on brackets along the eave
    const sg = s > 0 ? 0.12 : 0.6;   // on the view side it sits under the modules
    const sv = s * (ev - sg * (ev / Math.hypot(ev, H.ridge - zEdge))), sz = zEdge + sg * ((H.ridge - zEdge) / Math.hypot(ev, H.ridge - zEdge)) + 0.09;
    met.tube(L(-eu + 0.3, sv, sz), L(eu - 0.3, sv, sz), 0.02, 6);
    for (let k = -5; k <= 5; k++) hbox(met, k * 1.05 - 0.015, k * 1.05 + 0.015, sv - 0.03, sv + 0.03, sz - 0.1, sz + 0.02);
  }
  // the verges: the roof's gable edges, boxed in, and their soffits
  const paint = B.get("paint").tint(trim);
  for (const su of [-1, 1]) {
    const x = su * eu;
    for (const s of [-1, 1]) {
      facing(paint, [su, 0, 0], L(x, s * ev, zEdge - rafter - 0.04), L(x, 0, H.ridge - rafter - 0.04), L(x, 0, H.ridge + 0.02), L(x, s * ev, zEdge + 0.02));
      facing(paint, [0, -1, 0], L(su * H.hw, s * ev, zEdge - rafter), L(x, s * ev, zEdge - rafter), L(x, 0, H.ridge - rafter), L(su * H.hw, 0, H.ridge - rafter));
    }
  }
  // the ridge cap
  const met = B.get("metal").tint("#2a2e32");
  for (const s of [-1, 1]) facing(met, [0, 1, -s * 0.5], L(-eu, s * 0.17, H.ridge - 0.17 * slope + 0.03), L(eu, s * 0.17, H.ridge - 0.17 * slope + 0.03), L(eu, 0, H.ridge + 0.06), L(-eu, 0, H.ridge + 0.06));
  // downpipes at the four corners, from the gutter down to the ground or the patio
  // (the ground is read when the house is placed, so the pipe end is set in buildHouseExterior's caller)

  // the ventilation unit's roof hood (combined intake and exhaust) over the plant room, and the drain vent over the bath
  const hood = B.get("metal").tint("#202326");
  const hv = -2.4, hz = roofTop(hv);
  hbox(hood, -4.3, -3.8, hv - 0.25, hv + 0.25, hz - 0.1, hz + 0.45);
  hbox(hood, -4.36, -3.74, hv - 0.31, hv + 0.31, hz + 0.45, hz + 0.5);
  const pv = -2.7, pz = roofTop(pv);
  hood.cyl(-1.6, 2.7, 0.055, pz - 0.1, pz + 0.55, 10);

  // ---------------- solar modules on rails, rows from the eaves up (same layout as the energy model)
  if (modules <= 0) return;
  const lenSlope = Math.hypot(ev, H.ridge - zEdge);
  const rows = Math.max(1, Math.floor((lenSlope - 0.45) / (MODULE.h + 0.02)));
  const perRow = Math.max(1, Math.floor((H.W + 2 * ov - 0.6) / (MODULE.w + 0.02)));
  let left = Math.min(modules, rows * perRow);
  const cosA = ev / lenSlope, sinA = (H.ridge - zEdge) / lenSlope;
  // the roof plane's own frame in builder axes: x along u, y the roof's normal, z up the slope
  const frameM = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, cosA, -sinA), new THREE.Vector3(0, sinA, cosA)).setPosition(0, zEdge, -ev);
  const pvB = B.get("pv");
  const pvFrame = B.get("metal");
  const savedP = pvB.m.clone(), savedF = pvFrame.m.clone();
  pvB.at(savedP.clone().multiply(frameM));
  pvFrame.at(savedF.clone().multiply(frameM));
  pvFrame.tint("#1b1e22");
  for (let r = 0; r < rows && left > 0; r++) {
    const inRow = Math.min(perRow, left);
    left -= inRow;
    const width = inRow * (MODULE.w + 0.02);
    const s0 = 0.25 + r * (MODULE.h + 0.02), s1 = s0 + MODULE.h;
    // two rails under the row
    for (const t of [0.25, 0.75]) pvFrame.box(-width / 2 - 0.08, 0.0, s0 + t * MODULE.h - 0.02, width / 2 + 0.08, 0.05, s0 + t * MODULE.h + 0.02);
    for (let k = 0; k < inRow; k++) {
      const u0 = -width / 2 + k * (MODULE.w + 0.02), u1 = u0 + MODULE.w;
      const y0 = 0.05, y1 = 0.085;
      // the glass top with the cells, its aluminium frame round the edge
      pvB.quad([u0 + 0.015, y1, s0 + 0.015], [u1 - 0.015, y1, s0 + 0.015], [u1 - 0.015, y1, s1 - 0.015], [u0 + 0.015, y1, s1 - 0.015], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      pvFrame.box(u0, y0, s0, u1, y1, s0 + 0.015, ["ny"]);
      pvFrame.box(u0, y0, s1 - 0.015, u1, y1, s1, ["ny"]);
      pvFrame.box(u0, y0, s0 + 0.015, u0 + 0.015, y1, s1 - 0.015, ["ny"]);
      pvFrame.box(u1 - 0.015, y0, s0 + 0.015, u1, y1, s1 - 0.015, ["ny"]);
    }
  }
  pvB.at(savedP);
  pvFrame.at(savedF);
  void index;
}

/** Corners of the eaves where the downpipes run down; the caller ends them on the ground. */
export const DOWNPIPES: [number, number][] = [[-H.hw + 0.12, H.hd + 0.08], [H.hw - 0.12, H.hd + 0.08], [-H.hw + 0.12, -H.hd - 0.08], [H.hw - 0.12, -H.hd - 0.08]];

function buildDownpipes(B: Builders, g: GroundFn, lower: boolean, patio: number) {
  const ov = H.overhang;
  const slope = (H.ridge - H.eave) / H.hd;
  const zEdge = H.eave - slope * ov;
  const met = B.get("metal").tint("#3a3e42");
  for (const [u, v] of DOWNPIPES) {
    const sv = Math.sign(v);
    const groundZ = lower && sv > 0 ? patio : g(u, v);
    const top = zEdge - 0.12;
    // swan neck from the gutter under the overhang back to the wall
    met.tube(L(u, sv * (H.hd + ov + 0.07), top), L(u, sv * (H.hd + 0.1), top - 0.35), 0.045, 8);
    met.tube(L(u, sv * (H.hd + 0.1), top - 0.35), L(u, sv * (H.hd + 0.1), groundZ + 0.15), 0.045, 8);
    // wall clips
    for (let z = top - 0.8; z > groundZ + 0.5; z -= 1.6) hbox(met, u - 0.05, u + 0.05, sv * H.hd + (sv > 0 ? 0 : -0.15), sv * H.hd + (sv > 0 ? 0.15 : 0), z, z + 0.03);
    // the gully at the foot
    const conc = B.get("concrete").tint("#7f7d78");
    hbox(conc, u - 0.15, u + 0.15, sv * (H.hd + 0.1) - 0.15, sv * (H.hd + 0.1) + 0.15, groundZ - 0.2, groundZ + 0.05);
  }
}

/** The terrace: decking on joists and a glulam beam, steel posts to the ground, a glass railing, a stair. */
function buildTerrace(B: Builders, g: GroundFn, lower: boolean, patio: number, index: number) {
  const u0 = -H.hw + H.terraceInset, u1 = H.hw - H.terraceInset;
  const v0 = H.hd + 0.02, v1 = H.hd + H.terraceDepth;
  const top = -0.03;
  const deck = B.get("deck").tint(index % 3 === 1 ? "#8a7b68" : "#7b6046");
  // deck boards run along u; the shader draws the gaps from the UVs (metres)
  facing(deck, [0, 1, 0], L(u0, v1, top), L(u1, v1, top), L(u1, v0, top), L(u0, v0, top), [[u0, v1], [u1, v1], [u1, v0], [u0, v0]]);
  const fascia = B.get("deck").tint(index % 3 === 1 ? "#6f6253" : "#654d38");
  hbox(fascia, u0, u1, v1 - 0.03, v1, top - 0.22, top);
  hbox(fascia, u0, u0 + 0.03, v0, v1, top - 0.22, top);
  hbox(fascia, u1 - 0.03, u1, v0, v1, top - 0.22, top);
  // the underside, seen from the patio: joists and the beam
  const wood = B.get("deck").tint("#5e4a37");
  facing(wood, [0, -1, 0], L(u0, v0, top - 0.22), L(u1, v0, top - 0.22), L(u1, v1, top - 0.22), L(u0, v1, top - 0.22));
  for (let k = 0; k <= 16; k++) { const u = u0 + 0.1 + (k * (u1 - u0 - 0.2)) / 16; hbox(wood, u - 0.024, u + 0.024, v0, v1 - 0.03, top - 0.42, top - 0.22, ["py"]); }
  hbox(wood, u0, u1, v1 - 0.2, v1 - 0.085, top - 0.72, top - 0.42, ["py"]);
  // steel posts down to the ground (or the patio), on small footings
  const met = B.get("metal").tint("#3d4246");
  const postV = v1 - 0.14;
  const conc = B.get("concrete").tint("#8a8883");
  for (let k = 0; k <= 4; k++) {
    const u = u0 + 0.12 + (k * (u1 - u0 - 0.24)) / 4;
    const foot = lower ? patio : g(u, postV);
    if (top - 0.72 - foot < 0.15) continue;
    hbox(met, u - 0.05, u + 0.05, postV - 0.05, postV + 0.05, foot, top - 0.72);
    if (!lower) hbox(conc, u - 0.17, u + 0.17, postV - 0.17, postV + 0.17, foot - 0.3, foot + 0.12);
  }
  // the glass railing (1.0 m over the deck, as TEK17 asks on a terrace), steel handrail on top
  const stairW = 1.0;
  const rg = B.get("railglass");
  const hr = B.get("metal").tint("#9aa1a7");
  const run = (a: V3, b: V3, n: V3) => {
    facing(rg, n, [a[0], a[1] + 0.06, a[2]], [b[0], b[1] + 0.06, b[2]], [b[0], b[1] + 0.95, b[2]], [a[0], a[1] + 0.95, a[2]]);
    hr.tube([a[0], a[1] + 0.99, a[2]], [b[0], b[1] + 0.99, b[2]], 0.022, 8);
    hr.tube([a[0], a[1] + 0.06, a[2]], [b[0], b[1] + 0.06, b[2]], 0.012, 6);
  };
  const stairAtEnd = u1 - stairW;   // the opening for the stair at the right-hand front corner
  run(L(u0 + 0.05, v1 - 0.05, top), L(stairAtEnd, v1 - 0.05, top), [0, 0, -1]);
  run(L(u0 + 0.05, v0 + 0.05, top), L(u0 + 0.05, v1 - 0.05, top), [-1, 0, 0]);
  run(L(u1 - 0.05, v0 + 0.05, top), L(u1 - 0.05, v1 - 0.05, top), [1, 0, 0]);
  // the stair down: timber treads on steel stringers
  const stairs = terraceStair(lower, patio, g, top, stairAtEnd, u1, v1);
  for (const f of stairs.flights) stairFlight(B, f);
  if (stairs.landing) {
    const l = stairs.landing;
    hbox(B.get("deck").tint("#7b6046"), l.u0, l.u1, l.v0, l.v1, top - 0.06, top, ["ny"]);
    const lmet = B.get("metal").tint("#3d4246");
    hbox(lmet, l.u1 - 0.1, l.u1, l.v1 - 0.1, l.v1, l.foot, top - 0.06);
    hbox(lmet, l.u0, l.u0 + 0.1, l.v1 - 0.1, l.v1, l.foot, top - 0.06);
    // its railing on the open sides
    run(L(l.u0, l.v1 - 0.03, top), L(l.u1 - 0.03, l.v1 - 0.03, top), [0, 0, -1]);
    run(L(l.u1 - 0.03, l.v0, top), L(l.u1 - 0.03, l.v1 - 0.03, top), [1, 0, 0]);
  }
}

/** A straight flight of stairs: from (u, v) at the top, `n` risers down along (du, dv), `w` wide. */
export type Flight = { u: number; v: number; z: number; du: number; dv: number; n: number; rise: number; tread: number; w: number; rail: -1 | 0 | 1 };

/**
 * Where a terrace's stair goes. From a high terrace (a lower floor below, or ground more than 1.2 m
 * down) it turns: a landing outside the railing, then a flight down along the terrace's front edge.
 * From a low one, steps straight out to the garden.
 */
export function terraceStair(lower: boolean, patio: number, g: GroundFn, top: number, stairAt: number, u1: number, v1: number) {
  const tread = 0.27;
  const straightFoot = g((stairAt + u1) / 2, v1 + 0.9);
  if (!lower && top - straightFoot <= 1.2) {
    const drop = top - straightFoot;
    const n = Math.max(1, Math.round(drop / 0.18));
    return { landing: null, flights: [{ u: (stairAt + u1) / 2, v: v1, z: top, du: 0, dv: 1, n, rise: drop / n, tread, w: u1 - stairAt - 0.06, rail: 0 } as Flight] };
  }
  // the landing, then down along the front: find the foot where the flight meets the ground
  const lv0 = v1, lv1 = v1 + 1.0, mid = (lv0 + lv1) / 2;
  let foot = lower ? patio : g(stairAt - 2, mid);
  let n = 1;
  for (let k = 0; k < 4; k++) {
    n = Math.max(2, Math.round((top - foot) / 0.18));
    if (lower) break;
    foot = g(stairAt - (n - 1) * tread, mid);
  }
  const landingFoot = lower ? patio : Math.min(g(stairAt, mid), g(u1, lv1));
  return {
    landing: { u0: stairAt, u1, v0: lv0, v1: lv1, foot: landingFoot },
    flights: [{ u: stairAt, v: mid, z: top, du: -1, dv: 0, n, rise: (top - foot) / n, tread, w: 0.96, rail: 1 } as Flight],
  };
}

/** Draws a flight: treads, two stringers, and a glass railing with a handrail on the open side. */
function stairFlight(B: Builders, f: Flight) {
  const wood = B.get("deck").tint("#7b6046");
  const met = B.get("metal").tint("#3d4246");
  // across the flight (to the left of the walking direction)
  const au = -f.dv, av = f.du;
  const P = (s: number, c: number, z: number) => L(f.u + f.du * s + au * c, f.v + f.dv * s + av * c, z);
  for (let k = 1; k <= f.n - 1 + (f.du === 0 ? 1 : 0); k++) {
    const s0 = (k - 1) * f.tread, s1 = s0 + f.tread;
    const z = f.z - k * f.rise;
    const a = P(s0, -f.w / 2 + 0.03, z), b = P(s1, f.w / 2 - 0.03, z - 0.045);
    wood.box(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]));
  }
  const run = (f.n - (f.du === 0 ? 0 : 1)) * f.tread;
  const zEnd = f.z - f.n * f.rise;
  for (const c of [-f.w / 2, f.w / 2]) {
    const n: V3 = [au * Math.sign(c), 0, -av * Math.sign(c)];
    facing(met, n, P(0, c, f.z - 0.28), P(run, c, zEnd - 0.05), P(run, c, zEnd + 0.22), P(0, c, f.z + 0.02));
    facing(met, [-n[0], 0, -n[2]], P(0, c - Math.sign(c) * 0.012, f.z - 0.28), P(run, c - Math.sign(c) * 0.012, zEnd - 0.05), P(run, c - Math.sign(c) * 0.012, zEnd + 0.22), P(0, c - Math.sign(c) * 0.012, f.z + 0.02));
  }
  if (f.rail) {
    const c = (f.rail * f.w) / 2;
    const rg = B.get("railglass");
    const hr = B.get("metal").tint("#9aa1a7");
    facing(rg, [au, 0, -av], P(0, c, f.z + 0.06), P(run, c, zEnd + 0.06), P(run, c, zEnd + 0.88), P(0, c, f.z + 0.88));
    const a = P(0, c, f.z + 0.92), b = P(run, c, zEnd + 0.92);
    hr.tube(a, b, 0.022, 8);
  }
}

/** The landing at the front door, its steps down to the path round the house, and what hangs by the door. */
function buildEntrance(B: Builders, g: GroundFn, p: Plot, index: number, trim: THREE.Color) {
  const door = OPENINGS.find((o) => o.kind === "entry")!;
  const c = door.c, v0 = -H.hd - 1.5, v1 = -H.hd;
  const stone = B.get("paving").tint("#a3a19c");
  const conc = B.get("concrete").tint("#8e8c87");
  const top = -0.02;
  const ground = Math.min(g(c - 1, v0), g(c + 1, v0), g(c, v0 - 0.9));
  // the landing: paving on a concrete slab down to the ground
  facing(stone, [0, 1, 0], L(c - 1.0, v1, top), L(c + 1.0, v1, top), L(c + 1.0, v0, top), L(c - 1.0, v0, top), [[c - 1, -v1], [c + 1, -v1], [c + 1, -v0], [c - 1, -v0]]);
  hbox(conc, c - 1.0, c + 1.0, v0, v1, ground - 0.3, top - 0.005, ["py"]);
  // steps down to the path (the ground round the house is graded 0.6 m below the floor)
  const drop = top - ground;
  const n = Math.max(0, Math.round(drop / 0.18));
  if (n > 0) {
    const rise = drop / n;
    for (let k = 1; k <= n; k++) {
      const z = top - k * rise;
      const vb = v0 - (k - 1) * 0.3, va = vb - 0.3;
      facing(stone, [0, 1, 0], L(c - 0.8, vb, z), L(c + 0.8, vb, z), L(c + 0.8, va, z), L(c - 0.8, va, z));
      hbox(conc, c - 0.8, c + 0.8, va, vb, ground - 0.25, z - 0.005, ["py"]);
    }
  }
  // the canopy over the door, held by two rods to the wall
  const met = B.get("metal").tint("#2b2f33");
  hbox(met, c - 1.1, c + 1.1, -H.hd - 1.3, -H.hd, 2.38, 2.48);
  met.tube(L(c - 0.9, -H.hd - 1.2, 2.47), L(c - 0.9, -H.hd, 3.05), 0.012, 6);
  met.tube(L(c + 0.9, -H.hd - 1.2, 2.47), L(c + 0.9, -H.hd, 3.05), 0.012, 6);
  // a wall lamp beside the door (lit at night)
  hbox(met, c + 0.72, c + 0.84, -H.hd - 0.12, -H.hd, 1.82, 2.06);
  const lamp = B.get("lamp");
  const q = L(c + 0.78, -H.hd - 0.06, 1.819);
  lamp.quad([q[0] - 0.035, q[1], q[2] - 0.035], [q[0] + 0.035, q[1], q[2] - 0.035], [q[0] + 0.035, q[1], q[2] + 0.035], [q[0] - 0.035, q[1], q[2] + 0.035]);
  // the house number on a dark plate
  const plate = B.get("paint").tint(trim.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5 ? "#2c3033" : "#e9e7e2");
  hbox(plate, c - 0.82, c - 0.62, -H.hd - 0.02, -H.hd, 1.6, 1.75);
  // the car charger on the wall, at the corner nearest the road
  const ch = B.get("paint").tint("#e9eaeb");
  hbox(ch, c + 2.2, c + 2.48, -H.hd - 0.12, -H.hd, 1.0, 1.36);
  const cab = B.get("metal").tint("#1e2124");
  cab.tube(L(c + 2.34, -H.hd - 0.12, 1.05), L(c + 2.34, -H.hd - 0.16, 0.6), 0.012, 6);
  cab.tube(L(c + 2.34, -H.hd - 0.16, 0.6), L(c + 2.5, -H.hd - 0.14, 0.6), 0.012, 6);
  void p; void index;
}

/** The patio in front of the lower floor: paving on a concrete edge where the ground falls away. */
function buildPatio(B: Builders, g: GroundFn, patio: number) {
  const u0 = -H.hw - H.patioSide, u1 = H.hw + H.patioSide;
  const v0 = H.hd, v1 = H.hd + H.patioDepth;
  const stone = B.get("paving").tint("#9d9b96");
  facing(stone, [0, 1, 0], L(u0, v1, patio), L(u1, v1, patio), L(u1, v0, patio), L(u0, v0, patio), [[u0, -v1], [u1, -v1], [u1, -v0], [u0, -v0]]);
  const wall = B.get("stone").tint("#6e6a64");
  const cap = B.get("paving").tint("#a19e98");
  // the edge: a dry-stone wall down to the ground where it falls away, capped with granite
  const sides: { a: [number, number]; b: [number, number]; n: V3 }[] = [
    { a: [u0, v1], b: [u1, v1], n: [0, 0, -1] },
    { a: [u0, v0], b: [u0, v1], n: [-1, 0, 0] },
    { a: [u1, v1], b: [u1, v0], n: [1, 0, 0] },
  ];
  const rg = B.get("railglass");
  const hr = B.get("metal").tint("#9aa1a7");
  for (const s of sides) {
    const steps = 10;
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps, t1 = (k + 1) / steps;
      const ua = s.a[0] + (s.b[0] - s.a[0]) * t0, va = s.a[1] + (s.b[1] - s.a[1]) * t0;
      const ub = s.a[0] + (s.b[0] - s.a[0]) * t1, vb = s.a[1] + (s.b[1] - s.a[1]) * t1;
      const ga = g(ua, va), gb = g(ub, vb);
      const low = Math.min(ga, gb) - 0.3;
      if (patio - low > 0.05) {
        // the wall leans back a little (1:10), as a dry-stone wall is built
        const lean = (patio - low) * 0.1;
        const off = (x: number, y: number, d: number): [number, number] => [x + (s.n[0] * d), y - (s.n[2] * d)];
        const [ua2, va2] = off(ua, va, lean), [ub2, vb2] = off(ub, vb, lean);
        facing(wall, s.n, L(ua2, va2, low), L(ub2, vb2, low), L(ub, vb, patio - 0.06), L(ua, va, patio - 0.06), [[k * 1.22, low], [(k + 1) * 1.22, low], [(k + 1) * 1.22, patio], [k * 1.22, patio]]);
        // the cap
        const [uc, vc] = off(ua, va, 0.06), [ud, vd] = off(ub, vb, 0.06);
        facing(cap, s.n, L(uc, vc, patio - 0.07), L(ud, vd, patio - 0.07), L(ud, vd, patio + 0.005), L(uc, vc, patio + 0.005));
        facing(cap, [0, 1, 0], L(ua, va, patio + 0.005), L(ub, vb, patio + 0.005), L(ud, vd, patio + 0.005), L(uc, vc, patio + 0.005));
      }
      // a railing where the fall from the patio edge is more than half a metre
      if (patio - Math.max(ga, gb) > 0.5) {
        facing(rg, s.n, L(ua, va, patio + 0.06), L(ub, vb, patio + 0.06), L(ub, vb, patio + 0.95), L(ua, va, patio + 0.95));
        hr.tube(L(ua, va, patio + 0.99), L(ub, vb, patio + 0.99), 0.022, 8);
      }
    }
  }
}

/** Every house, merged per material; returns the geometries and the house order. */
export function buildExteriors(plots: Plot[], fits: HouseFit[], modules: number, groundAt: (x: number, y: number) => number) {
  const B = new Builders();
  plots.forEach((p, i) => {
    const fit = fits[i];
    B.attr("aHouse", [i]);
    B.attr("aMove", [0]);
    B.at(houseMatrix(p, fit.mirror));
    const f = (p.house.facing_deg * Math.PI) / 180;
    const ca = Math.cos(f), sa = Math.sin(f);
    const sgn = fit.mirror ? -1 : 1;
    const g: GroundFn = (u, v) => groundAt(p.local.x + sgn * u * ca + v * sa, p.local.y - sgn * u * sa + v * ca) - p.local.z_floor;
    buildHouseExterior(B, p, fit, i, g, modules);
    buildDownpipes(B, g, fit.lower, fit.lower && fit.patio_z !== null ? fit.patio_z - fit.floor_z : 0);
  });
  return B.geometries();
}
