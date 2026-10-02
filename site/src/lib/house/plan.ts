/**
 * The model's example house, room by room: one house type for all 30 plots, drawn inside the box that
 * data/plots.json gives every plot (11 x 8.5 m, eaves 3.2 m and ridge 5.6 m above the main floor, the
 * long side to the view). It is an illustration of how a house at Knotten can be laid out and built
 * to the energy measures the project has chosen; the project has no house design yet.
 *
 * Coordinates are the house's own, in metres: u along the long side (+u to the right when facing the
 * view), v towards the view, z up from the finished main floor. Everything is drawn for the plain
 * house; every other house is the same plan mirrored (u -> -u), as builders vary a row of one type.
 *
 * Where the ground in front lies low enough (pipeline/twin_houses.py), the house also has a lower
 * floor under its view side, reached by a stair from the entrance hall and opening onto a patio.
 *
 * Dimensions follow TEK17 where it sets them: rooms at least 2.4 m high, entrance and inner doors with
 * at least 0.86 m free width, stairs 2 risers + 1 tread = 620 +- 20 mm with treads at least 0.25 m,
 * railings 1.0 m on terraces and 0.9 m on stairs, a 1.5 m turning circle in the bathroom. The outer
 * walls are 0.35 m (the thickness of a timber wall insulated to TEK17's U 0.18 for small houses).
 */
import TYPE from "./houseType.json";

export type Level = "main" | "lower";
export type Side = "front" | "back" | "left" | "right";
export type T2 = { no: string; en: string };

export const HOUSE = {
  W: 11.0, D: 8.5,
  hw: 5.5, hd: 4.25,
  wall: TYPE.wall,
  /** the inner faces of the outer walls */
  iw: 5.5 - TYPE.wall, id: 4.25 - TYPE.wall,
  eave: 3.2, ridge: 5.6,
  /** the roof's own depth measured straight down: rafters and insulation for U 0.13 */
  roofDepth: 0.46,
  overhang: 0.5,
  /** flat ceilings over the service rooms (ducts run above them) */
  flat: 2.45,
  lower: -TYPE.lower_depth,
  lowerCeiling: -TYPE.lower_slab,
  lowerBack: TYPE.lower_back_v,
  terraceDepth: TYPE.terrace.depth,
  terraceInset: TYPE.terrace.inset,
  patioDepth: TYPE.patio.depth,
  patioSide: TYPE.patio.side,
};

/** Height of the outer roof surface over a point (v across the house); the eaves edge is at |v| = hd. */
export const roofTop = (v: number) => HOUSE.eave + (HOUSE.hd - Math.abs(v)) * ((HOUSE.ridge - HOUSE.eave) / HOUSE.hd);
/** Height of the vaulted ceiling inside, under the roof's own depth. */
export const vaultAt = (v: number) => roofTop(v) - HOUSE.roofDepth;
export const PITCH_DEG = (Math.atan((HOUSE.ridge - HOUSE.eave) / HOUSE.hd) * 180) / Math.PI;

export type Rect = { u0: number; u1: number; v0: number; v1: number };

export type RoomId = "tech" | "bath" | "hall" | "bedroom" | "living" | "family" | "bed2" | "bed3" | "bath2" | "store" | "stair";
export type Room = {
  id: RoomId;
  level: Level;
  rect: Rect;
  name: T2;
  floor: "oak" | "tile" | "stone";
  ceiling: "flat" | "vault";
  /** the house without a lower floor leaves this room out */
  lowerOnly?: boolean;
};

const n = (no: string, en: string): T2 => ({ no, en });
const I = HOUSE.iw, J = HOUSE.id;

