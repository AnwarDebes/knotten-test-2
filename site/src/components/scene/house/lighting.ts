/**
 * The light in the rooms, worked out once per vertex when a house is built (it changes with the sky
 * and the time of day only through the shader's uniforms):
 *
 *   aSky   the share of the view that is window: the exact form factor of every opening of the room
 *          (Lambert's formula for a polygon, clipped to the surface's own hemisphere) times the glass's
 *          light transmission, plus the light bounced round the room (the split-flux method's
 *          internally reflected component, from the window area, the room's surfaces and their
 *          average reflectance)
 *   aLamp  the lamps of the room: inverse square, the cosine at the surface, downlights and pendants
 *          shining mostly down, plus their light bounced round the room
 *   aAO    the contact shadow in corners, along skirtings, under and beside furniture
 */
import * as THREE from "three";
import type { Plot } from "@/lib/types";
import { HOUSE, OPENINGS, ROOMS, STAIR, holeRect, keep, vaultAt, type HouseFit, type Level, type RoomId } from "@/lib/house/plan";
import { fromScene } from "./frame";
import { roomAt, type InteriorBuild, type Lamp } from "./interior";

type P3 = [number, number, number];
type Aperture = { q: P3[]; tau: number; area: number };

const I = HOUSE.iw, J = HOUSE.id;
const RHO = 0.55;   // average reflectance of the room (white walls and ceiling, oak floor)
const SENSOR = new Set<string>(["tech", "bath", "bath2", "hall", "store", "stair"]);

/** Corners of an opening's aperture on the inner face of its wall, in the house frame. */
function apertureOf(o: (typeof OPENINGS)[number]): P3[] {
  const h = holeRect(o);
  if (o.kind === "entry") {
    // only the door's glass strip lets light in
    const i0 = h.s0 + 0.07;
    return rectOn(o.side, i0 + 0.16, i0 + 0.3, h.z0 + 0.3, h.z1 - 0.27);
  }
  return rectOn(o.side, h.s0 + 0.06, h.s1 - 0.06, h.z0 + 0.06, h.z1 - 0.06);
}
function rectOn(side: string, s0: number, s1: number, z0: number, z1: number): P3[] {
  switch (side) {
    case "front": return [[s0, J, z0], [s1, J, z0], [s1, J, z1], [s0, J, z1]];
    case "back": return [[s0, -J, z0], [s1, -J, z0], [s1, -J, z1], [s0, -J, z1]];
    case "left": return [[-I, s0, z0], [-I, s1, z0], [-I, s1, z1], [-I, s0, z1]];
    default: return [[I, s0, z0], [I, s1, z0], [I, s1, z1], [I, s0, z1]];
  }
}

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: P3) => Math.hypot(a[0], a[1], a[2]);

/** Form factor from a point with normal n to a polygon (vectors from the point), clipped to n's hemisphere. */
export function formFactor(n: P3, poly: P3[]) {
  // clip against the plane n.x = eps (Sutherland-Hodgman)
  const eps = 1e-4;
  const out: P3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = dot(n, a) - eps, db = dot(n, b) - eps;
    if (da >= 0) out.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  if (out.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[(i + 1) % out.length];
    const la = len(a), lb = len(b);
    if (la < 1e-6 || lb < 1e-6) continue;
    const c = cross(a, b), lc = len(c);
    if (lc < 1e-9) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb))));
    sum += ang * (dot(n, c) / lc);
  }
  return Math.abs(sum) / (2 * Math.PI);
}

/** The light zones: rooms, with the hall open to the living room and the stair between two floors. */
type Zone = RoomId;

