/**
 * Walking: where a visitor on foot can stand, what stops them, and how to get somewhere.
 *
 * Around the house being visited everything is in its own frame (u, v, z above the main floor):
 * the floors of its rooms, the stair (a ramp for the feet; the eye sees the steps), the terrace,
 * the entrance landing and steps, the terrace stair and the patio, with the graded terrain round
 * them. Walls stop the visitor except where a door stands open; furniture and railings stop them
 * too. The other houses are solid boxes. A click on a floor finds a way there over a grid of
 * 20 cm cells, through doors and down stairs.
 */
import type { Plot } from "@/lib/types";
import { HOUSE, OPENINGS, type HouseFit, type Level, type RoomId } from "@/lib/house/plan";
import { fromScene, toLocal } from "./frame";
import type { Rect } from "@/lib/house/plan";
import { roomAt, type InteriorBuild, type WalkBox, type WalkFloor, type WalkStair, type WalkWall } from "./interior";
import { terraceStair, type GroundFn } from "./exterior";

export const BODY = { r: 0.24, eye: 1.62, step: 0.42, maxSlope: 0.95 };

export type Surface = { z: number; kind: "floor" | "stair" | "ground" };

export type WalkWorld = {
  plot: Plot; fit: HouseFit; index: number;
  floors: WalkFloor[]; stairs: WalkStair[]; walls: WalkWall[]; boxes: WalkBox[];
  ground: GroundFn;
  /** the other houses near this one: each a solid box (footprint and terrace) in its own frame */
  others: { q: Plot; mirror: boolean }[];
  lower: boolean;
};

/** The outdoor parts of a house a visitor can walk on: terrace, landing, steps, the terrace stair, the patio. */
export function outdoorWalk(fit: HouseFit, g: GroundFn) {
  const floors: WalkFloor[] = [], stairs: WalkStair[] = [], walls: WalkWall[] = [];
  const H = HOUSE;
  const u0 = -H.hw + H.terraceInset, u1 = H.hw - H.terraceInset;
  const v0 = H.hd, v1 = H.hd + H.terraceDepth, top = -0.03;
  floors.push({ level: "main", rect: { u0, u1, v0, v1 }, z: top, room: "outside" });
  const stairAt = u1 - 1.0;
  // the terrace railing (front up to the stair opening, and both sides)
  walls.push({ level: "both", a: [u0, v1 - 0.05], b: [stairAt, v1 - 0.05], t: 0.06, z0: top - 0.3, z1: top + 1.0 });
  walls.push({ level: "both", a: [u0 + 0.05, v0], b: [u0 + 0.05, v1], t: 0.06, z0: top - 0.3, z1: top + 1.0 });
  walls.push({ level: "both", a: [u1 - 0.05, v0], b: [u1 - 0.05, v1], t: 0.06, z0: top - 0.3, z1: top + 1.0 });
  const patio = fit.lower && fit.patio_z !== null ? fit.patio_z - fit.floor_z : 0;
  const st = terraceStair(fit.lower, patio, g, top, stairAt, u1, v1);
  if (st.landing) {
    const l = st.landing;
    floors.push({ level: "main", rect: { u0: l.u0, u1: l.u1, v0: l.v0, v1: l.v1 }, z: top, room: "outside" });
    walls.push({ level: "both", a: [l.u0, l.v1 - 0.03], b: [l.u1, l.v1 - 0.03], t: 0.06, z0: top - 0.3, z1: top + 1.0 });
    walls.push({ level: "both", a: [l.u1 - 0.03, l.v0], b: [l.u1 - 0.03, l.v1], t: 0.06, z0: top - 0.3, z1: top + 1.0 });
  }
  const boxes: WalkBox[] = [];
  for (const f of st.flights) {
    const run = (f.n - (f.du === 0 ? 0 : 1)) * f.tread;
    const zEnd = f.z - f.n * f.rise;
    const lvl: Level = fit.lower ? "lower" : "main";
    const parts = 6;
    for (let k = 1; k < parts; k++) {
      // part k of the flight, from its low end: blocks whoever is below its treads
      const zt = zEnd + ((f.z - zEnd) * k) / parts;
      if (f.du === 0) { const v0s = f.v + run - (run * (k + 1)) / parts, v1s = f.v + run - (run * k) / parts; boxes.push({ level: lvl, rect: { u0: f.u - f.w / 2, u1: f.u + f.w / 2, v0: v0s, v1: v1s }, z0: zEnd - 1, z1: zt - 0.05, kind: "stair" }); }
      else { const a = f.u - run + (run * k) / parts, b = f.u - run + (run * (k + 1)) / parts; boxes.push({ level: lvl, rect: { u0: a, u1: b, v0: f.v - f.w / 2, v1: f.v + f.w / 2 }, z0: zEnd - 1, z1: zt - 0.05, kind: "stair" }); }
    }
    if (f.du === 0) stairs.push({ u0: f.u - f.w / 2, u1: f.u + f.w / 2, v0: f.v, v1: f.v + run, z0: f.z, z1: zEnd, axis: "v" });
    else {
      stairs.push({ u0: f.u - run, u1: f.u, v0: f.v - f.w / 2, v1: f.v + f.w / 2, z0: zEnd, z1: f.z, axis: "u" });
      // the railing on the open side of the flight, and the terrace edge on the other
      walls.push({ level: "both", a: [f.u - run, f.v + f.w / 2], b: [f.u, f.v + f.w / 2], t: 0.06, z0: zEnd - 0.3, z1: f.z + 1.0 });
    }
  }
  if (fit.lower) {
    floors.push({ level: "lower", rect: { u0: -H.hw - H.patioSide, u1: H.hw + H.patioSide, v0: H.hd, v1: H.hd + H.patioDepth }, z: patio, room: "outside" });
    // the terrace's posts and its stair stand on the patio
    for (let k = 0; k <= 4; k++) {
      const u = u0 + 0.12 + (k * (u1 - u0 - 0.24)) / 4;
      walls.push({ level: "both", a: [u, v1 - 0.14], b: [u, v1 - 0.14], t: 0.12, z0: patio - 0.1, z1: top - 0.7 });
    }
  }
  // the entrance landing and its steps down to the path round the house
  const door = OPENINGS.find((o) => o.kind === "entry")!;
  const c = door.c, lv0 = -H.hd - 1.5, lv1 = -H.hd;
  floors.push({ level: "main", rect: { u0: c - 1.0, u1: c + 1.0, v0: lv0, v1: lv1 }, z: -0.02, room: "outside" });
  const groundAt = Math.min(g(c - 1, lv0), g(c + 1, lv0), g(c, lv0 - 0.9));
  const n = Math.max(0, Math.round((-0.02 - groundAt) / 0.18));
  if (n > 0) stairs.push({ u0: c - 0.8, u1: c + 0.8, v0: lv0 - n * 0.3, v1: lv0, z0: groundAt, z1: -0.02, axis: "v" });
  return { floors, stairs, walls, boxes };
}