/** The rooms. The living room's rectangle is the whole open front band (kitchen, dining and living). */
export const ROOMS: Room[] = [
  { id: "tech", level: "main", rect: { u0: -I, u1: -3.05, v0: -J, v1: -1.2 }, name: n("Teknisk rom og vaskerom", "Plant and laundry room"), floor: "tile", ceiling: "flat" },
  { id: "bath", level: "main", rect: { u0: -2.93, u1: -0.37, v0: -J, v1: -1.2 }, name: n("Bad", "Bathroom"), floor: "tile", ceiling: "flat" },
  { id: "hall", level: "main", rect: { u0: -0.25, u1: 2.15, v0: -J, v1: -1.2 }, name: n("Entré", "Entrance hall"), floor: "stone", ceiling: "flat" },
  { id: "bedroom", level: "main", rect: { u0: 2.25, u1: I, v0: -J, v1: -1.2 }, name: n("Soverom", "Bedroom"), floor: "oak", ceiling: "flat" },
  { id: "living", level: "main", rect: { u0: -I, u1: I, v0: -1.1, v1: J }, name: n("Kjøkken og stue", "Kitchen and living room"), floor: "oak", ceiling: "vault" },
  { id: "family", level: "lower", rect: { u0: -1.4, u1: 2.55, v0: -0.5, v1: J }, name: n("Allrom", "Family room"), floor: "oak", ceiling: "flat", lowerOnly: true },
  { id: "bed2", level: "lower", rect: { u0: -I, u1: -1.52, v0: 1.1, v1: J }, name: n("Soverom 2", "Bedroom 2"), floor: "oak", ceiling: "flat", lowerOnly: true },
  { id: "bath2", level: "lower", rect: { u0: -I, u1: -1.52, v0: -0.5, v1: 0.98 }, name: n("Bad 2", "Bathroom 2"), floor: "tile", ceiling: "flat", lowerOnly: true },
  { id: "bed3", level: "lower", rect: { u0: 2.67, u1: I, v0: 1.1, v1: J }, name: n("Soverom 3", "Bedroom 3"), floor: "oak", ceiling: "flat", lowerOnly: true },
  { id: "store", level: "lower", rect: { u0: 2.67, u1: I, v0: -0.5, v1: 0.98 }, name: n("Bod", "Storage"), floor: "stone", ceiling: "flat", lowerOnly: true },
  { id: "stair", level: "lower", rect: { u0: 1.2, u1: 2.15, v0: -3.3, v1: -0.5 }, name: n("Trapp", "Stair"), floor: "oak", ceiling: "flat", lowerOnly: true },
];

/**
 * Inner walls as rectangles in plan (thickness included), full height to the ceiling above them. A
 * wall in the vaulted band rises to the vault. `doors` are door openings along the wall's long axis.
 */
export type Partition = { id: string; level: Level; rect: Rect; doors: DoorSpec[]; lowerOnly?: boolean; wet?: boolean };
/** A door in an inner wall: centre along the wall, leaf width, hinge at the low or high end, and the side it opens to. */
export type DoorSpec = { id: string; at: number; w: number; hinge: "lo" | "hi"; into: 1 | -1; room: RoomId };

export const PARTITIONS: Partition[] = [
  // main floor, the back band: plant room | bath | hall | bedroom, and its wall to the open front band
  { id: "tech-bath", level: "main", rect: { u0: -3.05, u1: -2.93, v0: -J, v1: -1.2 }, doors: [], wet: true },
  { id: "bath-hall", level: "main", rect: { u0: -0.37, u1: -0.25, v0: -J, v1: -1.2 }, doors: [{ id: "d-bath", at: -2.1, w: 0.9, hinge: "lo", into: -1, room: "bath" }], wet: true },
  { id: "hall-bedroom", level: "main", rect: { u0: 2.15, u1: 2.25, v0: -J, v1: -1.2 }, doors: [] },
  { id: "front-left", level: "main", rect: { u0: -I, u1: -0.25, v0: -1.2, v1: -1.1 }, doors: [{ id: "d-tech", at: -4.1, w: 0.9, hinge: "lo", into: -1, room: "tech" }] },
  { id: "front-right", level: "main", rect: { u0: 2.15, u1: I, v0: -1.2, v1: -1.1 }, doors: [{ id: "d-bedroom", at: 2.85, w: 0.9, hinge: "lo", into: -1, room: "bedroom" }] },
  // the lower floor: bedroom 2 and bath 2 to the left of the family room, bedroom 3 and storage to the right
  { id: "l-left", level: "lower", rect: { u0: -1.52, u1: -1.4, v0: -0.5, v1: J }, lowerOnly: true, wet: true, doors: [{ id: "d-bath2", at: 0.2, w: 0.9, hinge: "lo", into: -1, room: "bath2" }, { id: "d-bed2", at: 1.85, w: 0.9, hinge: "hi", into: -1, room: "bed2" }] },
  { id: "l-left-mid", level: "lower", rect: { u0: -I, u1: -1.52, v0: 0.98, v1: 1.1 }, lowerOnly: true, wet: true, doors: [] },
  { id: "l-right", level: "lower", rect: { u0: 2.55, u1: 2.67, v0: -0.5, v1: J }, lowerOnly: true, doors: [{ id: "d-store", at: 0.15, w: 0.9, hinge: "hi", into: 1, room: "store" }, { id: "d-bed3", at: 1.85, w: 0.9, hinge: "lo", into: 1, room: "bed3" }] },
  { id: "l-right-mid", level: "lower", rect: { u0: 2.67, u1: I, v0: 0.98, v1: 1.1 }, lowerOnly: true, doors: [] },
];

