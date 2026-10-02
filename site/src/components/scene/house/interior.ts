/**
 * The inside of one house, built when a visitor comes to it: the rooms of src/lib/house/plan.ts with
 * their floors, walls, ceilings, windows seen from inside, inner doors, the stair, every piece of
 * furniture and every installation, plus what the walk needs (floors, walls, doors, obstacles) and
 * where the lamps are (the light is worked out per vertex in lighting.ts).
 *
 * Built in the house's own frame (u, v, z above the main floor) through the kit's builders, placed
 * with houseMatrix(): everything lands in scene coordinates, mirrored houses included.
 */
import * as THREE from "three";
import type { Plot } from "@/lib/types";
import {
  HOUSE, ITEMS, OPENINGS, PARTITIONS, ROOMS, STAIR, keep, levelZ, stairBottom, vaultAt,
  type DoorSpec, type HouseFit, type Item, type Level, type Opening, type Partition, type Rect, type RoomId, type Side,
} from "@/lib/house/plan";
import { Builders, type Builder, type V3 } from "./kit";
import { houseMatrix } from "./frame";
import { FRAME, L, facing, holeOf } from "./exterior";
import { drawItem } from "./furniture";

const H = HOUSE;
const I = H.iw, J = H.id;

/** A wall for the walk: a segment in plan with its thickness and height; doors leave gaps. */
export type WalkWall = { level: Level | "both"; a: [number, number]; b: [number, number]; t: number; z0: number; z1: number; door?: string };
export type WalkBox = { level: Level; rect: Rect; z0: number; z1: number; kind: string };
export type WalkFloor = { level: Level; rect: Rect; z: number; room: RoomId | "outside" };
export type WalkStair = { u0: number; u1: number; v0: number; v1: number; z0: number; z1: number; axis: "u" | "v" };
export type Lamp = { u: number; v: number; z: number; power: number; kind: "down" | "point" | "pendant" | "wall"; room: RoomId; level: Level };
export type DoorPart = { id: string; level: Level; hinge: [number, number]; leafDir: [number, number]; w: number; into: 1 | -1; geo: Record<string, THREE.BufferGeometry>; z: number };
export type Hotspot = { id: string; u: number; v: number; z: number; level: Level; room: RoomId };

export type InteriorBuild = {
  geos: Record<string, THREE.BufferGeometry>;
  doors: DoorPart[];
  lamps: Lamp[];
  walls: WalkWall[];
  boxes: WalkBox[];
  floors: WalkFloor[];
  stairs: WalkStair[];
  hotspots: Hotspot[];
  lower: boolean;
};

/** Which face of a box in plan an inner surface belongs to, for picking floor colours by room. */
export function roomAt(u: number, v: number, level: Level, lower: boolean): RoomId | null {
  for (const r of ROOMS) {
    if (r.level !== level || (!lower && r.lowerOnly) || r.id === "stair") continue;
    if (u >= r.rect.u0 - 1e-3 && u <= r.rect.u1 + 1e-3 && v >= r.rect.v0 - 1e-3 && v <= r.rect.v1 + 1e-3) return r.id;
  }
  return null;
}

/** A grid quad facing `n` whatever order its corners come in. */
function gridFacing(b: Builder, n: V3, a: V3, bb: V3, c: V3, d: V3, cell = 0.3) {
  const e1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) b.grid(a, bb, c, d, cell); else b.grid(d, c, bb, a, cell);
}

/** Point on the inner face of an outer wall: s along the wall, z up, d from the inner face outwards. */
function innerPoint(side: Side, s: number, z: number, d = 0): V3 {
  switch (side) {
    case "front": return L(s, J + d, z);
    case "back": return L(s, -J - d, z);
    case "left": return L(-I - d, s, z);
    case "right": return L(I + d, s, z);
  }
}
const INWARD: Record<Side, V3> = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0] };

type Seg = { s0: number; s1: number; z0: number; z1: number };