/** Height of a ramp at a point (the stair's line from its low end to its high end), or null outside it. */
function rampAt(s: WalkStair, u: number, v: number): number | null {
  if (u < s.u0 - 0.01 || u > s.u1 + 0.01 || v < s.v0 - 0.01 || v > s.v1 + 0.01) return null;
  // the indoor stair runs from z0 at v0 (top) to z1 at v1; outdoor ones may run either way
  const t = s.axis === "v" ? (v - s.v0) / Math.max(1e-6, s.v1 - s.v0) : (u - s.u0) / Math.max(1e-6, s.u1 - s.u0);
  return s.z0 + (s.z1 - s.z0) * Math.min(1, Math.max(0, t));
}

/** Every surface a foot could stand on at (u, v), in the house frame. */
export function surfacesAt(w: WalkWorld, u: number, v: number): Surface[] {
  const out: Surface[] = [];
  for (const f of w.floors) if (u >= f.rect.u0 - 0.01 && u <= f.rect.u1 + 0.01 && v >= f.rect.v0 - 0.01 && v <= f.rect.v1 + 0.01) out.push({ z: f.z, kind: "floor" });
  for (const s of w.stairs) { const z = rampAt(s, u, v); if (z !== null) out.push({ z, kind: "stair" }); }
  // inside the footprint there is no ground to stand on: only the house's floors
  const inFoot = Math.abs(u) < HOUSE.hw && Math.abs(v) < HOUSE.hd;
  if (!inFoot) out.push({ z: w.ground(u, v), kind: "ground" });
  return out;
}

/** The surface the feet stand on: the highest one within a step above the feet (or the next one down). */
export function standOn(w: WalkWorld, u: number, v: number, feet: number): Surface | null {
  const all = surfacesAt(w, u, v);
  let best: Surface | null = null;
  for (const s of all) if (s.z <= feet + BODY.step && (!best || s.z > best.z)) best = s;
  return best;
}

/** True if a wall (or an open door's gap) blocks the body at (u, v) at this height. */
function wallActive(wl: WalkWall, feet: number, doors: Map<string, number>) {
  if (wl.door && (doors.get(wl.door) ?? 0) > 0.6) return false;
  return wl.z1 > feet + 0.25 && wl.z0 < feet + 1.7;
}

