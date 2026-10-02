/**
 * What the walk shares between the 3D scene (WalkRig, HouseInterior) and the page around it (the
 * controls, the plan of the house, the hotspots). A plain object, read and written every frame by
 * the scene; the page re-renders only when `notifyWalk()` says something it shows has changed.
 */
import * as THREE from "three";
import type { RoomId } from "@/lib/house/plan";
import type { Nav, WalkWorld } from "./walk";

export type WalkStart = "door" | "terrace" | "living" | "here";
export type WalkPlace = { level: "outside" | "main" | "lower"; room: RoomId | null };

export const walkState = {
  /** the house whose inside is built and walked through (index into the plots) */
  visit: -1,
  world: null as WalkWorld | null,
  nav: null as Nav | null,
  /** the visitor: feet in the visited house's frame (u, v, z), and where they look */
  u: 0, v: 0, z: 0,
  yaw: 0, pitch: -0.05,
  place: { level: "outside", room: null } as WalkPlace,
  flying: false,
  // ---- input from the page
  keys: new Set<string>(),
  stick: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  run: false,
  /** a click on the scene to walk to (CSS pixels in the canvas) */
  click: null as null | { x: number; y: number },
  /** go to a named spot of the house (a room, a hotspot, a door) */
  goto: null as null | { u: number; v: number; z: number; face?: number },
  path: [] as [number, number, number][],
  // ---- doors: target and current opening, 0 shut .. 1 open
  doorOpen: new Map<string, number>(),
  // ---- hotspots: DOM elements the scene moves every frame
  hotEls: new Map<string, HTMLElement>(),
  hotPos: new Map<string, THREE.Vector3>(),
  hotLevel: new Map<string, string>(),
  /** the house's live figures for the screens and the page */
  live: null as null | LiveFigures,
  version: 0,
};

/** The visited house at the simulation's hour. */
export type LiveFigures = {
  pv: number; use: number; hp: number; soc: number; grid: number; share: number;
  temp: number; price: number; cop: number; hour: number; day: number; month: number;
  yearPv: number; yearUse: number; selfUse: number; batteryKwh: number; kwp: number; offline: boolean;
};

/** Walk to a spot of the visited house (its frame: u, v, z above the main floor). */
export function requestGoto(u: number, v: number, z: number) {
  walkState.goto = { u, v, z };
  notifyWalk();
}
/** A click or tap on the scene, in CSS pixels from the canvas's corner. */
export function requestClick(x: number, y: number) {
  walkState.click = { x, y };
}
/** Turn the view by a drag of this many pixels. */
export function addLook(dx: number, dy: number) {
  walkState.look.x += dx;
  walkState.look.y += dy;
}
/** The touch stick: -1..1 across and forward. */
export function setStick(x: number, y: number) {
  walkState.stick.x = x;
  walkState.stick.y = y;
  if (x || y) walkState.path = [];
}
/** A hotspot's element on the page, which the scene moves every frame. */
export function registerHot(id: string, el: HTMLElement | null) {
  if (el) walkState.hotEls.set(id, el); else walkState.hotEls.delete(id);
}
/** The visited house's figures, for its screens. */
export function setLive(f: LiveFigures | null) {
  walkState.live = f;
}

const listeners = new Set<() => void>();
export function notifyWalk() {
  walkState.version++;
  listeners.forEach((l) => l());
}
export function subscribeWalk(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export const walkVersion = () => walkState.version;