/** The stair down: in the hall along the bedroom wall, descending towards the view. */
export const STAIR = {
  u0: 1.2, u1: 2.15,
  top: -3.3,                 // nosing of the first step at the main floor
  risers: 15,
  rise: TYPE.lower_depth / 15,          // 0.1833 m
  tread: 0.255,              // 2R + G = 0.622 m
  /** where the stair has to be open above for 2.0 m headroom under the main floor */
  openTo: -0.31,
};
export const stairBottom = () => STAIR.top + (STAIR.risers - 1) * STAIR.tread;

/**
 * Openings in the outer walls. `c` is the centre along the wall (u on front and back, v on the
 * gables), `w` the width, z0 and z1 the sill and head above that level's floor.
 */
export type OpeningKind = "window" | "fixed" | "slide" | "entry" | "garden" | "gable";
export type Opening = { id: string; side: Side; level: Level; c: number; w: number; z0: number; z1: number; kind: OpeningKind; room: RoomId; lowerOnly?: boolean; frosted?: boolean };

export const OPENINGS: Opening[] = [
  // the view side of the main floor: kitchen window over the sink, the glass wall and the sliding door, the living room corner
  { id: "w-kitchen", side: "front", level: "main", c: -3.8, w: 1.6, z0: 0.95, z1: 2.4, kind: "window", room: "living" },
  { id: "w-glass", side: "front", level: "main", c: -1.3, w: 2.2, z0: 0.0, z1: 2.4, kind: "fixed", room: "living" },
  { id: "w-slide", side: "front", level: "main", c: 1.1, w: 2.6, z0: 0.0, z1: 2.4, kind: "slide", room: "living" },
  { id: "w-corner", side: "front", level: "main", c: 3.8, w: 1.6, z0: 0.5, z1: 2.4, kind: "window", room: "living" },
  // the gables: over the kitchen worktop, the living room, the bedroom, and up in the vault
  { id: "w-left-kitchen", side: "left", level: "main", c: 1.2, w: 1.2, z0: 1.05, z1: 2.1, kind: "window", room: "living" },
  { id: "w-left-top", side: "left", level: "main", c: 0.0, w: 0.9, z0: 3.05, z1: 4.15, kind: "gable", room: "living" },
  { id: "w-right-living", side: "right", level: "main", c: 1.7, w: 1.4, z0: 0.6, z1: 2.4, kind: "window", room: "living" },
  { id: "w-right-top", side: "right", level: "main", c: 0.0, w: 0.9, z0: 3.05, z1: 4.15, kind: "gable", room: "living" },
  // the entrance side: the front door, the bathroom (frosted) and the bedroom
  { id: "d-entry", side: "back", level: "main", c: 0.6, w: 1.0, z0: 0.0, z1: 2.1, kind: "entry", room: "hall" },
  { id: "w-bath", side: "back", level: "main", c: -1.6, w: 0.8, z0: 1.5, z1: 2.1, kind: "window", room: "bath", frosted: true },
  { id: "w-bed-back", side: "back", level: "main", c: 3.8, w: 1.4, z0: 0.9, z1: 2.1, kind: "window", room: "bedroom" },
  // the lower floor opens to the patio
  { id: "w-bed2", side: "front", level: "lower", c: -3.5, w: 1.6, z0: 0.8, z1: 2.1, kind: "window", room: "bed2", lowerOnly: true },
  { id: "d-garden", side: "front", level: "lower", c: 0.2, w: 2.2, z0: 0.0, z1: 2.2, kind: "garden", room: "family", lowerOnly: true },
  { id: "w-bed3", side: "front", level: "lower", c: 3.9, w: 1.6, z0: 0.8, z1: 2.1, kind: "window", room: "bed3", lowerOnly: true },
];