/** A wall's rectangle in plan (walls here run along u or v), worked out once per wall. */
const wallRects = new WeakMap<WalkWall, Rect>();
function wallRect(wl: WalkWall): Rect {
  let r = wallRects.get(wl);
  if (!r) {
    const t = wl.t / 2;
    const horizontal = Math.abs(wl.b[0] - wl.a[0]) >= Math.abs(wl.b[1] - wl.a[1]);
    const u0 = Math.min(wl.a[0], wl.b[0]), u1 = Math.max(wl.a[0], wl.b[0]), v0 = Math.min(wl.a[1], wl.b[1]), v1 = Math.max(wl.a[1], wl.b[1]);
    r = horizontal ? { u0, u1, v0: v0 - t, v1: v1 + t } : { u0: u0 - t, u1: u1 + t, v0, v1 };
    wallRects.set(wl, r);
  }
  return r;
}

/** A body of radius r at (x, y) pushed clear of a rectangle. */
function pushOut(x: number, y: number, R: Rect, r: number): [number, number] {
  const cx = Math.max(R.u0, Math.min(R.u1, x)), cy = Math.max(R.v0, Math.min(R.v1, y));
  const ex = x - cx, ey = y - cy, d = Math.hypot(ex, ey);
  if (d >= r) return [x, y];
  if (d > 1e-6) return [cx + (ex / d) * r, cy + (ey / d) * r];
  // inside: out by the nearest side
  const m = [x - R.u0, R.u1 - x, y - R.v0, R.v1 - y];
  const k = m.indexOf(Math.min(...m));
  return k === 0 ? [R.u0 - r, y] : k === 1 ? [R.u1 + r, y] : k === 2 ? [x, R.v0 - r] : [x, R.v1 + r];
}

/** Push a body at (u, v) out of the walls, furniture and other houses; returns the corrected point. */
export function collide(w: WalkWorld, u: number, v: number, feet: number, doors: Map<string, number>): [number, number] {
  let x = u, y = v;
  const r = BODY.r;
  const u0 = -HOUSE.hw - r, u1 = HOUSE.hw + r, v0 = -HOUSE.hd - r, v1 = HOUSE.hd + HOUSE.terraceDepth + r;
  // the farthest corner of another house's box from its plot's centre
  const reach2 = Math.max(u1, -u0) ** 2 + Math.max(v1, -v0) ** 2;
  for (let pass = 0; pass < 3; pass++) {
    const x0 = x, y0 = y;
    for (const wl of w.walls) {
      if (!wallActive(wl, feet, doors)) continue;
      // the wall as a rectangle in plan: its length along a-b, its thickness across
      [x, y] = pushOut(x, y, wallRect(wl), r);
    }
    for (const b of w.boxes) {
      if (b.z1 < feet + 0.25 || b.z0 > feet + 1.7) continue;
      [x, y] = pushOut(x, y, b.rect, r - 0.04);
    }
    let l = toLocal(w.plot, w.fit.mirror, x, y);
    for (const o of w.others) {
      // too far from that house to touch it
      const ex = l.x - o.q.local.x, ey = l.y - o.q.local.y;
      if (ex * ex + ey * ey > reach2) continue;
      // into the other house's own frame, out of its box, and back
      const q = fromScene(o.q, o.mirror, l.x, 0, -l.y);
      if (q.u > u0 && q.u < u1 && q.v > v0 && q.v < v1) {
        const m = [q.u - u0, u1 - q.u, q.v - v0, v1 - q.v];
        const k = m.indexOf(Math.min(...m));
        const nu = k === 0 ? u0 : k === 1 ? u1 : q.u, nv = k === 2 ? v0 : k === 3 ? v1 : q.v;
        const back = toLocal(o.q, o.mirror, nu, nv);
        const here = fromScene(w.plot, w.fit.mirror, back.x, 0, -back.y);
        x = here.u; y = here.v;
        l = toLocal(w.plot, w.fit.mirror, x, y);
      }
    }
    // a pass that moved nothing: the body stands clear
    if (x === x0 && y === y0) break;
  }
  return [x, y];
}