/** An inner wall face with holes, split into strips at the hole edges, then gridded for the light. */
function innerWall(b: Builder, side: Side, s0: number, s1: number, z0: number, top: (s: number) => number, holes: Seg[], breaks: number[] = []) {
  const xs = new Set<number>([s0, s1, ...breaks.filter((x) => x > s0 && x < s1)]);
  for (const h of holes) { if (h.s0 > s0 && h.s0 < s1) xs.add(h.s0); if (h.s1 > s0 && h.s1 < s1) xs.add(h.s1); }
  const cuts = [...xs].sort((a, c) => a - c);
  const n = INWARD[side];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], c = cuts[i + 1];
    if (c - a < 1e-4) continue;
    const mid = (a + c) / 2;
    const spans = holes.filter((h) => h.s0 <= mid && h.s1 >= mid && h.z1 > z0).map((h) => [Math.max(z0, h.z0), h.z1]).sort((p, q) => p[0] - q[0]);
    let z = z0;
    for (const [h0, h1] of spans) {
      if (h0 > z + 1e-4) gridFacing(b, n, innerPoint(side, a, z), innerPoint(side, c, z), innerPoint(side, c, h0), innerPoint(side, a, h0));
      z = Math.max(z, h1);
    }
    const ta = top(a), tc = top(c);
    if (Math.max(ta, tc) > z + 1e-4) gridFacing(b, n, innerPoint(side, a, z), innerPoint(side, c, z), innerPoint(side, c, Math.max(z, tc)), innerPoint(side, a, Math.max(z, ta)));
  }
}

/** The faces of an opening's inner reveal: from the inner face back to the frame, and the window board. */
function innerReveal(B: Builders, o: Opening) {
  const side = o.side;
  const h = holeOf(o);
  const wall = B.get("wall");
  const d0 = 0, d1 = H.wall - (FRAME.at + FRAME.depth);   // from the inner face to the frame's back
  const P = (s: number, z: number, d: number) => innerPoint(side, s, z, d);
  const along: V3 = side === "front" || side === "back" ? [1, 0, 0] : [0, 0, -1];
  gridFacing(wall, along, P(h.s0, h.z0, d0), P(h.s0, h.z0, d1), P(h.s0, h.z1, d1), P(h.s0, h.z1, d0), 0.3);
  gridFacing(wall, [-along[0], -along[1], -along[2]], P(h.s1, h.z0, d0), P(h.s1, h.z0, d1), P(h.s1, h.z1, d1), P(h.s1, h.z1, d0), 0.3);
  gridFacing(wall, [0, -1, 0], P(h.s0, h.z1, d0), P(h.s1, h.z1, d0), P(h.s1, h.z1, d1), P(h.s0, h.z1, d1), 0.3);
  const door = o.kind === "entry" || o.kind === "slide" || o.kind === "garden";
  if (door) {
    // the floor runs out to the threshold
    const fl = B.get(o.level === "main" ? "oak" : "oak");
    gridFacing(fl, [0, 1, 0], P(h.s0, h.z0 + 0.002, d0), P(h.s1, h.z0 + 0.002, d0), P(h.s1, h.z0 + 0.002, d1), P(h.s0, h.z0 + 0.002, d1), 0.3);
  } else {
    // a window board of oak, 2 cm thick, standing 3 cm into the room
    const wb = B.get("oakwood").tint("#b88d5f");
    const a = P(h.s0 - 0.03, h.z0 - 0.02, -0.03), c = P(h.s1 + 0.03, h.z0, d1);
    wb.box(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2]));
  }
}

/** A box in the house frame (u, v, z ranges) into a builder. */
function hb(b: Builder, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, skip: string[] = []) {
  b.box(Math.min(u0, u1), Math.min(z0, z1), -Math.max(v0, v1), Math.max(u0, u1), Math.max(z0, z1), -Math.min(v0, v1), skip);
}

/** Ceiling height over a point of a level (the vault over the open front band of the main floor). */
export function ceilingAt(u: number, v: number, level: Level): number {
  void u;
  if (level === "lower") return H.lowerCeiling;
  return v > -1.1 ? vaultAt(v) : H.flat;
}

/**
 * The partition walls: both faces, the top, door openings with their frames (architraves) and leaves
 * (the leaves are DoorParts, drawn apart so they can swing).
 */