/** Floor level (z of the finished floor) of a level, relative to the main floor. */
export const levelZ = (l: Level) => (l === "main" ? 0 : HOUSE.lower);

/** An opening's rectangle on its wall: s along the wall, z above the main floor. */
export function holeRect(o: Opening) {
  const z = levelZ(o.level);
  return { s0: o.c - o.w / 2, s1: o.c + o.w / 2, z0: z + o.z0, z1: z + o.z1 };
}

/**
 * Furniture and fixtures, by kind. `at` is the centre in plan, `rot` the direction the front faces
 * in quarter turns from +v (0 faces the view, 1 faces +u, 2 faces the back, 3 faces -u), `size` is
 * width (along its front), depth and height.
 */
export type ItemKind =
  | "heatpump" | "ventunit" | "battery" | "inverter" | "fusebox" | "manifold" | "washer" | "utilitysink" | "brine"
  | "shower" | "wc" | "vanity" | "mirror" | "towelrail" | "drain"
  | "kitchenBase" | "kitchenTall" | "island" | "stool" | "pendant" | "shelf"
  | "table" | "chair" | "sofa" | "armchair" | "coffeetable" | "rug" | "sideboard" | "bookcase" | "floorlamp" | "plant" | "art"
  | "bed" | "nightstand" | "wardrobe" | "desk" | "officechair" | "bench" | "hooks" | "coatcupboard"
  | "energyscreen" | "thermostat" | "smoke" | "extinguisher" | "downlight" | "skis" | "boxes" | "tv";

/** `z` is the height of the item's bottom above its floor; `ceil` hangs it from the ceiling above it. */
export type Item = { kind: ItemKind; level: Level; room: RoomId; at: [number, number]; rot: 0 | 1 | 2 | 3; size: [number, number, number]; z?: number; ceil?: boolean; variant?: number; lowerOnly?: boolean; oneLevelOnly?: boolean; id?: string };

const it = (kind: ItemKind, room: RoomId, at: [number, number], rot: Item["rot"], size: [number, number, number], extra: Partial<Item> = {}): Item => {
  const level = ROOMS.find((r) => r.id === room)?.level ?? "main";
  return { kind, level, room, at, rot, size, ...extra };
};