function zoneOf(u: number, v: number, z: number, lower: boolean): { zone: Zone; level: Level } {
  const level: Level = lower && z < -0.32 ? "lower" : "main";
  // the stair shaft below the main floor
  if (lower && z < -0.05 && u > STAIR.u0 - 0.02 && u < STAIR.u1 + 0.02 && v < HOUSE.lowerBack + HOUSE.wall) return { zone: "stair", level: "lower" };
  const r = roomAt(u, v, level, lower);
  if (r) return { zone: r, level };
  // on a wall or just outside a room's rectangle: the nearest room
  let best: Zone = level === "main" ? "living" : "family", bd = 1e9;
  for (const R of ROOMS) {
    if (R.level !== level || (!lower && R.lowerOnly) || R.id === "stair") continue;
    const du = Math.max(R.rect.u0 - u, 0, u - R.rect.u1), dv = Math.max(R.rect.v0 - v, 0, v - R.rect.v1);
    const d = Math.hypot(du, dv);
    if (d < bd) { bd = d; best = R.id; }
  }
  return { zone: best, level };
}

/** Surface area of a zone (floor, ceiling, walls), for the light bounced round it. */
function zoneArea(z: Zone, lower: boolean) {
  const R = ROOMS.find((r) => r.id === z);
  if (!R) return 30;
  const w = R.rect.u1 - R.rect.u0, d = R.rect.v1 - R.rect.v0;
  const h = R.ceiling === "vault" ? (vaultAt(0) + vaultAt(J)) / 2 : R.level === "lower" ? HOUSE.lowerCeiling - HOUSE.lower : HOUSE.flat;
  void lower;
  return 2 * w * d + 2 * (w + d) * h;
}

