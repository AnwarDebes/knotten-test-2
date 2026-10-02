/**
 * Furniture, fixtures and the house's installations, each at its real size, drawn from boxes with
 * softened edges, turned profiles and tubes. Every piece is drawn in its own frame (x across its
 * front, y up from its bottom, z from its front at -d/2 to its back at +d/2) and placed by the plan.
 *
 * The installations are the energy measures the project has chosen, as they would stand in a
 * Norwegian plant room: a ground-source heat pump with its hot water tank, a balanced ventilation unit
 * with heat recovery and its four ducts, the home battery and the inverter for the roof's modules, the
 * fuse box with the electricity meter and its HAN reader, the underfloor heating manifold, and in the
 * bathroom the shower drain that takes the heat out of the shower water.
 */
import * as THREE from "three";
import { HOUSE, levelZ, vaultAt, type Item } from "@/lib/house/plan";
import { Builders, type Builder } from "./kit";
import type { Lamp, WalkBox } from "./interior";
import { isObstacle } from "./interior";

/** Colour schemes; each house picks one (so 30 homes are not furnished alike). */
const SCHEMES = [
  { fabric: "#8d9295", fabric2: "#c9b79c", front: "#e9e7e2", accent: "#5f7a6a", bed: "#e8e4dc", throw: "#a76c4f" },
  { fabric: "#b9ae9c", fabric2: "#6f7f8a", front: "#c9d1c7", accent: "#3f5a73", bed: "#eef0f2", throw: "#c4a14f" },
  { fabric: "#5d6b72", fabric2: "#d6cfc2", front: "#2f3a40", accent: "#b36b48", bed: "#e9e5df", throw: "#7a8f6c" },
  { fabric: "#a7a49e", fabric2: "#8b5e46", front: "#f2f0ec", accent: "#2e6a7d", bed: "#f0ede8", throw: "#4e6a8a" },
];
export const schemeOf = (seed: number) => SCHEMES[Math.floor(Math.abs(seed * 7.3)) % SCHEMES.length];

/**
 * Placement of an item: the house frame, then its spot on the floor, then its turn. In a mirrored
 * house the plan is mirrored but the furniture is not (a sofa is not built mirror-image, and a screen
 * must read the right way round): each piece is mirrored back about its own centre.
 */
export function itemMatrix(m: THREE.Matrix4, it: Item, mirror = false) {
  const z0 = levelZ(it.level) + (it.ceil ? ceilingOver(it) - levelZ(it.level) : it.z ?? 0);
  const out = m.clone().multiply(new THREE.Matrix4().makeTranslation(it.at[0], z0, -it.at[1])).multiply(new THREE.Matrix4().makeRotationY((-it.rot * Math.PI) / 2));
  return mirror ? out.multiply(new THREE.Matrix4().makeScale(-1, 1, 1)) : out;
}

/** Height of the ceiling over an item (for downlights and smoke alarms). */
function ceilingOver(it: Item) {
  if (it.level === "lower") return HOUSE.lowerCeiling;
  return it.at[1] > -1.1 ? vaultAt(it.at[1]) : HOUSE.flat;
}

type Out = { lamp?: Lamp[]; box?: WalkBox; hotZ?: number };
type Ctx = { B: Builders; w: number; d: number; h: number; it: Item; seed: number; sch: (typeof SCHEMES)[number]; mirror: boolean };

const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

export function drawItem(B: Builders, it: Item, m: THREE.Matrix4, seed: number, lower: boolean, mirror = false): Out {
  const M = itemMatrix(m, it, mirror);
  B.at(M);
  const [w, d, h] = it.size;
  const ctx: Ctx = { B, w, d, h, it, seed, sch: schemeOf(seed), mirror };
  const out: Out = {};
  const f = DRAW[it.kind];
  if (f) Object.assign(out, f(ctx) ?? {});
  B.at(m);
  if (isObstacle(it)) {
    // the footprint in the house's plan (quarter turns swap width and depth)
    const sw = it.rot % 2 === 0 ? w : d, sd = it.rot % 2 === 0 ? d : w;
    const z0 = levelZ(it.level) + (it.z ?? 0);
    out.box = { level: it.level, rect: { u0: it.at[0] - sw / 2, u1: it.at[0] + sw / 2, v0: it.at[1] - sd / 2, v1: it.at[1] + sd / 2 }, z0, z1: z0 + h, kind: it.kind };
  }
  void lower;
  return out;
}

/** A lamp at a point of the item's frame, turned into the house frame. */
function lampAt(c: Ctx, x: number, y: number, z: number, power: number, kind: Lamp["kind"]): Lamp {
  const a = (-c.it.rot * Math.PI) / 2;
  // local (x, z) -> house (u, v): the item frame (mirrored back in a mirrored house) turned, then placed
  if (c.mirror) x = -x;
  const lx = x * Math.cos(a) + z * Math.sin(a), lz = -x * Math.sin(a) + z * Math.cos(a);
  const base = levelZ(c.it.level) + (c.it.ceil ? ceilingOver(c.it) - levelZ(c.it.level) : c.it.z ?? 0);
  return { u: c.it.at[0] + lx, v: c.it.at[1] - lz, z: base + y, power, kind, room: c.it.room, level: c.it.level };
}