export const ITEMS: Item[] = [
  // ---- the plant room: everything that makes the house's energy, stores it and moves it
  it("heatpump", "tech", [-4.8, -3.58], 0, [0.6, 0.62, 1.8], { id: "heatpump" }),
  it("brine", "tech", [-4.8, -3.86], 0, [0.4, 0.06, 0.25]),
  it("washer", "tech", [-4.85, -2.85], 1, [0.6, 0.6, 1.7]),
  it("utilitysink", "tech", [-4.85, -2.05], 1, [0.8, 0.6, 0.9]),
  it("battery", "tech", [-3.2, -3.45], 3, [0.66, 0.24, 1.1], { id: "battery" }),
  it("inverter", "tech", [-3.18, -3.45], 3, [0.5, 0.2, 0.45], { z: 1.35, id: "inverter" }),
  it("ventunit", "tech", [-3.36, -2.6], 3, [0.75, 0.61, 0.73], { z: 1.6, id: "ventilation" }),
  it("manifold", "tech", [-3.11, -2.6], 3, [0.6, 0.11, 0.5], { z: 0.3 }),
  it("fusebox", "tech", [-3.11, -1.8], 3, [0.55, 0.13, 0.75], { z: 1.2, id: "meter" }),
  it("downlight", "tech", [-4.1, -2.5], 0, [0.1, 0.1, 0.02], { ceil: true }),
  // ---- the bathroom: walk-in shower with the heat exchanger in its drain, wall-hung WC, basin
  it("shower", "bath", [-2.38, -3.35], 0, [1.1, 1.1, 2.0], { id: "greywater" }),
  it("drain", "bath", [-2.38, -3.82], 0, [1.0, 0.1, 0.02]),
  it("wc", "bath", [-1.05, -3.6], 0, [0.4, 0.58, 0.42]),
  it("vanity", "bath", [-2.68, -1.95], 1, [0.8, 0.46, 0.85]),
  it("mirror", "bath", [-2.91, -1.95], 1, [0.8, 0.03, 0.9], { z: 1.1 }),
  it("towelrail", "bath", [-0.4, -1.75], 3, [0.5, 0.06, 0.9], { z: 0.6 }),
  it("downlight", "bath", [-1.65, -2.2], 0, [0.1, 0.1, 0.02], { ceil: true }),
  it("downlight", "bath", [-1.65, -3.3], 0, [0.1, 0.1, 0.02], { ceil: true }),
  // ---- the hall: bench, hooks and a mirror by the door
  it("bench", "hall", [-0.085, -3.3], 1, [0.9, 0.33, 0.45]),
  it("hooks", "hall", [-0.23, -3.3], 1, [0.9, 0.05, 0.2], { z: 1.7 }),
  it("mirror", "hall", [-0.235, -1.45], 1, [0.4, 0.03, 1.2], { z: 0.75 }),
  it("wardrobe", "hall", [1.85, -2.55], 3, [2.4, 0.6, 2.25], { oneLevelOnly: true }),
  it("smoke", "hall", [0.95, -2.0], 0, [0.11, 0.11, 0.04], { ceil: true }),
  it("extinguisher", "hall", [-0.17, -1.4], 1, [0.16, 0.16, 0.5], { z: 0.2 }),
  it("downlight", "hall", [0.45, -3.0], 0, [0.1, 0.1, 0.02], { ceil: true }),
  it("downlight", "hall", [0.45, -1.8], 0, [0.1, 0.1, 0.02], { ceil: true }),
  // ---- the bedroom on the entrance level
  it("bed", "bedroom", [4.15, -2.6], 3, [1.4, 2.0, 0.5], { variant: 1 }),
  it("nightstand", "bedroom", [4.92, -3.6], 3, [0.42, 0.4, 0.5]),
  it("nightstand", "bedroom", [4.92, -1.6], 3, [0.42, 0.4, 0.5]),
  it("wardrobe", "bedroom", [2.55, -2.9], 1, [1.6, 0.6, 2.2]),
  it("downlight", "bedroom", [3.7, -2.55], 0, [0.1, 0.1, 0.02], { ceil: true }),
  // ---- the kitchen: tall units by the plant room, worktop along the gable and under the view window, an island with the hob
  it("kitchenTall", "living", [-4.84, -0.8], 1, [0.6, 0.62, 2.2], { variant: 0 }),
  it("kitchenTall", "living", [-4.84, -0.2], 1, [0.6, 0.62, 2.2], { variant: 1 }),
  it("kitchenBase", "living", [-4.84, 2.0], 1, [3.8, 0.62, 0.9], { variant: 0 }),
  it("kitchenBase", "living", [-3.765, 3.59], 2, [1.53, 0.62, 0.9], { variant: 1 }),
  it("island", "living", [-2.85, 1.2], 1, [2.2, 1.0, 0.9], { id: "kitchen" }),
  it("stool", "living", [-2.15, 0.6], 3, [0.4, 0.4, 0.65]),
  it("stool", "living", [-2.15, 1.2], 3, [0.4, 0.4, 0.65]),
  it("stool", "living", [-2.15, 1.8], 3, [0.4, 0.4, 0.65]),
  it("pendant", "living", [-2.85, 0.75], 0, [0.32, 0.32, 0.3], { z: 2.15 }),
  it("pendant", "living", [-2.85, 1.65], 0, [0.32, 0.32, 0.3], { z: 2.15 }),
  it("shelf", "living", [-5.01, 2.7], 1, [1.4, 0.28, 0.04], { z: 1.55 }),
  it("energyscreen", "living", [-1.0, -1.08], 0, [0.26, 0.02, 0.17], { z: 1.4, id: "screen" }),
  it("thermostat", "living", [-1.45, -1.09], 0, [0.09, 0.02, 0.09], { z: 1.4 }),
  it("art", "living", [-2.4, -1.08], 0, [0.9, 0.03, 0.65], { z: 1.25 }),
  it("smoke", "living", [0.0, 0.6], 0, [0.11, 0.11, 0.04], { ceil: true }),
  // dining in front of the glass wall
  it("table", "living", [-0.9, 2.2], 0, [2.0, 0.9, 0.74]),
  it("chair", "living", [-1.4, 1.45], 0, [0.46, 0.5, 0.8]),
  it("chair", "living", [-0.4, 1.45], 0, [0.46, 0.5, 0.8]),
  it("chair", "living", [-1.4, 2.95], 2, [0.46, 0.5, 0.8]),
  it("chair", "living", [-0.4, 2.95], 2, [0.46, 0.5, 0.8]),
  it("pendant", "living", [-1.4, 2.2], 0, [0.42, 0.42, 0.25], { z: 2.0, variant: 1 }),
  it("pendant", "living", [-0.4, 2.2], 0, [0.42, 0.42, 0.25], { z: 2.0, variant: 1 }),
  // living: the sofa faces the view
  it("rug", "living", [2.9, 1.95], 0, [3.0, 2.3, 0.01]),
  it("sofa", "living", [2.85, 0.75], 0, [2.8, 0.95, 0.8], { id: "sofa" }),
  it("coffeetable", "living", [2.85, 2.0], 0, [1.2, 0.65, 0.38]),
  it("armchair", "living", [4.1, 3.05], 3, [0.8, 0.82, 0.78]),
  it("floorlamp", "living", [1.25, 0.55], 0, [0.35, 0.35, 1.6]),
  it("sideboard", "living", [4.93, 1.7], 3, [1.6, 0.42, 0.55]),
  it("bookcase", "living", [4.35, -0.92], 0, [1.5, 0.34, 2.0]),
  it("plant", "living", [4.85, 3.6], 0, [0.45, 0.45, 1.5], { variant: 0 }),
  it("plant", "living", [-2.15, 3.55], 0, [0.4, 0.4, 0.9], { variant: 1 }),
  // ---- the lower floor
  it("sofa", "family", [-0.2, 0.0], 0, [2.2, 0.9, 0.8], { lowerOnly: true, variant: 1 }),
  it("rug", "family", [0.1, 1.5], 0, [2.4, 1.8, 0.01], { lowerOnly: true, variant: 1 }),
  it("coffeetable", "family", [-0.2, 1.25], 0, [1.0, 0.6, 0.38], { lowerOnly: true }),
  it("tv", "family", [-1.37, 3.1], 1, [1.25, 0.06, 0.75], { z: 0.95, lowerOnly: true }),
  it("sideboard", "family", [-1.2, 3.1], 1, [1.6, 0.4, 0.45], { lowerOnly: true }),
  it("plant", "family", [2.25, 3.55], 0, [0.4, 0.4, 1.1], { lowerOnly: true, variant: 1 }),
  it("downlight", "family", [0.5, 1.0], 0, [0.1, 0.1, 0.02], { ceil: true, lowerOnly: true }),
  it("downlight", "family", [0.5, 2.9], 0, [0.1, 0.1, 0.02], { ceil: true, lowerOnly: true }),
  it("smoke", "family", [0.5, 2.0], 0, [0.11, 0.11, 0.04], { ceil: true, lowerOnly: true }),
  it("bed", "bed2", [-3.2, 2.15], 0, [1.4, 2.0, 0.5], { lowerOnly: true }),
  it("nightstand", "bed2", [-4.15, 1.35], 0, [0.42, 0.4, 0.5], { lowerOnly: true }),
  it("nightstand", "bed2", [-2.25, 1.35], 0, [0.42, 0.4, 0.5], { lowerOnly: true }),
  it("wardrobe", "bed2", [-4.85, 2.7], 1, [1.2, 0.6, 2.2], { lowerOnly: true }),
  it("downlight", "bed2", [-3.3, 2.5], 0, [0.1, 0.1, 0.02], { ceil: true, lowerOnly: true }),
  it("shower", "bath2", [-4.7, 0.24], 0, [0.9, 1.48, 2.0], { lowerOnly: true, variant: 1 }),
  it("vanity", "bath2", [-3.75, -0.27], 0, [0.8, 0.46, 0.85], { lowerOnly: true }),
  it("mirror", "bath2", [-3.75, -0.485], 0, [0.8, 0.03, 0.9], { z: 1.1, lowerOnly: true }),
  it("wc", "bath2", [-2.9, -0.21], 0, [0.4, 0.58, 0.42], { lowerOnly: true }),
  it("downlight", "bath2", [-3.3, 0.25], 0, [0.1, 0.1, 0.02], { ceil: true, lowerOnly: true }),
  it("bed", "bed3", [4.7, 2.8], 0, [0.9, 2.0, 0.5], { lowerOnly: true, variant: 2 }),
  it("wardrobe", "bed3", [4.2, 1.4], 0, [1.0, 0.6, 2.2], { lowerOnly: true }),
  it("desk", "bed3", [3.45, 3.55], 2, [1.2, 0.6, 0.74], { lowerOnly: true }),
  it("officechair", "bed3", [3.45, 3.0], 0, [0.55, 0.55, 0.9], { lowerOnly: true }),
  it("downlight", "bed3", [3.9, 2.5], 0, [0.1, 0.1, 0.02], { ceil: true, lowerOnly: true }),
  it("shelf", "store", [3.9, -0.32], 0, [2.4, 0.35, 1.9], { lowerOnly: true, variant: 1 }),
  it("skis", "store", [5.05, 0.5], 3, [0.6, 0.1, 1.85], { lowerOnly: true }),
  it("boxes", "store", [4.3, 0.55], 0, [1.0, 0.5, 0.6], { lowerOnly: true }),
  it("downlight", "store", [3.9, 0.25], 0, [0.1, 0.1, 0.02], { ceil: true, lowerOnly: true }),
];