export function bakeLight(build: InteriorBuild, p: Plot, fit: HouseFit) {
  const lower = build.lower;
  const t0 = performance.now();
  // ---- apertures per zone
  const aps = new Map<Zone, Aperture[]>();
  const add = (z: Zone, a: Aperture) => { const l = aps.get(z) ?? []; l.push(a); aps.set(z, l); };
  for (const o of OPENINGS) {
    if (!keep(o, lower)) continue;
    const q = apertureOf(o);
    const area = len(cross(sub(q[1], q[0]), sub(q[3], q[0])));
    // triple glazing passes about 70 % of daylight; frosted glass less; under the terrace the lower
    // floor's openings see the deck above them rather than the sky
    let tau = o.frosted ? 0.45 : 0.62;
    if (o.level === "lower") tau *= 0.55;
    add(o.room as Zone, { q, tau, area });
  }
  // the hall sees the living room through its open front: a "window" onto a room about a tenth as bright as the sky
  add("hall", { q: [[-0.25, -1.15, 0.0], [2.15, -1.15, 0.0], [2.15, -1.15, 2.45], [-0.25, -1.15, 2.45]], tau: 0.09, area: 5.9 });
  // the stair shaft: from the hall above and the family room below
  if (lower) {
    add("stair", { q: [[STAIR.u0, STAIR.top, 0.0], [STAIR.u1, STAIR.top, 0.0], [STAIR.u1, STAIR.openTo, 0.0], [STAIR.u0, STAIR.openTo, 0.0]], tau: 0.08, area: 2.8 });
    add("stair", { q: [[STAIR.u0, -0.55, HOUSE.lower], [STAIR.u1, -0.55, HOUSE.lower], [STAIR.u1, -0.55, HOUSE.lowerCeiling], [STAIR.u0, -0.55, HOUSE.lowerCeiling]], tau: 0.06, area: 2.3 });
  }
  // ---- light bounced round each zone (split flux: window area x transmission x half the sky, over the room's surfaces)
  const irc = new Map<Zone, number>();
  for (const [z, list] of aps) {
    const flux = list.reduce((s, a) => s + a.tau * a.area * 0.5, 0);
    irc.set(z, (flux * RHO) / (zoneArea(z, lower) * (1 - RHO)));
  }
  // ---- lamps per zone, and their bounce
  const lampsIn = new Map<Zone, Lamp[]>();
  for (const l of build.lamps) {
    const z = zoneOf(l.u, l.v, l.z, lower).zone;
    const arr = lampsIn.get(z) ?? []; arr.push(l); lampsIn.set(z, arr);
  }
  const lampBounce = new Map<Zone, number>();
  for (const [z, ls] of lampsIn) lampBounce.set(z, (ls.reduce((s, l) => s + l.power, 0) * 2.2 * RHO) / (zoneArea(z, lower) * (1 - RHO)));
  // lamps that reach a zone: its own, and a little of the neighbours'
  const lampsFor = (z: Zone): [Lamp, number][] => {
    const own = (lampsIn.get(z) ?? []).map((l) => [l, 1] as [Lamp, number]);
    if (z === "hall") return [...own, ...(lampsIn.get("living") ?? []).map((l) => [l, 0.25] as [Lamp, number])];
    if (z === "stair") return [...(lampsIn.get("hall") ?? []), ...(lampsIn.get("family") ?? [])].map((l) => [l, 0.5] as [Lamp, number]);
    return own;
  };
  const bounceFor = (z: Zone) => (z === "stair" ? 0.5 * ((lampBounce.get("hall") ?? 0) + (lampBounce.get("family") ?? 0)) : z === "hall" ? (lampBounce.get("hall") ?? 0) + 0.25 * (lampBounce.get("living") ?? 0) : lampBounce.get(z) ?? 0);

  // ---- per vertex
  const f = (p.house.facing_deg * Math.PI) / 180, ca = Math.cos(f), sa = Math.sin(f), ms = fit.mirror ? -1 : 1;
  const shell = new Set(["wall", "tileWall", "ceiling", "oak", "tileFloor", "stoneFloor"]);
  const boxes = build.boxes;
  for (const [key, g] of Object.entries(build.geos)) {
    const P = g.attributes.position as THREE.BufferAttribute, Nn = g.attributes.normal as THREE.BufferAttribute;
    const n = P.count;
    const sky = new Float32Array(n), lamp = new Float32Array(n), lampS = new Float32Array(n), ao = new Float32Array(n);
    const isShell = shell.has(key);
    for (let i = 0; i < n; i++) {
      const hp = fromScene(p, fit.mirror, P.getX(i), P.getY(i), P.getZ(i));
      const nx = Nn.getX(i), ny = Nn.getY(i), nz = Nn.getZ(i);
      const dn = -nz;
      const hn: P3 = [(nx * ca - dn * sa) * ms, nx * sa + dn * ca, ny];
      const pt: P3 = [hp.u, hp.v, hp.z];
      const probe = zoneOf(hp.u + hn[0] * 0.06, hp.v + hn[1] * 0.06, hp.z + hn[2] * 0.06, lower);
      const z = probe.zone;
      // daylight
      let s = irc.get(z) ?? 0.004;
      for (const a of aps.get(z) ?? []) s += a.tau * formFactor(hn, a.q.map((q) => sub(q, pt)));
      sky[i] = Math.min(1, s + 0.004);
      // lamps
      let e = bounceFor(z);
      for (const [l, wgt] of lampsFor(z)) {
        const d: P3 = [l.u - pt[0], l.v - pt[1], l.z - pt[2]];
        const d2 = Math.max(0.12, dot(d, d)), dl = Math.sqrt(d2);
        const cosS = Math.max(0, dot(hn, d) / dl);
        const down = Math.max(0, -d[2] / dl);   // how far below the lamp the point is
        const beam = l.kind === "down" ? Math.pow(Math.max(0, (pt[2] < l.z ? 1 : 0) * (l.z - pt[2]) / dl), 1.6) : l.kind === "pendant" ? 0.3 + 0.7 * down : l.kind === "wall" ? 0.5 + 0.5 * down : 0.55 + 0.45 * down;
        void down;
        e += (wgt * l.power * cosS * beam) / d2;
      }
      // rooms with little or no daylight (plant room, bathrooms, hall, storage, stair) have their lights on a
      // motion sensor: they are lit while someone is in the house
      if (SENSOR.has(z)) lampS[i] = e; else lamp[i] = e;
      // contact shadow
      const floorZ = probe.level === "lower" ? HOUSE.lower : 0;
      const hz = hp.z - floorZ;
      let o = 1;
      if (isShell) {
        const room = ROOMS.find((r) => r.id === z);
        const R = room?.rect;
        if (hn[2] > 0.7 && R) {
          // floor: darker towards the walls and under furniture
          const dw = Math.min(hp.u - R.u0, R.u1 - hp.u, hp.v - R.v0, R.v1 - hp.v);
          o *= 1 - 0.3 * Math.exp(-Math.max(0, dw) / 0.16);
          for (const b of boxes) {
            if (b.level !== probe.level || b.z1 - b.z0 < 0.2 || b.z0 - floorZ > 0.45) continue;
            const du = Math.max(b.rect.u0 - hp.u, 0, hp.u - b.rect.u1), dv = Math.max(b.rect.v0 - hp.v, 0, hp.v - b.rect.v1);
            const d = Math.hypot(du, dv);
            const inside = hp.u > b.rect.u0 && hp.u < b.rect.u1 && hp.v > b.rect.v0 && hp.v < b.rect.v1;
            o *= inside ? (b.z0 - floorZ > 0.12 ? 0.55 : 0.4) : 1 - 0.42 * Math.exp(-d / 0.12);
          }
        } else if (hn[2] < -0.7 && R) {
          const dw = Math.min(hp.u - R.u0, R.u1 - hp.u, hp.v - R.v0, R.v1 - hp.v);
          o *= 1 - 0.2 * Math.exp(-Math.max(0, dw) / 0.18);
        } else {
          // walls: along the skirting and under the ceiling, and in the room's corners
          const ceil = probe.level === "lower" ? HOUSE.lowerCeiling : hp.v > -1.1 ? vaultAt(hp.v) : HOUSE.flat;
          o *= 1 - 0.28 * Math.exp(-Math.max(0, hz) / 0.12);
          o *= 1 - 0.16 * Math.exp(-Math.max(0, ceil - hp.z) / 0.16);
          if (R) {
            const along = Math.abs(hn[0]) > 0.5 ? Math.min(hp.v - R.v0, R.v1 - hp.v) : Math.min(hp.u - R.u0, R.u1 - hp.u);
            o *= 1 - 0.2 * Math.exp(-Math.max(0, along) / 0.15);
          }
          // furniture against the wall
          for (const b of boxes) {
            if (b.level !== probe.level) continue;
            const du = Math.max(b.rect.u0 - hp.u, 0, hp.u - b.rect.u1), dv = Math.max(b.rect.v0 - hp.v, 0, hp.v - b.rect.v1);
            const d = Math.hypot(du, dv);
            if (d > 0.5) continue;
            const above = hp.z - b.z1;
            o *= 1 - 0.3 * Math.exp(-d / 0.1) * (above < 0 ? 1 : Math.exp(-above / 0.25));
          }
        }
      } else {
        // furniture: darker near the floor
        o *= 1 - 0.35 * Math.exp(-Math.max(0, hz) / 0.07);
      }
      ao[i] = Math.max(0.15, o);
    }
    g.setAttribute("aSky", new THREE.BufferAttribute(sky, 1));
    g.setAttribute("aLamp", new THREE.BufferAttribute(lamp, 1));
    g.setAttribute("aLampS", new THREE.BufferAttribute(lampS, 1));
    g.setAttribute("aAO", new THREE.BufferAttribute(ao, 1));
  }
  return performance.now() - t0;
}

/** Light attributes for parts drawn apart (door leaves): the room's average, no contact shadow. */
export function flatLight(g: THREE.BufferGeometry, sky: number, lamp: number) {
  const n = g.attributes.position.count;
  g.setAttribute("aSky", new THREE.BufferAttribute(new Float32Array(n).fill(sky), 1));
  g.setAttribute("aLamp", new THREE.BufferAttribute(new Float32Array(n).fill(lamp), 1));
  g.setAttribute("aLampS", new THREE.BufferAttribute(new Float32Array(n).fill(0), 1));
  g.setAttribute("aAO", new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
}