function partitions(B: Builders, lower: boolean, walls: WalkWall[], doors: DoorPart[], m: THREE.Matrix4, seed: number) {
  for (const p of PARTITIONS) {
    if (!keep(p, lower)) continue;
    const r = p.rect;
    const alongU = r.u1 - r.u0 > r.v1 - r.v0;
    const z0 = levelZ(p.level);
    const top = (s: number) => (p.level === "lower" ? H.lowerCeiling : alongU ? (r.v0 > -1.15 ? vaultAt(r.v1) : H.flat) : ceilingAt(0, s, "main"));
    // the wall's two long faces with the door openings cut out
    const holes: Seg[] = p.doors.map((d) => ({ s0: d.at - d.w / 2 - 0.0, s1: d.at + d.w / 2, z0, z1: z0 + 2.1 }));
    const wb = B.get(p.wet ? "tileWall" : "wall");
    const s0 = alongU ? r.u0 : r.v0, s1 = alongU ? r.u1 : r.v1;
    const faces: { c: number; n: V3 }[] = alongU ? [{ c: r.v0, n: [0, 0, 1] }, { c: r.v1, n: [0, 0, -1] }] : [{ c: r.u0, n: [-1, 0, 0] }, { c: r.u1, n: [1, 0, 0] }];
    for (const f of faces) {
      // which room this face looks into decides its finish (tiles only on the bathroom side)
      const probe = alongU ? roomAt((s0 + s1) / 2, f.c + (f.n[2] < 0 ? 0.05 : -0.05), p.level, lower) : roomAt(f.c + (f.n[0] > 0 ? 0.05 : -0.05), (s0 + s1) / 2, p.level, lower);
      const wet = probe === "bath" || probe === "bath2";
      const b = wet ? B.get("tileWall") : B.get("wall");
      void wb;
      const pt = (s: number, z: number): V3 => (alongU ? L(s, f.c, z) : L(f.c, s, z));
      const xs = [s0, s1, ...holes.flatMap((h) => [h.s0, h.s1])].filter((x) => x >= s0 && x <= s1).sort((a, c) => a - c);
      for (let i = 0; i < xs.length - 1; i++) {
        const a = xs[i], c = xs[i + 1];
        if (c - a < 1e-4) continue;
        const inDoor = holes.some((h) => h.s0 <= (a + c) / 2 && h.s1 >= (a + c) / 2);
        const zb = inDoor ? z0 + 2.1 : z0;
        const ta = top(a), tc = top(c);
        if (Math.max(ta, tc) - zb > 1e-3) gridFacing(b, f.n, pt(a, zb), pt(c, zb), pt(c, tc), pt(a, ta));
      }
    }
    // the door openings' linings, frames and leaves
    for (const d of p.doors) {
      const a = d.at - d.w / 2, c = d.at + d.w / 2;
      const lin = B.get("paintwood").tint("#f1efe9");
      const t0 = alongU ? r.v0 : r.u0, t1 = alongU ? r.v1 : r.u1;
      const box = (sa: number, sc: number, za: number, zc: number, ta: number, tb: number) => (alongU ? hb(lin, sa, sc, ta, tb, za, zc) : hb(lin, ta, tb, sa, sc, za, zc));
      // lining in the opening, and architraves 7 cm wide on both faces
      box(a, a + 0.02, z0, z0 + 2.1, t0, t1);
      box(c - 0.02, c, z0, z0 + 2.1, t0, t1);
      box(a, c, z0 + 2.08, z0 + 2.1, t0, t1);
      for (const [ta, tb] of [[t0 - 0.012, t0], [t1, t1 + 0.012]]) {
        box(a - 0.07, a, z0, z0 + 2.17, ta, tb);
        box(c, c + 0.07, z0, z0 + 2.17, ta, tb);
        box(a - 0.07, c + 0.07, z0 + 2.1, z0 + 2.17, ta, tb);
      }
      doors.push(doorLeaf(d, p, alongU, z0, m, seed));
      walls.push({ level: p.level, a: alongU ? [a, (t0 + t1) / 2] : [(t0 + t1) / 2, a], b: alongU ? [c, (t0 + t1) / 2] : [(t0 + t1) / 2, c], t: t1 - t0, z0, z1: z0 + 2.1, door: d.id });
    }
    // for the walk: the solid parts of the wall
    const cuts = [s0, ...p.doors.flatMap((d) => [d.at - d.w / 2, d.at + d.w / 2]), s1].sort((a, c) => a - c);
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i], c = cuts[i + 1];
      if (c === undefined || c - a < 0.01) continue;
      const mid = alongU ? (r.v0 + r.v1) / 2 : (r.u0 + r.u1) / 2;
      walls.push({ level: p.level, a: alongU ? [a, mid] : [mid, a], b: alongU ? [c, mid] : [mid, c], t: alongU ? r.v1 - r.v0 : r.u1 - r.u0, z0, z1: z0 + 2.5 });
    }
  }
}