/** The room (or outside) at a point of the visited house, and the level the feet are on. */
export function placeOf(w: WalkWorld, u: number, v: number, feet: number): { level: Level | "outside"; room: RoomId | null } {
  const inFoot = Math.abs(u) < HOUSE.hw - HOUSE.wall + 0.05 && Math.abs(v) < HOUSE.hd - HOUSE.wall + 0.05;
  if (!inFoot) return { level: "outside", room: null };
  const level: Level = w.lower && feet < -1.0 ? "lower" : "main";
  const r = roomAt(u, v, level, w.lower);
  if (!r && w.lower && u > 1.1 && u < 2.3 && v > -3.4 && v < 0.4) return { level, room: "stair" };
  return { level, room: r ?? (level === "main" ? "living" : "family") };
}

/** Build the walking world for a visited house. */
export function walkWorld(plots: Plot[], fits: HouseFit[], index: number, build: InteriorBuild, groundAt: (x: number, y: number) => number): WalkWorld {
  const p = plots[index], fit = fits[index];
  const ground: GroundFn = (u, v) => { const l = toLocal(p, fit.mirror, u, v); return groundAt(l.x, l.y) - p.local.z_floor; };
  const out = outdoorWalk(fit, ground);
  const others: WalkWorld["others"] = [];
  plots.forEach((q, j) => {
    if (j !== index && Math.hypot(q.local.x - p.local.x, q.local.y - p.local.y) < 45) others.push({ q, mirror: fits[j].mirror });
  });
  return {
    plot: p, fit, index,
    floors: [...build.floors, ...out.floors, ...outerDoorFloors(build.lower)],
    stairs: [...build.stairs, ...out.stairs],
    walls: [...build.walls, ...out.walls],
    boxes: [...build.boxes, ...out.boxes],
    ground, others, lower: build.lower,
  };
}

/** Floors through the outer walls at the doors (so a foot never falls into the wall's thickness). */
function outerDoorFloors(lower: boolean): WalkFloor[] {
  const out: WalkFloor[] = [];
  for (const o of OPENINGS) {
    if (o.kind !== "entry" && o.kind !== "slide" && o.kind !== "garden") continue;
    if (o.lowerOnly && !lower) continue;
    const z = o.level === "main" ? 0 : HOUSE.lower;
    const a = o.c - o.w / 2, b = o.c + o.w / 2;
    if (o.side === "front") out.push({ level: o.level, rect: { u0: a, u1: b, v0: HOUSE.id - 0.02, v1: HOUSE.hd + 0.05 }, z, room: o.room });
    if (o.side === "back") out.push({ level: o.level, rect: { u0: a, u1: b, v0: -HOUSE.hd - 0.05, v1: -HOUSE.id + 0.02 }, z, room: o.room });
  }
  return out;
}

// ---------------------------------------------------------------- the way to a point (A* on a 2.5D grid)
export type Nav = { u0: number; v0: number; n: number; m: number; cell: number; layers: Float32Array[]; free: Uint8Array[] };

/** A grid on its way: filled a few rows at a time, so that making it never holds up a frame for long. */
export type NavBuild = { world: WalkWorld; nav: Nav; row: number; doors: Map<string, number> };

/**
 * A grid of 20 cm cells round the house, up to three surfaces per cell (lower floor or patio, main
 * floor or terrace, ground), each flagged free when a body can stand there. It starts empty: `stepNav`
 * fills it.
 */
export function startNav(w: WalkWorld, half = 16): NavBuild {
  const cell = 0.2;
  const n = Math.ceil((2 * half) / cell), m = n;
  const layers = [new Float32Array(n * m).fill(NaN), new Float32Array(n * m).fill(NaN), new Float32Array(n * m).fill(NaN)];
  const free = [new Uint8Array(n * m), new Uint8Array(n * m), new Uint8Array(n * m)];
  const doors = new Map<string, number>();
  // every door counts as open for planning (the walk opens them on the way)
  for (const wl of w.walls) if (wl.door) doors.set(wl.door, 1);
  return { world: w, nav: { u0: -half, v0: -half, n, m, cell, layers, free }, row: 0, doors };
}

/** Fill rows of the grid for about `ms` milliseconds (all of it by default); true once it is complete. */
export function stepNav(b: NavBuild, ms = Infinity): boolean {
  const { world: w, doors } = b;
  const { u0, v0, n, m, cell, layers, free } = b.nav;
  const t0 = performance.now();
  while (b.row < m) {
    const j = b.row++;
    for (let i = 0; i < n; i++) {
      const u = u0 + (i + 0.5) * cell, v = v0 + (j + 0.5) * cell;
      const s = surfacesAt(w, u, v).map((x) => x.z).sort((a, c) => a - c);
      // merge surfaces closer than a step
      const uniq: number[] = [];
      for (const z of s) if (!uniq.length || z - uniq[uniq.length - 1] > BODY.step) uniq.push(z); else uniq[uniq.length - 1] = Math.max(uniq[uniq.length - 1], z);
      for (let k = 0; k < Math.min(3, uniq.length); k++) {
        const z = uniq[k];
        layers[k][j * n + i] = z;
        const [cu, cv] = collide(w, u, v, z, doors);
        free[k][j * n + i] = Math.hypot(cu - u, cv - v) < 0.03 ? 1 : 0;
      }
    }
    if (performance.now() - t0 > ms) break;
  }
  return b.row >= m;
}