/** What a plot's house has: the plain plan or the mirror image, and whether it has the lower floor. */
export type HouseFit = { id: string; mirror: boolean; lower: boolean; floor_z: number; lower_z: number | null; patio_z: number | null };

/** Keep what this house has (the lower floor, or the hall wardrobe of a house on one floor). */
export function keep<T extends { lowerOnly?: boolean; oneLevelOnly?: boolean }>(x: T, lower: boolean) {
  return lower ? !x.oneLevelOnly : !x.lowerOnly;
}

/** Floor area inside the outer walls (BRA) of the main floor and, with it, the lower floor. */
export function floorArea(lower: boolean) {
  const main = 2 * I * 2 * J;
  const low = 2 * I * (J - (HOUSE.lowerBack + HOUSE.wall)) + (STAIR.u1 - STAIR.u0) * (HOUSE.lowerBack + HOUSE.wall - STAIR.top);
  return { main, lower: lower ? low : 0, total: main + (lower ? low : 0) };
}

/** Area of a room's floor (m2); the open living space without the stair opening. */
export function roomArea(r: Room, lower: boolean) {
  const a = (r.rect.u1 - r.rect.u0) * (r.rect.v1 - r.rect.v0);
  if (r.id === "living" && lower) return a - (STAIR.u1 - STAIR.u0) * (STAIR.openTo - r.rect.v0);
  if (r.id === "hall" && lower) return a - (STAIR.u1 - STAIR.u0) * (r.rect.v1 - STAIR.top);
  return a;
}

/** Window and door area in the outer walls (for the envelope figures). */
export function glazedArea(lower: boolean) {
  return OPENINGS.filter((o) => keep(o, lower)).reduce((s, o) => s + o.w * (o.z1 - o.z0), 0);
}