/** A door leaf (white, 40 mm, a lever handle on both faces), built at the origin of its own pivot. */
function doorLeaf(d: DoorSpec, p: Partition, alongU: boolean, z0: number, m: THREE.Matrix4, seed: number): DoorPart {
  const r = p.rect;
  const mid = alongU ? (r.v0 + r.v1) / 2 : (r.u0 + r.u1) / 2;
  const a = d.at - d.w / 2, c = d.at + d.w / 2;
  const hingeS = d.hinge === "lo" ? a + 0.02 : c - 0.02;
  const hinge: [number, number] = alongU ? [hingeS, mid] : [mid, hingeS];
  const leafDir: [number, number] = alongU ? [d.hinge === "lo" ? 1 : -1, 0] : [0, d.hinge === "lo" ? 1 : -1];
  // the leaf in its own frame: x along the leaf from the hinge, z across (thickness), y up
  const B = new Builders();
  B.at(new THREE.Matrix4());
  const w = d.w - 0.04;
  const leaf = B.get("paintwood").tint("#f4f2ee");
  leaf.box(0.004, 0.01, -0.02, w - 0.004, 2.07, 0.02);
  const met = B.get("chrome").tint("#c9ccce");
  const hx = w - 0.08;
  for (const zz of [-0.028, 0.028]) {
    const sgn = zz < 0 ? -1 : 1;
    met.box(hx - 0.012, 1.0, zz - 0.004 * sgn, hx + 0.012, 1.06, zz + 0.004 * sgn);
    met.box(hx - 0.13, 1.025, zz + sgn * 0.004, hx + 0.012, 1.045, zz + sgn * 0.022);
  }
  void seed;
  return { id: d.id, level: p.level, hinge, leafDir, w, into: d.into, geo: B.geometries(), z: z0 };
  void m;
}

/** The stair from the hall down to the lower floor: oak treads, white risers, a glass railing. */
function stair(B: Builders, walls: WalkWall[], stairs: WalkStair[]) {
  const oak = B.get("oak");
  const paint = B.get("paintwood").tint("#f1efe9");
  const { u0, u1, top, risers, rise, tread } = STAIR;
  const bottom = stairBottom();
  for (let k = 0; k < risers - 1; k++) {
    // tread k (counting from the top): its nosing at top + k * tread, its height one rise lower
    const z = -(k + 1) * rise;
    const va = top + k * tread, vb = va + tread;
    gridFacing(oak, [0, 1, 0], L(u0, va - 0.02, z), L(u1, va - 0.02, z), L(u1, vb, z), L(u0, vb, z), 0.25);
    hb(oak, u0, u1, va - 0.02, vb, z - 0.04, z - 0.001, ["py"]);
    // the riser above the tread
    gridFacing(paint, [0, 0, 1], L(u0, va, z), L(u1, va, z), L(u1, va, z + rise), L(u0, va, z + rise), 0.3);
  }
  // the last riser down onto the lower floor
  gridFacing(paint, [0, 0, 1], L(u0, bottom, H.lower), L(u1, bottom, H.lower), L(u1, bottom, H.lower + rise), L(u0, bottom, H.lower + rise), 0.3);
  // the shaft's walls under the main floor (concrete, painted), its back wall, and the soffit of the hall floor over the stair's foot
  const wall = B.get("wall");
  for (const [u, n] of [[u0, [1, 0, 0]], [u1, [-1, 0, 0]]] as [number, V3][]) {
    gridFacing(wall, n, L(u, top - 0.1, H.lower), L(u, H.lowerBack + H.wall, H.lower), L(u, H.lowerBack + H.wall, -0.3), L(u, top - 0.1, -0.3), 0.3);
  }
  gridFacing(wall, [0, 0, -1], L(u0, top - 0.1, H.lower), L(u1, top - 0.1, H.lower), L(u1, top - 0.1, -0.3), L(u0, top - 0.1, -0.3), 0.3);
  gridFacing(B.get("ceiling"), [0, -1, 0], L(u0, STAIR.openTo, -0.3), L(u1, STAIR.openTo, -0.3), L(u1, H.lowerBack + H.wall, -0.3), L(u0, H.lowerBack + H.wall, -0.3), 0.3);
  // the edge of the hall floor round the opening (the floor's thickness)
  const edge = B.get("paintwood").tint("#ebe8e2");
  hb(edge, u0 - 0.04, u0, top, STAIR.openTo, -0.3, 0.0);
  hb(edge, u0, u1, STAIR.openTo, STAIR.openTo + 0.04, -0.3, 0.0);
  // the glass railing round the opening on the open sides (0.9 m in a stair, 1.0 m round the opening)
  const glass = B.get("glass");
  const rail = B.get("oakwood").tint("#b48a5c");
  const railV = (u: number, va: number, vb: number, za: number, zb: number) => {
    facing(glass, [1, 0, 0], L(u, va, za + 0.05), L(u, vb, zb + 0.05), L(u, vb, zb + 0.93), L(u, va, za + 0.93));
    const a = L(u, va, za + 0.98), b = L(u, vb, zb + 0.98);
    rail.tube(a, b, 0.024, 8);
  };
  railV(u0 - 0.06, top, STAIR.openTo, 0, 0);
  // round the end of the opening, in the living room
  facing(glass, [0, 0, -1], L(u0 - 0.06, STAIR.openTo + 0.06, 0.05), L(u1 + 0.06, STAIR.openTo + 0.06, 0.05), L(u1 + 0.06, STAIR.openTo + 0.06, 0.98), L(u0 - 0.06, STAIR.openTo + 0.06, 0.98));
  rail.tube(L(u0 - 0.06, STAIR.openTo + 0.06, 1.02), L(u1 + 0.06, STAIR.openTo + 0.06, 1.02), 0.024, 8);
  railV(u1 + 0.06, -1.1, STAIR.openTo + 0.06, 0, 0);
  rail.tube(L(u1 + 0.06, -1.1, 1.02), L(u1 + 0.06, STAIR.openTo + 0.06, 1.02), 0.024, 8);
  // a handrail on the wall side, 0.9 m over the nosings, all the way down
  const hr = B.get("oakwood").tint("#b48a5c");
  hr.tube(L(u1 - 0.07, top, 0.9), L(u1 - 0.07, bottom, H.lower + 0.9), 0.022, 8);
  for (const t of [0.1, 0.5, 0.9]) {
    const v = top + (bottom - top) * t, z = H.lower * t + 0.9;
    B.get("chrome").tint("#b9bcbe").tube(L(u1 - 0.07, v, z - 0.01), L(u1 - 0.005, v, z - 0.05), 0.008, 6);
  }
  // for the walk: the stair as a ramp, its railings as walls
  stairs.push({ u0, u1, v0: top, v1: bottom, z0: 0, z1: H.lower, axis: "v" });
  walls.push({ level: "main", a: [u0 - 0.06, top], b: [u0 - 0.06, STAIR.openTo + 0.06], t: 0.06, z0: -3, z1: 1.0 });
  walls.push({ level: "main", a: [u0 - 0.06, STAIR.openTo + 0.06], b: [u1 + 0.06, STAIR.openTo + 0.06], t: 0.06, z0: -0.5, z1: 1.0 });
  walls.push({ level: "main", a: [u1 + 0.06, -1.1], b: [u1 + 0.06, STAIR.openTo + 0.06], t: 0.06, z0: -0.5, z1: 1.0 });
}