/** A path of points (u, v, z) from one place to another over the grid, or null when there is none. */
export function findPath(nav: Nav, from: [number, number, number], to: [number, number, number]): [number, number, number][] | null {
  const { n, m, cell, layers, free } = nav;
  const idxOf = (u: number, v: number) => [Math.floor((u - nav.u0) / cell), Math.floor((v - nav.v0) / cell)];
  const layerAt = (i: number, j: number, z: number) => {
    let best = -1, bd = 1e9;
    for (let k = 0; k < 3; k++) { const lz = layers[k][j * n + i]; if (Number.isNaN(lz) || !free[k][j * n + i]) continue; const d = Math.abs(lz - z); if (d < bd) { bd = d; best = k; } }
    return bd < 0.9 ? best : -1;
  };
  // the nearest free cell within r cells: a body against a wall, or a click on a chair, has no free cell of its own
  const nearFree = (u: number, v: number, z: number, r: number): [number, number, number] | null => {
    const [i0, j0] = idxOf(u, v);
    let best: [number, number, number] | null = null, bd = Infinity;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj, d = di * di + dj * dj;
      if (i < 0 || j < 0 || i >= n || j >= m || d > r * r || d >= bd) continue;
      const k = layerAt(i, j, z);
      if (k >= 0) { bd = d; best = [i, j, k]; }
    }
    return best;
  };
  const fromCell = nearFree(from[0], from[1], from[2], 3), toCell = nearFree(to[0], to[1], to[2], 6);
  if (!fromCell || !toCell) return null;
  const [si, sj, sk] = fromCell, [ti, tj, tk] = toCell;
  const N = n * m * 3;
  const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const key = (i: number, j: number, k: number) => (k * m + j) * n + i;
  const heap: [number, number][] = [];
  const push = (f: number, k: number) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let s = c; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === c) break; [heap[s], heap[c]] = [heap[c], heap[s]]; c = s; } } return top; };
  const h = (i: number, j: number) => Math.hypot(i - ti, j - tj) * cell;
  const start = key(si, sj, sk), goal = key(ti, tj, tk);
  g[start] = 0;
  push(h(si, sj), start);
  const steps = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]];
  let found = false, guard = 0;
  while (heap.length && guard++ < 200000) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) { found = true; break; }
    const k = Math.floor(cur / (n * m)), rem = cur - k * n * m, j = Math.floor(rem / n), i = rem - j * n;
    const z = layers[k][j * n + i];
    for (const [di, dj, c] of steps) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= n || b >= m) continue;
      for (let kk = 0; kk < 3; kk++) {
        const zz = layers[kk][b * n + a];
        if (Number.isNaN(zz) || !free[kk][b * n + a]) continue;
        if (Math.abs(zz - z) > BODY.step * 0.9) continue;
        // diagonal moves must not cut a corner
        if (di && dj && (!free[k][j * n + a] || !free[k][b * n + i])) continue;
        const nk = key(a, b, kk);
        const ng = g[cur] + c * cell + Math.abs(zz - z) * 0.5;
        if (ng < g[nk]) { g[nk] = ng; came[nk] = cur; push(ng + h(a, b), nk); }
      }
    }
  }
  if (!found) return null;
  const path: [number, number, number][] = [];
  for (let c = goal; c >= 0; c = came[c]) {
    const k = Math.floor(c / (n * m)), rem = c - k * n * m, j = Math.floor(rem / n), i = rem - j * n;
    path.push([nav.u0 + (i + 0.5) * cell, nav.v0 + (j + 0.5) * cell, layers[k][j * n + i]]);
    if (c === start) break;
  }
  path.reverse();
  // keep the points where the way climbs or turns, every third one elsewhere, and the last
  return path.filter((p, k) => {
    if (k === 0 || k === path.length - 1 || k % 3 === 0) return true;
    const a = path[k - 1], b = path[k + 1];
    const climbs = Math.abs(b[2] - a[2]) > 0.05;
    const turns = Math.abs((b[0] - p[0]) * (p[1] - a[1]) - (b[1] - p[1]) * (p[0] - a[0])) > 1e-6;
    return climbs || turns;
  });
}