const DRAW: Partial<Record<Item["kind"], (c: Ctx) => Out | void>> = {
  // ---------------------------------------------------------------- the plant room
  heatpump(c) {
    const { B, w, d, h } = c;
    const white = B.get("gloss").tint("#f2f2f0");
    white.soft(-w / 2, 0.02, -d / 2, w / 2, h, d / 2, 0.02);
    B.get("metal").tint("#5a5e62").box(-w / 2 + 0.02, 0, -d / 2 + 0.03, w / 2 - 0.02, 0.02, d / 2 - 0.03);
    // the front: a seam between the heat pump section and the 180 l tank, the control display
    B.get("matte").tint("#d9dad8").box(-w / 2 + 0.01, 1.02, -d / 2 - 0.004, w / 2 - 0.01, 1.03, -d / 2 + 0.01);
    B.get("black").tint("#14171a").box(-0.12, 1.38, -d / 2 - 0.006, 0.12, 1.52, -d / 2 + 0.005);
    B.get("screen").panel(-0.105, 1.392, 0.105, 1.508, -d / 2 - 0.0075, [0, 0.25, 0.5, 0.5]);
    // pipework from the top into the ceiling: heating flow and return, hot and cold water (copper, insulated)
    const roof = (c.it.level === "lower" ? HOUSE.lowerCeiling : HOUSE.flat) - (c.it.z ?? 0);
    const ins = B.get("matte").tint("#2a2c2e");
    const cu = B.get("metal").tint("#b87333");
    [[-0.18, ins], [-0.06, ins], [0.06, cu], [0.18, cu]].forEach(([x, b], k) => (b as Builder).tube([x as number, h, 0.1 + (k % 2) * 0.08], [x as number, roof, 0.1 + (k % 2) * 0.08], k < 2 ? 0.032 : 0.012, 8));
    // the brine from the shared borehole field comes up through the floor: two black insulated pipes into the side
    for (const z of [-0.12, 0.08]) {
      ins.tube([w / 2 + 0.09, 0, z], [w / 2 + 0.09, 1.65, z], 0.038, 10);
      ins.tube([w / 2 + 0.09, 1.65, z], [w / 2 - 0.02, 1.65, z], 0.038, 10);
    }
    // a pressure gauge and the filling valves on the brine pipes
    B.get("chrome").tint("#c0c3c6").cyl(w / 2 + 0.09, -0.12, 0.045, 1.1, 1.16, 12);
    return { hotZ: h + 0.25 };
  },
  washer(c) {
    const { B, w, d } = c;
    const white = B.get("gloss").tint("#f4f4f2");
    for (const [y0, y1] of [[0.0, 0.85], [0.85, 1.7]]) {
      white.soft(-w / 2, y0 + 0.005, -d / 2, w / 2, y1, d / 2, 0.015);
      // the round door and the control strip
      const cy = (y0 + y1) / 2 - 0.05;
      B.get("chrome").tint("#b9bcbe").fdisk(0, cy, -d / 2 - 0.006, 0.17, -1, 24);
      B.get("black").tint("#1a2026").fdisk(0, cy, -d / 2 - 0.009, 0.13, -1, 24);
      B.get("matte").tint("#d5d6d4").box(-w / 2 + 0.03, y1 - 0.12, -d / 2 - 0.004, w / 2 - 0.03, y1 - 0.03, -d / 2);
    }
  },
  utilitysink(c) {
    const { B, w, d, h } = c;
    B.get("paintwood").tint("#f1f0ec").soft(-w / 2, 0.1, -d / 2 + 0.02, w / 2, h - 0.03, d / 2, 0.01);
    B.get("matte").tint("#2b2d2f").box(-w / 2 + 0.03, 0, -d / 2 + 0.07, w / 2 - 0.03, 0.1, d / 2);
    const steel = B.get("chrome").tint("#cfd2d4");
    steel.box(-w / 2, h - 0.03, -d / 2, w / 2, h, d / 2);
    B.get("metal").tint("#8f9396").box(-w / 2 + 0.08, h - 0.0, -d / 2 + 0.06, w / 2 - 0.08, h + 0.002, d / 2 - 0.08);
    steel.tube([0, h, d / 2 - 0.05], [0, h + 0.3, d / 2 - 0.05], 0.014, 8);
    steel.tube([0, h + 0.3, d / 2 - 0.05], [0, h + 0.3, d / 2 - 0.25], 0.012, 8);
  },
  battery(c) {
    const { B, w, d, h } = c;
    // a floor-standing battery cabinet: three modules of about 4.7 kWh, 14 kWh together (the energy budget's size)
    const body = B.get("gloss").tint("#3b4045");
    body.soft(-w / 2, 0.04, -d / 2, w / 2, h, d / 2, 0.015);
    B.get("matte").tint("#25292c").box(-w / 2 + 0.02, 0, -d / 2 + 0.02, w / 2 - 0.02, 0.04, d / 2 - 0.02);
    for (const y of [0.4, 0.75]) B.get("matte").tint("#30353a").box(-w / 2 + 0.01, y, -d / 2 - 0.003, w / 2 - 0.01, y + 0.008, -d / 2 + 0.01);
    // the state-of-charge bar (lit from the simulation)
    B.get("socbar").box(-0.015, 0.25, -d / 2 - 0.004, 0.015, 0.95, -d / 2 + 0.002);
    // cable trunking up to the inverter
    B.get("matte").tint("#e6e6e3").box(w / 2 - 0.12, h, d / 2 - 0.08, w / 2 - 0.04, 1.35 - (c.it.z ?? 0), d / 2);
    return { hotZ: h + 0.2 };
  },
  inverter(c) {
    const { B, w, d, h } = c;
    B.get("gloss").tint("#f0f0ee").soft(-w / 2, 0, -d / 2, w / 2, h, d / 2, 0.02);
    const fin = B.get("metal").tint("#9da1a5");
    for (let k = 0; k < 6; k++) { fin.box(-w / 2 - 0.03, 0.05 + k * 0.065, -d / 2 + 0.03, -w / 2, 0.08 + k * 0.065, d / 2 - 0.02); fin.box(w / 2, 0.05 + k * 0.065, -d / 2 + 0.03, w / 2 + 0.03, 0.08 + k * 0.065, d / 2 - 0.02); }
    B.get("black").tint("#14171a").box(-0.09, h - 0.16, -d / 2 - 0.004, 0.09, h - 0.06, -d / 2 + 0.004);
    B.get("screen").panel(-0.08, h - 0.15, 0.08, h - 0.07, -d / 2 - 0.006, [0.5, 0.25, 1, 0.5]);
    // DC from the roof's modules and AC to the fuse box, in white trunking up to the ceiling
    const roof = HOUSE.flat - (c.it.z ?? 0);
    B.get("matte").tint("#e6e6e3").box(-0.04, h, d / 2 - 0.06, 0.04, roof, d / 2);
    return { hotZ: h + 0.2 };
  },
  ventunit(c) {
    const { B, w, d, h } = c;
    // a balanced ventilation unit with a rotary or plate heat exchanger (80 to 90 % of the heat back)
    B.get("gloss").tint("#f3f3f1").soft(-w / 2, 0, -d / 2, w / 2, h, d / 2, 0.02);
    B.get("matte").tint("#dcdddb").box(-w / 2 + 0.02, 0.05, -d / 2 - 0.004, w / 2 - 0.02, 0.06, -d / 2);
    B.get("black").tint("#1a1d20").box(w / 2 - 0.16, h - 0.14, -d / 2 - 0.005, w / 2 - 0.05, h - 0.07, -d / 2 + 0.004);
    // four ducts of 160 mm into the ceiling: fresh air in and exhaust out (insulated, to the roof hood), supply and extract to the rooms
    const roof = HOUSE.flat - (c.it.z ?? 0);
    const ins = B.get("matte").tint("#3a3c3e");
    const duct = B.get("chrome").tint("#c3c6c9");
    const pos: [number, number, Builder][] = [[-0.25, 0.05, ins], [-0.08, 0.05, ins], [0.09, 0.05, duct], [0.26, 0.05, duct]];
    for (const [x, z, b] of pos) {
      b.cyl(x, z, b === ins ? 0.105 : 0.082, h, roof, 16, false);
      B.get("metal").tint("#7d8185").cyl(x, z, 0.09, h, h + 0.04, 16, false);
    }
    // the condensate drain
    B.get("matte").tint("#e6e6e3").tube([-w / 2 + 0.06, 0, -d / 2 + 0.1], [-w / 2 + 0.06, -0.6, -d / 2 + 0.1], 0.012, 6);
    return { hotZ: h + 0.2 };
  },
  manifold(c) {
    const { B, w, d, h } = c;
    // the open cabinet with the floor heating's manifold: flow and return bars and one loop per room
    B.get("paintwood").tint("#f0efeb").box(-w / 2, 0, d / 2 - 0.01, w / 2, h, d / 2);
    const brass = B.get("metal").tint("#b08d57");
    brass.tube([-w / 2 + 0.05, h * 0.68, 0], [w / 2 - 0.05, h * 0.68, 0], 0.016, 8);
    brass.tube([-w / 2 + 0.05, h * 0.32, 0], [w / 2 - 0.05, h * 0.32, 0], 0.016, 8);
    for (let k = 0; k < 6; k++) {
      const x = -w / 2 + 0.1 + k * ((w - 0.2) / 5);
      B.get("matte").tint("#c0392b").cyl(x, -0.02, 0.012, h * 0.68 + 0.01, h * 0.68 + 0.05, 8);
      B.get("matte").tint("#2c6fb7").cyl(x, -0.02, 0.012, h * 0.32 + 0.01, h * 0.32 + 0.05, 8);
      B.get("matte").tint("#e4e4e0").tube([x, 0, 0], [x, -h * 0.3 - (c.it.z ?? 0), 0], 0.009, 6);
    }
  },
  fusebox(c) {
    const { B, w, d, h } = c;
    B.get("gloss").tint("#e9eaea").box(-w / 2, 0, -d / 2 + 0.02, w / 2, h, d / 2);
    // breakers in rows behind the clear door, the electricity meter (AMS) with its HAN port, and the HAN reader
    const brk = B.get("matte");
    for (let row = 0; row < 3; row++) for (let k = 0; k < 10; k++) brk.tint(k === 0 ? "#b33a3a" : "#f5f5f3").box(-w / 2 + 0.05 + k * 0.045, 0.08 + row * 0.15, -d / 2 + 0.015, -w / 2 + 0.085 + k * 0.045, 0.16 + row * 0.15, -d / 2 + 0.03);
    B.get("matte").tint("#d3d4d2").box(-0.12, 0.54, -d / 2 + 0.012, 0.12, 0.72, -d / 2 + 0.03);
    B.get("screen").panel(-0.06, 0.62, 0.06, 0.66, -d / 2 + 0.0095, [0, 0, 0.5, 0.25]);
    B.get("black").tint("#1b1e21").soft(0.13, 0.6, -d / 2 + 0.0, 0.2, 0.67, -d / 2 + 0.03, 0.01);
    B.get("led").box(0.16, 0.655, -d / 2 - 0.001, 0.17, 0.662, -d / 2 + 0.001);
    B.get("glass").box(-w / 2 + 0.01, 0.02, -d / 2 - 0.004, w / 2 - 0.01, h - 0.02, -d / 2 + 0.006);
    return { hotZ: h + 0.2 };
  },
  // ---------------------------------------------------------------- the bathrooms
  shower(c) {
    const { B, w, d } = c;
    // a walk-in shower: a fixed glass screen on the open side, a rain head and a hand shower on a thermostatic bar
    const glass = B.get("glass");
    const sw = Math.min(0.9, w);
    glass.box(-w / 2 + (w - sw), 0.02, -d / 2, w / 2, 2.0, -d / 2 + 0.01);
    const chrome = B.get("chrome").tint("#d5d8da");
    chrome.box(-w / 2 + (w - sw), 1.98, -d / 2 - 0.005, w / 2, 2.0, -d / 2 + 0.015);
    chrome.tube([w / 2 - 0.05, 2.0, -d / 2 + 0.005], [w / 2 - 0.05, 2.0, d / 2], 0.01, 6);
    chrome.tube([0, 1.0, d / 2], [0, 2.1, d / 2], 0.014, 8);
    chrome.tube([0, 2.1, d / 2], [0, 2.1, d / 2 - 0.35], 0.012, 8);
    chrome.disk(0, 2.08, d / 2 - 0.35, 0.13, -1, 24);
    chrome.cyl(0, d / 2 - 0.35, 0.13, 2.08, 2.1, 24, true);
    chrome.box(-0.2, 0.95, d / 2 - 0.07, 0.2, 1.03, d / 2);
    // a niche shelf with bottles
    B.get("gloss").tint("#f0f0ee").box(-w / 2 + 0.05, 1.2, d / 2 - 0.12, -w / 2 + 0.4, 1.22, d / 2);
    for (let k = 0; k < 3; k++) B.get("gloss").tint(["#6f8fa0", "#e8e2d6", "#4f6b5c"][k]).cyl(-w / 2 + 0.1 + k * 0.1, d / 2 - 0.06, 0.025, 1.22, 1.39 - k * 0.03, 10);
    return { hotZ: 0.4 };
  },
  drain(c) {
    const { B, w, d } = c;
    // the linear drain; under it, the heat exchanger that warms the cold water with the shower water
    B.get("chrome").tint("#b9bdc0").box(-w / 2, 0.0, -d / 2, w / 2, 0.006, d / 2);
    const slot = B.get("black").tint("#2a2d30");
    for (let k = 0; k < 24; k++) slot.box(-w / 2 + 0.02 + k * ((w - 0.04) / 24), 0.006, -0.02, -w / 2 + 0.03 + k * ((w - 0.04) / 24), 0.0065, 0.02);
  },
  wc(c) {
    const { B, w, d, h } = c;
    const white = B.get("gloss").tint("#f7f7f5");
    // the bowl hangs on the wall; the cistern is in the wall behind a tiled boxing, the flush plate on it
    white.soft(-w / 2 + 0.02, h - 0.33, -d / 2, w / 2 - 0.02, h, d / 2 - 0.05, 0.08, false);
    white.soft(-w / 2 + 0.01, h, -d / 2 + 0.02, w / 2 - 0.01, h + 0.025, d / 2 - 0.06, 0.012, false);
    B.get("tileWall").tint("#d7d7d3").box(-0.32, 0, d / 2 - 0.05, 0.32, 1.1, d / 2 + 0.17);
    B.get("chrome").tint("#d5d8da").box(-0.11, 0.98, d / 2 - 0.056, 0.11, 1.12, d / 2 - 0.05);
  },
  vanity(c) {
    const { B, w, d, h } = c;
    // a wall-hung oak cabinet with a drawer, a white basin top and a tap
    B.get("oakwood").tint(c.sch.front === "#2f3a40" ? "#4a5056" : "#b9925f").soft(-w / 2, h - 0.5, -d / 2 + 0.02, w / 2, h - 0.03, d / 2, 0.008);
    B.get("black").tint("#3b3d3f").box(-0.15, h - 0.11, -d / 2 + 0.01, 0.15, h - 0.095, -d / 2 + 0.02);
    const white = B.get("gloss").tint("#f7f7f5");
    white.soft(-w / 2, h - 0.03, -d / 2, w / 2, h + 0.01, d / 2, 0.01, false);
    B.get("gloss").tint("#e9e9e6").box(-w / 2 + 0.1, h + 0.005, -d / 2 + 0.06, w / 2 - 0.1, h + 0.012, d / 2 - 0.1);
    const chrome = B.get("chrome").tint("#d5d8da");
    chrome.cyl(0, d / 2 - 0.07, 0.022, h + 0.01, h + 0.2, 12);
    chrome.tube([0, h + 0.19, d / 2 - 0.07], [0, h + 0.19, d / 2 - 0.2], 0.012, 8);
  },
  mirror(c) {
    const { B, w, d, h } = c;
    B.get("mirror").box(-w / 2, 0, -d / 2, w / 2, h, d / 2);
    // a light strip over it
    B.get("emissive").box(-w / 2 + 0.05, h + 0.01, -d / 2 - 0.02, w / 2 - 0.05, h + 0.035, d / 2);
    return { lamp: c.it.room === "hall" ? [] : [lampAt(c, 0, h + 0.03, -0.1, 0.35, "wall")] };
  },
  towelrail(c) {
    const { B, w, h } = c;
    const chrome = B.get("chrome").tint("#d5d8da");
    for (const x of [-w / 2, w / 2]) chrome.tube([x, 0, 0], [x, h, 0], 0.014, 8);
    for (let k = 0; k <= 6; k++) chrome.tube([-w / 2, 0.08 + k * ((h - 0.12) / 6), 0], [w / 2, 0.08 + k * ((h - 0.12) / 6), 0], 0.009, 6);
    B.get("fabric").tint("#e6e0d4").soft(-w / 2 + 0.04, h * 0.4, -0.03, w / 2 - 0.04, h * 0.85, 0.02, 0.01, false);
  },
  // ---------------------------------------------------------------- the kitchen
  kitchenBase(c) {
    const { B, w, d, h, sch } = c;
    const front = B.get("paintwood").tint(sch.front);
    B.get("matte").tint("#2b2d2f").box(-w / 2, 0, -d / 2 + 0.06, w / 2, 0.1, d / 2);
    // fronts in 60 cm units: drawers and doors with a routed grip
    const n = Math.max(1, Math.round(w / 0.6));
    const uw = w / n;
    for (let k = 0; k < n; k++) {
      const x0 = -w / 2 + k * uw + 0.002, x1 = x0 + uw - 0.004;
      const drawers = c.it.variant === 1 && k === Math.floor(n / 2) ? 0 : (k % 2 === 0 ? 3 : 1);
      if (drawers <= 1) front.box(x0, 0.1, -d / 2, x1, h - 0.04, -d / 2 + 0.02);
      else for (let j = 0; j < drawers; j++) { const y0 = 0.1 + j * ((h - 0.14) / drawers), y1 = y0 + (h - 0.14) / drawers - 0.004; front.box(x0, y0, -d / 2, x1, y1, -d / 2 + 0.02); }
    }
    B.get("paintwood").tint(sch.front).box(-w / 2, 0.1, -d / 2 + 0.02, w / 2, h - 0.04, d / 2);
    // the worktop: 30 mm dark composite stone
    const top = B.get("gloss").tint("#3a3c3d");
    top.box(-w / 2, h - 0.04, -d / 2 - 0.02, w / 2, h - 0.01, d / 2);
    if (c.it.variant === 1) {
      // the sink under the window, with a tap
      const steel = B.get("chrome").tint("#c8cbce");
      steel.box(-0.3, h - 0.012, -d / 2 + 0.08, 0.3, h - 0.008, d / 2 - 0.12);
      B.get("metal").tint("#8b8f92").box(-0.27, h - 0.009, -d / 2 + 0.1, 0.27, h - 0.007, d / 2 - 0.14);
      steel.cyl(0, d / 2 - 0.08, 0.022, h - 0.01, h + 0.28, 12);
      steel.tube([0, h + 0.27, d / 2 - 0.08], [0, h + 0.27, d / 2 - 0.3], 0.013, 8);
      // the dishwasher (integrated) is the unit beside it; a dish rack and a bottle on the worktop
      B.get("gloss").tint("#e8e6e1").box(0.4, h - 0.01, -0.05, 0.62, h + 0.08, 0.15);
    } else {
      // a few things on the worktop: a chopping board, a kettle, a bowl of fruit
      B.get("oakwood").tint("#c79c6a").box(-0.35, h - 0.01, -0.15, 0.05, h + 0.01, 0.1);
      B.get("gloss").tint("#2c2f33").cyl(0.5, 0.05, 0.08, h - 0.01, h + 0.22, 14);
      B.get("gloss").tint("#e9e4da").lathe(-0.9, 0.0, [[0.0, h - 0.01], [0.09, h - 0.008], [0.13, h + 0.06]], 16);
      for (let k = 0; k < 4; k++) B.get("matte").tint(["#c0392b", "#e2b13c", "#7da34a", "#d35400"][k]).cyl(-0.9 + (k - 1.5) * 0.04, 0.0 + (k % 2) * 0.03, 0.035, h + 0.02, h + 0.08, 10);
      // under-cabinet light over the worktop comes from the shelf
    }
    return { hotZ: h + 0.4 };
  },
  kitchenTall(c) {
    const { B, w, d, h, sch } = c;
    const front = B.get("paintwood").tint(sch.front);
    B.get("paintwood").tint(sch.front).box(-w / 2, 0.1, -d / 2 + 0.02, w / 2, h, d / 2);
    B.get("matte").tint("#2b2d2f").box(-w / 2, 0, -d / 2 + 0.06, w / 2, 0.1, d / 2);
    if (c.it.variant === 0) {
      // an integrated fridge-freezer: two fronts
      front.box(-w / 2 + 0.002, 0.1, -d / 2, w / 2 - 0.002, 0.9, -d / 2 + 0.02);
      front.box(-w / 2 + 0.002, 0.905, -d / 2, w / 2 - 0.002, h - 0.002, -d / 2 + 0.02);
    } else {
      // the oven and the combination microwave at a working height
      front.box(-w / 2 + 0.002, 0.1, -d / 2, w / 2 - 0.002, 0.88, -d / 2 + 0.02);
      const blk = B.get("black").tint("#16191c");
      blk.box(-w / 2 + 0.01, 0.89, -d / 2 - 0.005, w / 2 - 0.01, 1.48, -d / 2 + 0.02);
      blk.box(-w / 2 + 0.01, 1.49, -d / 2 - 0.005, w / 2 - 0.01, 1.94, -d / 2 + 0.02);
      B.get("chrome").tint("#b9bcbe").box(-w / 2 + 0.06, 1.41, -d / 2 - 0.03, w / 2 - 0.06, 1.43, -d / 2 - 0.005);
      front.box(-w / 2 + 0.002, 1.95, -d / 2, w / 2 - 0.002, h - 0.002, -d / 2 + 0.02);
    }
  },
  island(c) {
    const { B, w, d, h, sch } = c;
    // the cabinets on the kitchen side, an overhang on the seating side, the induction hob with a downdraft extractor
    const body = 0.62;
    const z0 = d / 2 - body;   // cabinets at the back (the kitchen side); the front (seats) overhangs
    const front = B.get("paintwood").tint(sch.front === "#f2f0ec" ? "#3f4a48" : sch.front);
    front.box(-w / 2 + 0.02, 0.1, z0, w / 2 - 0.02, h - 0.04, d / 2);
    B.get("matte").tint("#2b2d2f").box(-w / 2 + 0.05, 0, z0 + 0.06, w / 2 - 0.05, 0.1, d / 2 - 0.06);
    const top = B.get("gloss").tint("#3a3c3d");
    top.box(-w / 2, h - 0.04, -d / 2, w / 2, h - 0.01, d / 2);
    // the hob: black glass with four zones, and the extractor slot behind it
    B.get("black").tint("#0f1113").box(-0.39, h - 0.012, z0 + 0.05, 0.39, h - 0.006, z0 + 0.57);
    const ring = B.get("matte").tint("#5a5e62");
    for (const [x, z] of [[-0.2, z0 + 0.18], [0.2, z0 + 0.18], [-0.2, z0 + 0.44], [0.2, z0 + 0.44]]) ring.disk(x, h - 0.0055, z, 0.1, 1, 24, 0.094);
    B.get("metal").tint("#2b2d30").box(-0.39, h - 0.011, z0 + 0.58, 0.39, h - 0.005, z0 + 0.61);
    // a pan on the hob and a book on the bar
    B.get("metal").tint("#3a3d40").cyl(0.2, z0 + 0.44, 0.12, h - 0.006, h + 0.07, 18);
    B.get("matte").tint(sch.accent).box(-0.7, h - 0.01, -d / 2 + 0.06, -0.45, h + 0.02, -d / 2 + 0.24);
    return { hotZ: h + 0.35 };
  },
  stool(c) {
    const { B, h } = c;
    const blk = B.get("metal").tint("#1f2224");
    for (const [x, z] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) blk.tube([x, 0, z], [x * 0.75, h - 0.03, z * 0.75], 0.012, 6);
    blk.tube([-0.12, 0.25, -0.12], [0.12, 0.25, -0.12], 0.008, 6);
    B.get("oakwood").tint("#c39a68").cyl(0, 0, 0.18, h - 0.03, h, 20);
  },
  pendant(c) {
    const { B, w, h } = c;
    // the cord to the ceiling (the item hangs at its z; the ceiling is above)
    const ceil = (c.it.level === "lower" ? HOUSE.lowerCeiling : c.it.at[1] > -1.1 ? vaultAt(c.it.at[1]) : HOUSE.flat) - (c.it.z ?? 0);
    B.get("black").tint("#202224").tube([0, h, 0], [0, ceil, 0], 0.004, 4);
    B.get("black").tint("#202224").cyl(0, 0, 0.045, ceil - 0.02, ceil, 12);
    const shade = B.get(c.it.variant === 1 ? "oakwood" : "matte").tint(c.it.variant === 1 ? "#d9b98d" : "#2c3135");
    if (c.it.variant === 1) shade.lathe(0, 0, [[w / 2, 0], [w / 2 - 0.01, 0.02], [w * 0.38, h * 0.6], [0.04, h]], 24);
    else shade.lathe(0, 0, [[w / 2, 0], [w / 2 - 0.005, 0.01], [w * 0.3, h * 0.55], [0.035, h]], 24);
    B.get("emissive").cyl(0, 0, 0.035, 0.02, 0.09, 12);
    return { lamp: [lampAt(c, 0, 0.05, 0, c.it.variant === 1 ? 0.7 : 0.55, "pendant")] };
  },
  shelf(c) {
    const { B, w, d, h } = c;
    if (c.it.variant === 1) {
      // storage shelving: galvanised uprights and shelves with boxes
      const steel = B.get("metal").tint("#9a9ea1");
      for (const x of [-w / 2, w / 2 - 0.03]) for (const z of [-d / 2, d / 2 - 0.03]) steel.box(x, 0, z, x + 0.03, h, z + 0.03);
      for (let k = 0; k < 5; k++) steel.box(-w / 2, 0.1 + k * 0.42, -d / 2, w / 2, 0.12 + k * 0.42, d / 2);
      for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) if (hash(k * 5 + j) > 0.35) B.get("matte").tint(["#c9c2b4", "#5b6a75", "#d8d2c6", "#8c7a63"][(k + j) % 4]).box(-w / 2 + 0.05 + j * 0.58, 0.12 + k * 0.42, -d / 2 + 0.03, -w / 2 + 0.5 + j * 0.58, 0.12 + k * 0.42 + 0.22 + 0.1 * hash(k + j * 3), d / 2 - 0.03);
      return;
    }
    // an oak shelf on black brackets, with jars and a plant
    B.get("oakwood").tint("#c59c6c").box(-w / 2, 0, -d / 2, w / 2, h, d / 2);
    for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) B.get("metal").tint("#1f2224").box(x - 0.01, -0.12, d / 2 - 0.2, x + 0.01, 0, d / 2);
    for (let k = 0; k < 4; k++) B.get("glass").cyl(-w / 2 + 0.2 + k * 0.13, 0, 0.045, h, h + 0.14 + 0.04 * (k % 2), 12);
    B.get("gloss").tint("#e8e2d6").cyl(w / 2 - 0.2, 0, 0.07, h, h + 0.12, 14);
    B.get("plant").tint("#4d7a46").soft(w / 2 - 0.3, h + 0.1, -0.1, w / 2 - 0.1, h + 0.3, 0.1, 0.06, false);
    // the light under the shelf over the worktop
    B.get("emissive").box(-w / 2 + 0.05, -0.008, -d / 2 + 0.03, w / 2 - 0.05, 0, -d / 2 + 0.05);
    return { lamp: [lampAt(c, 0, -0.02, -0.05, 0.3, "wall")] };
  },
  energyscreen(c) {
    const { B, w, d, h } = c;
    // the house's energy screen: power from the roof, the battery, the heat pump, the grid, live
    B.get("black").tint("#111315").soft(-w / 2, 0, -d / 2, w / 2, h, d / 2, 0.006, false);
    B.get("screen").panel(-w / 2 + 0.01, 0.01, w / 2 - 0.01, h - 0.01, -d / 2 - 0.0015, [0, 0.5, 1, 1]);
    return { hotZ: h + 0.15 };
  },
  thermostat(c) {
    const { B, w, d, h } = c;
    B.get("gloss").tint("#f4f4f2").soft(-w / 2, 0, -d / 2, w / 2, h, d / 2, 0.008, false);
    B.get("screen").panel(-0.025, 0.035, 0.025, 0.06, -d / 2 - 0.0015, [0.5, 0, 0.75, 0.25]);
  },
  smoke(c) {
    const { B, w } = c;
    B.get("gloss").tint("#f5f5f3").lathe(0, 0, [[0.0, -0.04], [w / 2 - 0.01, -0.035], [w / 2, -0.01], [w / 2 - 0.005, 0]], 20);
    B.get("led").cyl(0, 0, 0.004, -0.045, -0.04, 6);
  },
  extinguisher(c) {
    const { B, h } = c;
    // a 6 kg extinguisher on its bracket: one belongs in every Norwegian home
    B.get("gloss").tint("#c0221a").cyl(0, 0, 0.075, 0, h - 0.08, 18);
    B.get("gloss").tint("#c0221a").lathe(0, 0, [[0.075, h - 0.08], [0.06, h - 0.04], [0.02, h - 0.02]], 18);
    B.get("black").tint("#1b1d1f").box(-0.04, h - 0.03, -0.015, 0.06, h, 0.015);
    B.get("black").tint("#1b1d1f").tube([0.02, h - 0.03, 0], [0.09, h - 0.2, -0.02], 0.01, 6);
    B.get("metal").tint("#5e6266").box(-0.03, h * 0.5, 0.075, 0.03, h * 0.7, 0.09);
  },
  downlight(c) {
    const { B, w } = c;
    B.get("chrome").tint("#e7e7e5").cyl(0, 0, w / 2, -0.008, 0.0, 16, false);
    B.get("emissive").disk(0, -0.009, 0, w / 2 - 0.012, -1, 16);
    return { lamp: [lampAt(c, 0, -0.05, 0, 0.75, "down")] };
  },
  // ---------------------------------------------------------------- living
  table(c) {
    const { B, w, d, h } = c;
    const oak = B.get("oakwood").tint("#c79f6d");
    oak.soft(-w / 2, h - 0.035, -d / 2, w / 2, h, d / 2, 0.006, false);
    for (const [x, z] of [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]]) oak.box(x - 0.025, 0, z - 0.025, x + 0.025, h - 0.035, z + 0.025);
    oak.box(-w / 2 + 0.08, h - 0.11, -d / 2 + 0.06, w / 2 - 0.08, h - 0.035, -d / 2 + 0.085);
    oak.box(-w / 2 + 0.08, h - 0.11, d / 2 - 0.085, w / 2 - 0.08, h - 0.035, d / 2 - 0.06);
    // a vase with branches and two place mats
    B.get("gloss").tint("#d8d3c8").lathe(0.1, 0, [[0.0, h], [0.06, h + 0.005], [0.07, h + 0.12], [0.04, h + 0.2], [0.045, h + 0.24]], 16);
    for (const x of [-0.5, 0.5]) B.get("fabric").tint("#9c968b").box(x - 0.2, h, -0.15, x + 0.2, h + 0.004, 0.15);
  },
  chair(c) {
    const { B, w, d, h, sch } = c;
    const oak = B.get("oakwood").tint("#c39a68");
    const sh = 0.45;
    for (const [x, z] of [[-w / 2 + 0.04, -d / 2 + 0.04], [w / 2 - 0.04, -d / 2 + 0.04], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) oak.tube([x * 1.05, 0, z * 1.05], [x, sh - 0.02, z], 0.015, 6);
    B.get("fabric").tint(sch.fabric2).soft(-w / 2, sh - 0.03, -d / 2, w / 2, sh + 0.03, d / 2 - 0.02, 0.015, false);
    // the curved back on two rear legs carried up
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) oak.tube([x, sh, d / 2 - 0.05], [x * 0.95, h - 0.02, d / 2 - 0.02], 0.014, 6);
    oak.soft(-w / 2 + 0.03, h - 0.14, d / 2 - 0.045, w / 2 - 0.03, h, d / 2, 0.01, false);
  },
  sofa(c) {
    const { B, w, d, h, sch } = c;
    const fab = B.get("fabric").tint(c.it.variant === 1 ? sch.fabric2 : sch.fabric);
    const seat = 0.42, arm = 0.18;
    B.get("metal").tint("#1f2224");
    for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) B.get("metal").cyl(x, z, 0.02, 0, 0.1, 8);
    fab.soft(-w / 2, 0.1, -d / 2 + 0.05, w / 2, seat - 0.12, d / 2, 0.03, false);
    // seat cushions, back cushions, arms
    const n = w > 2.4 ? 3 : 2;
    const cw = (w - 2 * arm) / n;
    for (let k = 0; k < n; k++) {
      const x0 = -w / 2 + arm + k * cw + 0.005, x1 = x0 + cw - 0.01;
      fab.soft(x0, seat - 0.12, -d / 2 + 0.03, x1, seat, d / 2 - 0.2, 0.045, false);
      fab.soft(x0, seat, d / 2 - 0.24, x1, h, d / 2 - 0.02, 0.06, false);
    }
    fab.soft(-w / 2, 0.1, -d / 2 + 0.03, -w / 2 + arm, seat + 0.18, d / 2, 0.05, false);
    fab.soft(w / 2 - arm, 0.1, -d / 2 + 0.03, w / 2, seat + 0.18, d / 2, 0.05, false);
    fab.box(-w / 2 + arm, seat - 0.12, d / 2 - 0.2, w / 2 - arm, h - 0.1, d / 2);
    // a throw and two cushions
    B.get("fabric").tint(sch.throw).soft(w / 2 - arm - 0.55, seat, -d / 2 + 0.1, w / 2 - arm - 0.05, seat + 0.03, d / 2 - 0.25, 0.012, false);
    B.get("fabric").tint(sch.accent).soft(-w / 2 + arm + 0.05, seat, d / 2 - 0.4, -w / 2 + arm + 0.48, seat + 0.42, d / 2 - 0.25, 0.07, false);
  },
  armchair(c) {
    const { B, w, d, h, sch } = c;
    const fab = B.get("fabric").tint(sch.fabric2);
    const oak = B.get("oakwood").tint("#b88f5e");
    for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06]]) oak.tube([x, 0, z], [x, 0.2, z], 0.018, 6);
    fab.soft(-w / 2, 0.2, -d / 2, w / 2, 0.42, d / 2, 0.05, false);
    fab.soft(-w / 2 + 0.02, 0.42, d / 2 - 0.2, w / 2 - 0.02, h, d / 2, 0.07, false);
    fab.soft(-w / 2, 0.42, -d / 2 + 0.05, -w / 2 + 0.12, 0.6, d / 2, 0.04, false);
    fab.soft(w / 2 - 0.12, 0.42, -d / 2 + 0.05, w / 2, 0.6, d / 2, 0.04, false);
  },
  coffeetable(c) {
    const { B, w, d, h, sch } = c;
    const oak = B.get("oakwood").tint("#c79f6d");
    oak.soft(-w / 2, h - 0.03, -d / 2, w / 2, h, d / 2, 0.01, false);
    for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06]]) oak.tube([x, 0, z], [x, h - 0.03, z], 0.018, 6);
    oak.box(-w / 2 + 0.05, 0.12, -d / 2 + 0.05, w / 2 - 0.05, 0.14, d / 2 - 0.05);
    // books and a bowl
    for (let k = 0; k < 3; k++) B.get("matte").tint(["#2f4b5c", "#d8cdb8", sch.accent][k]).box(-0.35 + k * 0.01, h + k * 0.025, -0.12, -0.05 - k * 0.02, h + (k + 1) * 0.025, 0.1);
    B.get("gloss").tint("#3b3f42").lathe(0.3, 0, [[0.0, h], [0.1, h + 0.004], [0.15, h + 0.07]], 18);
  },
  rug(c) {
    const { B, w, d, sch } = c;
    B.get("fabric").tint(c.it.variant === 1 ? "#b8b0a2" : sch.fabric2).box(-w / 2, 0.001, -d / 2, w / 2, 0.012, d / 2);
  },
  sideboard(c) {
    const { B, w, d, h, sch } = c;
    const oak = B.get("oakwood").tint("#b98f5c");
    for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) B.get("metal").tint("#1f2224").box(x - 0.012, 0, z - 0.012, x + 0.012, 0.14, z + 0.012);
    oak.soft(-w / 2, 0.14, -d / 2, w / 2, h, d / 2, 0.008, false);
    for (let k = 1; k < 3; k++) B.get("black").tint("#2b2a28").box(-w / 2 + (k * w) / 3 - 0.002, 0.16, -d / 2 - 0.002, -w / 2 + (k * w) / 3 + 0.002, h - 0.02, -d / 2 + 0.002);
    // on top: books, a lamp, a plant
    B.get("matte").tint(sch.accent).box(-w / 2 + 0.1, h, -0.1, -w / 2 + 0.35, h + 0.05, 0.12);
    B.get("gloss").tint("#e3ddd1").lathe(w / 2 - 0.25, 0, [[0.0, h], [0.08, h + 0.01], [0.09, h + 0.2], [0.05, h + 0.3]], 16);
    B.get("plant").tint("#527e4a").soft(w / 2 - 0.36, h + 0.28, -0.12, w / 2 - 0.14, h + 0.5, 0.1, 0.08, false);
  },
  bookcase(c) {
    const { B, w, d, h } = c;
    const oak = B.get("oakwood").tint("#c59c6c");
    oak.box(-w / 2, 0, d / 2 - 0.015, w / 2, h, d / 2);
    for (const x of [-w / 2, w / 2 - 0.02]) oak.box(x, 0, -d / 2, x + 0.02, h, d / 2);
    for (let k = 0; k < 6; k++) oak.box(-w / 2, k * 0.38, -d / 2, w / 2, k * 0.38 + 0.02, d / 2);
    // rows of books of different heights and colours
    const cols = ["#2f4b5c", "#d8cdb8", "#8c3b2e", "#4a5d3f", "#e2d6bd", "#1f2a33", "#a88a5a", "#6e7f8c"];
    for (let k = 0; k < 5; k++) {
      let x = -w / 2 + 0.03;
      while (x < w / 2 - 0.08) {
        const bw = 0.025 + 0.025 * hash(x * 17 + k), bh = 0.2 + 0.12 * hash(x * 31 + k * 3);
        if (hash(x * 7 + k * 11) > 0.12) B.get("matte").tint(cols[Math.floor(hash(x * 13 + k) * cols.length)]).box(x, k * 0.38 + 0.02, -d / 2 + 0.04 + 0.03 * hash(x + k), x + bw, k * 0.38 + 0.02 + Math.min(0.34, bh), d / 2 - 0.02);
        x += bw + 0.002 + (hash(x * 5 + k) > 0.9 ? 0.15 : 0);
      }
    }
  },
  floorlamp(c) {
    const { B, h } = c;
    const blk = B.get("metal").tint("#1f2224");
    blk.cyl(0, 0, 0.14, 0, 0.02, 20);
    blk.tube([0, 0.02, 0], [0, h - 0.25, 0], 0.012, 6);
    B.get("fabric").tint("#ede6da").lathe(0, 0, [[0.2, h - 0.3], [0.2, h - 0.02], [0.16, h]], 24);
    B.get("emissive").cyl(0, 0, 0.03, h - 0.25, h - 0.18, 10);
    return { lamp: [lampAt(c, 0, h - 0.2, 0, 0.5, "point")] };
  },
  plant(c) {
    const { B, w, h } = c;
    // a pot and a fiddle-leaf fig (or a smaller leafy plant)
    B.get("gloss").tint(c.it.variant === 0 ? "#e6e1d8" : "#b5694a").lathe(0, 0, [[0.0, 0.0], [w * 0.36, 0.0], [w * 0.42, h * 0.22], [w * 0.4, h * 0.23]], 18);
    B.get("matte").tint("#3b2f25").disk(0, h * 0.21, 0, w * 0.39, 1, 18);
    const stem = B.get("oakwood").tint("#6b5136");
    stem.tube([0, h * 0.2, 0], [0.02, h * 0.95, 0.01], 0.012, 6);
    const leaf = B.get("plant").tint(c.it.variant === 0 ? "#3f6b3a" : "#5c8a4c");
    const n = c.it.variant === 0 ? 22 : 14;
    for (let k = 0; k < n; k++) {
      const a = k * 2.399, t = k / n;
      const y = h * (0.35 + 0.6 * t), r = w * (0.15 + 0.35 * Math.sin(t * Math.PI));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const s = 0.07 + 0.07 * (1 - Math.abs(t - 0.5));
      // a leaf: a quad tilted out from the stem, both faces
      const p0: [number, number, number] = [x * 0.4, y - 0.03, z * 0.4], p1: [number, number, number] = [x + Math.cos(a + 1.2) * s, y, z + Math.sin(a + 1.2) * s], p2: [number, number, number] = [x * 1.4, y + 0.04, z * 1.4], p3: [number, number, number] = [x + Math.cos(a - 1.2) * s, y, z + Math.sin(a - 1.2) * s];
      leaf.quad(p0, p1, p2, p3);
      leaf.quad(p3, p2, p1, p0);
    }
  },
  art(c) {
    const { B, w, d, h } = c;
    // a framed print: the view from Knotten in a few colours (sky, the far hills, the fjord, the near rock)
    B.get("oakwood").tint("#2b2a28").box(-w / 2, 0, -d / 2, w / 2, h, d / 2);
    const z = -d / 2 - 0.001;
    const band = (y0: number, y1: number, col: string) => B.get("matte").tint(col).box(-w / 2 + 0.04, y0, z - 0.001, w / 2 - 0.04, y1, z);
    band(0.04, h * 0.3, "#5c6b4f");
    band(h * 0.3, h * 0.42, "#3d6a82");
    band(h * 0.42, h * 0.52, "#7d8b95");
    band(h * 0.52, h - 0.04, "#d9cdb4");
    B.get("matte").tint("#e8b45a").fdisk(w * 0.18, h * 0.72, z - 0.002, 0.05, -1, 18);
  },
  // ---------------------------------------------------------------- bedrooms
  bed(c) {
    const { B, w, d, h, sch } = c;
    const oak = B.get("oakwood").tint("#c39a68");
    oak.box(-w / 2, 0.08, -d / 2, w / 2, 0.3, d / 2);
    for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) oak.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.08, z + 0.03);
    // the headboard at the back, the mattress, the duvet folded back, the pillows
    B.get("fabric").tint(c.it.variant === 2 ? sch.accent : sch.fabric).soft(-w / 2, 0.25, d / 2 - 0.08, w / 2, 1.05, d / 2 + 0.02, 0.04, false);
    B.get("fabric").tint("#f4f2ee").soft(-w / 2 + 0.02, 0.3, -d / 2 + 0.02, w / 2 - 0.02, h, d / 2 - 0.1, 0.05, false);
    B.get("fabric").tint(sch.bed).soft(-w / 2 + 0.01, h - 0.02, -d / 2 + 0.01, w / 2 - 0.01, h + 0.08, d / 2 - 0.55, 0.06, false);
    B.get("fabric").tint(sch.throw).soft(-w / 2 - 0.01, h + 0.06, -d / 2 + 0.05, w / 2 + 0.01, h + 0.09, -d / 2 + 0.55, 0.02, false);
    const pw = w > 1 ? (w - 0.12) / 2 : w - 0.1;
    for (let k = 0; k < (w > 1 ? 2 : 1); k++) {
      const x0 = -w / 2 + 0.05 + k * (pw + 0.02);
      B.get("fabric").tint("#f7f6f3").soft(x0, h, d / 2 - 0.5, x0 + pw, h + 0.14, d / 2 - 0.12, 0.06, false);
    }
  },
  nightstand(c) {
    const { B, w, d, h } = c;
    const oak = B.get("oakwood").tint("#c59c6c");
    oak.soft(-w / 2, 0.15, -d / 2, w / 2, h, d / 2, 0.008, false);
    for (const [x, z] of [[-w / 2 + 0.04, -d / 2 + 0.04], [w / 2 - 0.04, -d / 2 + 0.04], [-w / 2 + 0.04, d / 2 - 0.04], [w / 2 - 0.04, d / 2 - 0.04]]) oak.tube([x, 0, z], [x, 0.15, z], 0.012, 6);
    B.get("black").tint("#2b2a28").box(-w / 2 + 0.03, h - 0.12, -d / 2 - 0.002, w / 2 - 0.03, h - 0.115, -d / 2);
    // a small lamp and a book
    B.get("gloss").tint("#e5ded1").lathe(0.08, 0.05, [[0.0, h], [0.06, h], [0.035, h + 0.18], [0.0, h + 0.19]], 14);
    B.get("fabric").tint("#efe8dc").lathe(0.08, 0.05, [[0.1, h + 0.17], [0.1, h + 0.3], [0.07, h + 0.31]], 18);
    B.get("emissive").cyl(0.08, 0.05, 0.02, h + 0.2, h + 0.26, 8);
    B.get("matte").tint("#3f5a73").box(-0.15, h, -0.1, 0.0, h + 0.03, 0.08);
    return { lamp: [lampAt(c, 0.08, h + 0.24, 0.05, 0.18, "point")] };
  },
  wardrobe(c) {
    const { B, w, d, h } = c;
    const white = B.get("paintwood").tint("#f2f0ec");
    white.box(-w / 2, 0.08, -d / 2 + 0.02, w / 2, h, d / 2);
    B.get("matte").tint("#2b2d2f").box(-w / 2 + 0.02, 0, -d / 2 + 0.06, w / 2 - 0.02, 0.08, d / 2);
    const n = Math.max(1, Math.round(w / 0.5));
    const dw = w / n;
    for (let k = 0; k < n; k++) {
      const x0 = -w / 2 + k * dw + 0.002;
      white.box(x0, 0.08, -d / 2, x0 + dw - 0.004, h - 0.002, -d / 2 + 0.02);
      const hx = k % 2 === 0 ? x0 + dw - 0.05 : x0 + 0.05;
      B.get("metal").tint("#2a2c2e").box(hx - 0.006, 0.9, -d / 2 - 0.025, hx + 0.006, 1.3, -d / 2);
    }
  },
  desk(c) {
    const { B, w, d, h } = c;
    const oak = B.get("oakwood").tint("#c79f6d");
    oak.soft(-w / 2, h - 0.025, -d / 2, w / 2, h, d / 2, 0.005, false);
    for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) { B.get("metal").tint("#1f2224").box(x - 0.015, 0, -d / 2 + 0.05, x + 0.015, h - 0.025, -d / 2 + 0.08); B.get("metal").tint("#1f2224").box(x - 0.015, 0, d / 2 - 0.08, x + 0.015, h - 0.025, d / 2 - 0.05); }
    // a laptop and a lamp
    B.get("metal").tint("#9da2a7").box(-0.17, h, -0.12, 0.17, h + 0.015, 0.11);
    B.get("metal").tint("#9da2a7").box(-0.17, h + 0.01, 0.1, 0.17, h + 0.23, 0.115);
    B.get("black").tint("#14171a").box(-0.155, h + 0.025, 0.098, 0.155, h + 0.215, 0.1);
    B.get("metal").tint("#1f2224").tube([w / 2 - 0.15, h, 0.15], [w / 2 - 0.2, h + 0.4, 0.05], 0.008, 6);
    B.get("emissive").cyl(w / 2 - 0.2, 0.05, 0.03, h + 0.36, h + 0.4, 10);
    return { lamp: [lampAt(c, w / 2 - 0.2, h + 0.35, 0.05, 0.2, "point")] };
  },
  officechair(c) {
    const { B, w, h, sch } = c;
    const blk = B.get("metal").tint("#1f2224");
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; blk.tube([0, 0.05, 0], [Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3], 0.015, 6); }
    blk.tube([0, 0.05, 0], [0, 0.42, 0], 0.025, 8);
    B.get("fabric").tint(sch.fabric).soft(-w / 2 + 0.03, 0.42, -w / 2 + 0.05, w / 2 - 0.03, 0.5, w / 2 - 0.05, 0.03, false);
    B.get("fabric").tint(sch.fabric).soft(-w / 2 + 0.05, 0.55, w / 2 - 0.12, w / 2 - 0.05, h, w / 2 - 0.05, 0.03, false);
  },
  bench(c) {
    const { B, w, d, h } = c;
    const oak = B.get("oakwood").tint("#c79f6d");
    oak.box(-w / 2, h - 0.04, -d / 2, w / 2, h, d / 2);
    oak.box(-w / 2, 0.08, -d / 2, w / 2, 0.1, d / 2);
    for (const x of [-w / 2, w / 2 - 0.03]) oak.box(x, 0, -d / 2, x + 0.03, h - 0.04, d / 2);
    // shoes on the shelf
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) B.get("matte").tint(["#2a2d30", "#7a5b40", "#c7c2b8"][k]).soft(-w / 2 + 0.12 + k * 0.27 + s * 0.045 - 0.04, 0.1, -0.11, -w / 2 + 0.12 + k * 0.27 + s * 0.045 + 0.04, 0.18, 0.15, 0.03, false);
  },
  hooks(c) {
    const { B, w, d } = c;
    B.get("oakwood").tint("#c79f6d").box(-w / 2, 0, -d / 2, w / 2, 0.08, d / 2);
    for (let k = 0; k < 5; k++) B.get("metal").tint("#1f2224").tube([-w / 2 + 0.1 + k * ((w - 0.2) / 4), 0.04, -d / 2], [-w / 2 + 0.1 + k * ((w - 0.2) / 4), 0.07, -d / 2 - 0.07], 0.007, 6);
    // two jackets and a scarf
    for (const [x, col] of [[-0.25, "#2f3e4c"], [0.15, "#8a6a4a"]] as [number, string][]) B.get("fabric").tint(col).soft(x - 0.2, -0.85, -d / 2 - 0.16, x + 0.2, 0.06, -d / 2 + 0.0, 0.06, false);
    B.get("fabric").tint("#b34b3a").soft(0.32, -0.55, -d / 2 - 0.1, 0.4, 0.05, -d / 2 - 0.02, 0.02, false);
  },
  skis(c) {
    const { B, h } = c;
    for (let k = 0; k < 2; k++) for (const s of [-0.03, 0.03]) B.get("gloss").tint(["#d7dee3", "#c8453a"][k]).box(-0.25 + k * 0.3 + s - 0.035, 0, -0.02, -0.25 + k * 0.3 + s + 0.035, h - k * 0.1, 0.0);
    B.get("metal").tint("#2b2d30").tube([0.25, 0, -0.02], [0.3, 1.35, 0.0], 0.008, 6);
    B.get("metal").tint("#2b2d30").tube([0.28, 0, -0.02], [0.33, 1.35, 0.0], 0.008, 6);
  },
  boxes(c) {
    const { B, w, d } = c;
    const cols = ["#c9b59a", "#b7a284", "#d8c9b0"];
    B.get("matte").tint(cols[0]).box(-w / 2, 0, -d / 2, 0, 0.35, d / 2);
    B.get("matte").tint(cols[1]).box(0.02, 0, -d / 2, w / 2, 0.3, d / 2);
    B.get("matte").tint(cols[2]).box(-w / 2 + 0.05, 0.35, -d / 2 + 0.05, -0.05, 0.6, d / 2 - 0.05);
  },
  tv(c) {
    const { B, w, d, h } = c;
    B.get("black").tint("#0d0f11").box(-w / 2, 0, -d / 2 + 0.03, w / 2, h, d / 2);
    B.get("black").tint("#050607").box(-w / 2 + 0.01, 0.01, -d / 2 + 0.028, w / 2 - 0.01, h - 0.01, -d / 2 + 0.031);
  },
};