/**
 * Build the inside of one house. Returns the meshes per material (with the light per vertex still to
 * be added, see lighting.ts), the inner doors, the lamps, and the walk's floors, walls and obstacles.
 */
export function buildInterior(p: Plot, fit: HouseFit, index: number): InteriorBuild {
  const lower = fit.lower;
  const B = new Builders();
  const m = houseMatrix(p, fit.mirror);
  B.at(m);
  const walls: WalkWall[] = [], boxes: WalkBox[] = [], floors: WalkFloor[] = [], stairs: WalkStair[] = [], doors: DoorPart[] = [], lamps: Lamp[] = [], hotspots: Hotspot[] = [];
  const seed = index * 0.618;
  const openings = OPENINGS.filter((o) => keep(o, lower));

  // ---------------- floors, room by room (the stair opening left out of the hall and the living room)
  const floorKey = (r: { floor: string }) => (r.floor === "oak" ? "oak" : r.floor === "tile" ? "tileFloor" : "stoneFloor");
  const sOpen = { u0: STAIR.u0 - 0.06, u1: STAIR.u1 + 0.06, v0: STAIR.top, v1: STAIR.openTo + 0.06 };
  for (const r of ROOMS) {
    if (!keep(r, lower) || r.id === "stair") continue;
    const z = levelZ(r.level);
    const rects: Rect[] = [];
    if (lower && r.level === "main" && (r.id === "hall" || r.id === "living")) {
      // cut the opening out of the rectangle: up to four pieces round it
      const R = r.rect, o = sOpen;
      const v0 = Math.max(R.v0, o.v0), v1 = Math.min(R.v1, o.v1);
      if (v1 > v0) {
        if (o.u0 > R.u0) rects.push({ u0: R.u0, u1: o.u0, v0: R.v0, v1: R.v1 });
        if (o.u1 < R.u1) rects.push({ u0: o.u1, u1: R.u1, v0: R.v0, v1: R.v1 });
        if (v0 > R.v0) rects.push({ u0: o.u0, u1: o.u1, v0: R.v0, v1: v0 });
        if (v1 < R.v1) rects.push({ u0: o.u0, u1: o.u1, v0: v1, v1: R.v1 });
      } else rects.push(R);
    } else rects.push(r.rect);
    const fb = B.get(floorKey(r));
    if (r.floor === "stone") fb.tint("#6d6a66"); else if (r.floor === "tile") fb.tint(r.id === "bath" || r.id === "bath2" ? "#77797a" : "#8a8a86");
    for (const R of rects) {
      gridFacing(fb, [0, 1, 0], L(R.u0, R.v0, z), L(R.u1, R.v0, z), L(R.u1, R.v1, z), L(R.u0, R.v1, z), 0.25);
      floors.push({ level: r.level, rect: R, z, room: r.id });
    }
  }
  // for the walk, each level is one floor wall to wall (the walls and furniture stop the feet, not gaps
  // in the floor), the main floor with the stair's opening left out
  {
    const base = (z: number, level: Level, R: Rect) => floors.push({ level, rect: R, z, room: level === "main" ? "living" : "family" });
    if (lower) {
      const o = sOpen;
      base(0, "main", { u0: -I, u1: o.u0, v0: -J, v1: J });
      base(0, "main", { u0: o.u1, u1: I, v0: -J, v1: J });
      base(0, "main", { u0: o.u0, u1: o.u1, v0: -J, v1: o.v0 });
      base(0, "main", { u0: o.u0, u1: o.u1, v0: o.v1, v1: J });
      base(H.lower, "lower", { u0: -I, u1: I, v0: H.lowerBack + H.wall, v1: J });
    } else base(0, "main", { u0: -I, u1: I, v0: -J, v1: J });
  }
  // the floor runs on under the partitions and into the door openings (no gaps in the floor's light)
  for (const p0 of PARTITIONS) {
    if (!keep(p0, lower)) continue;
    const z = levelZ(p0.level);
    const r = p0.rect;
    for (const d of p0.doors) {
      const alongU = r.u1 - r.u0 > r.v1 - r.v0;
      const R: Rect = alongU ? { u0: d.at - d.w / 2, u1: d.at + d.w / 2, v0: r.v0, v1: r.v1 } : { u0: r.u0, u1: r.u1, v0: d.at - d.w / 2, v1: d.at + d.w / 2 };
      const room = ROOMS.find((x) => x.id === d.room)!;
      gridFacing(B.get(floorKey(room)), [0, 1, 0], L(R.u0, R.v0, z + 0.001), L(R.u1, R.v0, z + 0.001), L(R.u1, R.v1, z + 0.001), L(R.u0, R.v1, z + 0.001), 0.25);
      floors.push({ level: p0.level, rect: R, z, room: d.room });
    }
  }

  // ---------------- ceilings: flat over the back band and the lower floor, the vault over the front band
  const ceil = B.get("ceiling");
  gridFacing(ceil, [0, -1, 0], L(-I, -J, H.flat), L(I, -J, H.flat), L(I, -1.1, H.flat), L(-I, -1.1, H.flat), 0.35);
  // the vault: two slopes meeting under the ridge
  gridFacing(ceil, [0, -1, 0], L(-I, -1.1, vaultAt(-1.1)), L(I, -1.1, vaultAt(-1.1)), L(I, 0, vaultAt(0)), L(-I, 0, vaultAt(0)), 0.35);
  gridFacing(ceil, [0, -1, 0], L(-I, 0, vaultAt(0)), L(I, 0, vaultAt(0)), L(I, J, vaultAt(J)), L(-I, J, vaultAt(J)), 0.35);
  // the bulkhead where the flat ceiling meets the vault
  gridFacing(B.get("wall"), [0, 0, -1], L(-I, -1.1, H.flat), L(I, -1.1, H.flat), L(I, -1.1, vaultAt(-1.1)), L(-I, -1.1, vaultAt(-1.1)), 0.35);
  // the glulam ridge beam under the ridge
  hb(B.get("oakwood").tint("#c9a274"), -I, I, -0.07, 0.07, vaultAt(0.07) - 0.36, vaultAt(0) + 0.01);
  if (lower) {
    gridFacing(ceil, [0, -1, 0], L(-I, H.lowerBack + H.wall, H.lowerCeiling), L(I, H.lowerBack + H.wall, H.lowerCeiling), L(I, J, H.lowerCeiling), L(-I, J, H.lowerCeiling), 0.35);
  }

  // ---------------- the outer walls from inside, with their openings and reveals
  const wall = B.get("wall");
  const holesOn = (side: Side, level: Level): Seg[] => openings.filter((o) => o.side === side && o.level === level).map((o) => { const h = holeOf(o); return { s0: h.s0, s1: h.s1, z0: h.z0, z1: h.z1 }; });
  for (const side of ["front", "back", "left", "right"] as Side[]) {
    const e = side === "front" || side === "back" ? I : J;
    // main floor: up to the flat ceiling at the back, to the vault in front (the gables are pentagons there)
    const topMain = (s: number) => (side === "back" ? H.flat : side === "front" ? vaultAt(J) : s > -1.1 ? vaultAt(s) : H.flat);
    const holes = holesOn(side, "main");
    if (side === "left" || side === "right") {
      // the gable: the back band to the flat ceiling, the front band to the vault
      innerWall(wall, side, -e, -1.1, 0, () => H.flat, holes);
      innerWall(wall, side, -1.1, e, 0, (s) => vaultAt(s), holes, [0]);
    } else innerWall(wall, side, -e, e, 0, topMain, holes);
    if (lower && (side !== "back")) {
      const s0 = side === "front" ? -I : H.lowerBack + H.wall;
      innerWall(wall, side, s0, side === "front" ? I : J, H.lower, () => H.lowerCeiling, holesOn(side, "lower"));
    }
  }
  if (lower) {
    // the lower floor's back wall (cast against the ground), facing the rooms, with the opening to the stair shaft
    const v = H.lowerBack + H.wall;
    for (const [a, b] of [[-I, STAIR.u0], [STAIR.u1, I]]) gridFacing(wall, [0, 0, -1], L(a, v, H.lower), L(b, v, H.lower), L(b, v, H.lowerCeiling), L(a, v, H.lowerCeiling));
  }
  for (const o of openings) innerReveal(B, o);

  // ---------------- partitions, inner doors, the stair
  partitions(B, lower, walls, doors, m, seed);
  if (lower) stair(B, walls, stairs);

  // skirting boards along the walls of every room (12 mm proud, 6 cm high)
  const skirt = B.get("paintwood").tint("#f1efe9");
  for (const r of ROOMS) {
    if (!keep(r, lower) || r.id === "stair") continue;
    const z = levelZ(r.level), R = r.rect;
    const doorGaps = (side: "u0" | "u1" | "v0" | "v1") => {
      const gaps: [number, number][] = [];
      for (const p0 of PARTITIONS) for (const d of p0.doors) if (keep(p0, lower) && (d.room === r.id || roomOfOtherSide(p0, d) === r.id)) gaps.push([d.at - d.w / 2 - 0.07, d.at + d.w / 2 + 0.07]);
      for (const o of openings) if (o.room === r.id && (o.kind === "entry" || o.kind === "slide" || o.kind === "garden")) gaps.push([o.c - o.w / 2, o.c + o.w / 2]);
      void side;
      return gaps;
    };
    const runs = (a: number, b: number, gaps: [number, number][]) => {
      let cur = a;
      const out: [number, number][] = [];
      for (const [g0, g1] of gaps.sort((x, y) => x[0] - y[0])) { if (g1 <= cur || g0 >= b) continue; if (g0 > cur) out.push([cur, g0]); cur = Math.max(cur, g1); }
      if (cur < b) out.push([cur, b]);
      return out;
    };
    for (const [s0, s1] of runs(R.u0, R.u1, doorGaps("v0"))) hb(skirt, s0, s1, R.v0, R.v0 + 0.012, z, z + 0.06);
    for (const [s0, s1] of runs(R.u0, R.u1, doorGaps("v1"))) hb(skirt, s0, s1, R.v1 - 0.012, R.v1, z, z + 0.06);
    for (const [s0, s1] of runs(R.v0, R.v1, doorGaps("u0"))) hb(skirt, R.u0, R.u0 + 0.012, s0, s1, z, z + 0.06);
    for (const [s0, s1] of runs(R.v0, R.v1, doorGaps("u1"))) hb(skirt, R.u1 - 0.012, R.u1, s0, s1, z, z + 0.06);
  }

  // ---------------- the outer walls for the walk, with the doors to the outside as gaps
  const wallRun = (side: Side, level: Level, z0: number, z1: number) => {
    const doorsOut = openings.filter((o) => o.side === side && o.level === level && (o.kind === "entry" || o.kind === "slide" || o.kind === "garden"));
    const e = side === "front" || side === "back" ? H.hw : H.hd;
    const cuts: [number, number][] = [];
    let cur = -e;
    for (const o of doorsOut.sort((a, b) => a.c - b.c)) {
      const g0 = o.c - o.w / 2 + 0.07, g1 = o.c + o.w / 2 - 0.07;
      // a sliding door opens on half its width (the right-hand sash)
      const open0 = o.kind === "entry" ? g0 : o.c;
      cuts.push([cur, open0]);
      cur = g1;
      walls.push({ level, a: pointOn(side, (open0 + g1) / 2 - 0.0001), b: pointOn(side, (open0 + g1) / 2 + 0.0001), t: 0, z0, z1, door: o.id });
    }
    cuts.push([cur, e]);
    for (const [a, b] of cuts) walls.push({ level, a: pointOn(side, a), b: pointOn(side, b), t: H.wall, z0, z1 });
  };
  const pointOn = (side: Side, s: number): [number, number] => {
    const c = H.wall / 2;
    return side === "front" ? [s, H.hd - c] : side === "back" ? [s, -H.hd + c] : side === "left" ? [-H.hw + c, s] : [H.hw - c, s];
  };
  for (const side of ["front", "back", "left", "right"] as Side[]) wallRun(side, "main", -0.3, 3.2);
  if (lower) {
    wallRun("front", "lower", H.lower - 0.3, H.lowerCeiling);
    walls.push({ level: "lower", a: [-H.hw, H.lowerBack + H.wall / 2], b: [STAIR.u0, H.lowerBack + H.wall / 2], t: H.wall, z0: H.lower - 0.3, z1: H.lowerCeiling });
    walls.push({ level: "lower", a: [STAIR.u1, H.lowerBack + H.wall / 2], b: [H.hw, H.lowerBack + H.wall / 2], t: H.wall, z0: H.lower - 0.3, z1: H.lowerCeiling });
    for (const s of [-1, 1]) walls.push({ level: "lower", a: [s * (H.hw - H.wall / 2), H.lowerBack], b: [s * (H.hw - H.wall / 2), H.hd], t: H.wall, z0: H.lower - 0.3, z1: H.lowerCeiling });
  }

  // ---------------- furniture, fixtures and installations
  for (const item of ITEMS) {
    if (!keep(item, lower)) continue;
    const r = drawItem(B, item, m, seed, lower, fit.mirror);
    if (r.lamp) lamps.push(...r.lamp);
    if (r.box) boxes.push(r.box);
    if (item.id) hotspots.push({ id: item.id, u: item.at[0], v: item.at[1], z: levelZ(item.level) + (r.hotZ ?? item.size[2] + (item.z ?? 0) + 0.15), level: item.level, room: item.room });
  }
  // the house's heat comes up through the floors: an underfloor-heating hotspot in the living room, and the windows
  hotspots.push({ id: "floorheat", u: 1.6, v: 2.9, z: 0.25, level: "main", room: "living" });
  hotspots.push({ id: "windows", u: 1.1, v: J - 0.15, z: 1.6, level: "main", room: "living" });
  hotspots.push({ id: "wall", u: -3.7, v: J - 0.1, z: 2.55, level: "main", room: "living" });

  return { geos: B.geometries(), doors, lamps, walls, boxes, floors, stairs, hotspots, lower };
}

/** The room on the other side of a door in a partition (the room it does not open into). */
function roomOfOtherSide(p: Partition, d: DoorSpec): RoomId | null {
  const r = p.rect;
  const alongU = r.u1 - r.u0 > r.v1 - r.v0;
  const lower = true;
  const probe = (off: number) => (alongU ? roomAt(d.at, (r.v0 + r.v1) / 2 + off, p.level, lower) : roomAt((r.u0 + r.u1) / 2 + off, d.at, p.level, lower));
  const a = probe(-0.15), b = probe(0.15);
  return a === d.room ? b : a;
}

/** The items whose footprint is an obstacle for walking (low things like rugs are not). */
export function isObstacle(it: Item) {
  return !["rug", "pendant", "downlight", "smoke", "art", "mirror", "energyscreen", "thermostat", "hooks", "shelf", "towelrail", "tv", "inverter", "ventunit", "fusebox", "manifold", "drain", "brine", "extinguisher"].includes(it.kind) && !it.ceil;
}
