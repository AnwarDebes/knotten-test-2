"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Plot } from "@/lib/types";
import { twinUniforms } from "./materials";

/** Each house's walls and roof, by plot id, for picking and for the energy overlay. */
export type PlotMeshes = { walls?: THREE.Mesh; roof?: THREE.Mesh; pos: THREE.Vector3 };
export type PlotRegistry = Map<string, PlotMeshes>;

/**
 * The 30 proposed homes, built from plots.json: footprint, facing, floor, eaves, ridge and the
 * plinth that shows on the downhill side. A modern timber house of one and a half storeys: standing
 * cladding, large glass to the view, a terrace with a glass railing, and solar modules in rows on the
 * roof slope that faces the view (Sigve's direction: simple south roofs, kept free for panels).
 *
 * All houses share six meshes; every vertex knows its house (aHouse), so the energy layer can light
 * one house's panels and windows without a draw call per house.
 */
export const MAX_HOUSES = 48;
export const MODULE = { w: 1.134, h: 1.762, wp: 430 };   // a 430 Wp module, portrait

export const houseUniforms = {
  uPV: { value: new Float32Array(MAX_HOUSES) },     // 0..1 production, lights the panels
  uLoad: { value: new Float32Array(MAX_HOUSES) },   // 0..1 use, lights the windows at dusk
  uOff: { value: new Float32Array(MAX_HOUSES) },    // 1 when the house is dark (outage, empty battery)
  uEnergy: { value: 0 },                            // 1 in the living field (energy shown)
  uHide: { value: -1 },                             // house whose glass is hidden (standing inside it)
};

type Part = { pos: number[]; nrm: number[]; col: number[]; uv: number[]; house: number[]; idx: number[] };
const part = (): Part => ({ pos: [], nrm: [], col: [], uv: [], house: [], idx: [] });

// stained and painted standing cladding: charcoal, weathered grey, white, natural larch, dark green, light grey
const FACADES = ["#3a3f43", "#8d867b", "#e4e1da", "#9b7a55", "#3f4a40", "#c9c6bf"];
const lin = (hex: string) => new THREE.Color(hex);

/** Frame of one plot: u along the house's long side, v toward the view, z up (metres). */
function frame(p: Plot) {
  const f = (p.house.facing_deg * Math.PI) / 180;
  const ca = Math.cos(f), sa = Math.sin(f);
  const { x, y } = p.local;
  const P = (u: number, v: number, z: number) => new THREE.Vector3(x + u * ca + v * sa, z, -(y - u * sa + v * ca));
  const N = (u: number, v: number, z: number) => new THREE.Vector3(u * ca + v * sa, z, -(-u * sa + v * ca)).normalize();
  return { P, N };
}

function quad(t: Part, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3, col: THREE.Color, house: number, uv?: [number, number][]) {
  const base = t.pos.length / 3;
  const uvs = uv ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
  [a, b, c, d].forEach((p, k) => {
    t.pos.push(p.x, p.y, p.z); t.nrm.push(n.x, n.y, n.z); t.col.push(col.r, col.g, col.b);
    t.uv.push(uvs[k][0], uvs[k][1]); t.house.push(house);
  });
  // make the winding face along n
  const e1 = b.clone().sub(a), e2 = c.clone().sub(a);
  if (e1.cross(e2).dot(n) >= 0) t.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  else t.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
}

function tri(t: Part, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3, col: THREE.Color, house: number, uv: [number, number][]) {
  const base = t.pos.length / 3;
  [a, b, c].forEach((p, k) => {
    t.pos.push(p.x, p.y, p.z); t.nrm.push(n.x, n.y, n.z); t.col.push(col.r, col.g, col.b);
    t.uv.push(uv[k][0], uv[k][1]); t.house.push(house);
  });
  const e1 = b.clone().sub(a), e2 = c.clone().sub(a);
  if (e1.cross(e2).dot(n) >= 0) t.idx.push(base, base + 1, base + 2);
  else t.idx.push(base, base + 2, base + 1);
}

/** An axis-aligned box in the plot frame (all six faces). */
function box(t: Part, P: (u: number, v: number, z: number) => THREE.Vector3, N: (u: number, v: number, z: number) => THREE.Vector3, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, col: THREE.Color, house: number) {
  quad(t, P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1), N(0, 1, 0), col, house, [[u0, z0], [u1, z0], [u1, z1], [u0, z1]]);
  quad(t, P(u1, v0, z0), P(u0, v0, z0), P(u0, v0, z1), P(u1, v0, z1), N(0, -1, 0), col, house, [[u1, z0], [u0, z0], [u0, z1], [u1, z1]]);
  quad(t, P(u1, v1, z0), P(u1, v0, z0), P(u1, v0, z1), P(u1, v1, z1), N(1, 0, 0), col, house, [[v1, z0], [v0, z0], [v0, z1], [v1, z1]]);
  quad(t, P(u0, v0, z0), P(u0, v1, z0), P(u0, v1, z1), P(u0, v0, z1), N(-1, 0, 0), col, house, [[v0, z0], [v1, z0], [v1, z1], [v0, z1]]);
  quad(t, P(u0, v0, z1), P(u0, v1, z1), P(u1, v1, z1), P(u1, v0, z1), new THREE.Vector3(0, 1, 0), col, house);
  quad(t, P(u0, v1, z0), P(u0, v0, z0), P(u1, v0, z0), P(u1, v1, z0), new THREE.Vector3(0, -1, 0), col, house);
}

/** How many modules a house carries in a scenario: from kWp, laid in rows from the eaves up. */
export function modulesFor(kwp: number) {
  return Math.max(0, Math.round((kwp * 1000) / MODULE.wp));
}

export function buildHouses(plots: Plot[], modulesPerHouse: number) {
  const body = part(), glass = part(), roof = part(), pv = part(), deck = part(), plinth = part();
  plots.forEach((p, i) => {
    const { P, N } = frame(p);
    const W = p.house.width_m, D = p.house.depth_m;
    const hw = W / 2, hd = D / 2;
    const z0 = p.local.z_floor;
    const eave = z0 + p.house.eaves_m, ridge = z0 + p.house.ridge_m;
    const plinthZ = z0 - Math.max(0.6, p.house.plinth_m ?? 0.6);
    const facade = lin(FACADES[i % FACADES.length]);
    const concrete = lin("#9a9893");

    // plinth / foundation down to the ground on the downhill side
    box(plinth, P, N, -hw + 0.1, hw - 0.1, -hd + 0.1, hd - 0.1, plinthZ, z0, concrete, i);

    // walls: two long sides and two gable ends up to the ridge
    quad(body, P(-hw, hd, z0), P(hw, hd, z0), P(hw, hd, eave), P(-hw, hd, eave), N(0, 1, 0), facade, i, [[-hw, 0], [hw, 0], [hw, eave - z0], [-hw, eave - z0]]);
    quad(body, P(hw, -hd, z0), P(-hw, -hd, z0), P(-hw, -hd, eave), P(hw, -hd, eave), N(0, -1, 0), facade, i, [[hw, 0], [-hw, 0], [-hw, eave - z0], [hw, eave - z0]]);
    for (const s of [-1, 1]) {
      const n = N(s, 0, 0);
      quad(body, P(s * hw, -s * hd, z0), P(s * hw, s * hd, z0), P(s * hw, s * hd, eave), P(s * hw, -s * hd, eave), n, facade, i, [[-s * hd, 0], [s * hd, 0], [s * hd, eave - z0], [-s * hd, eave - z0]]);
      tri(body, P(s * hw, -hd, eave), P(s * hw, hd, eave), P(s * hw, 0, ridge), n, facade, i, [[-hd, eave - z0], [hd, eave - z0], [0, ridge - z0]]);
    }

    // windows: the view side is mostly glass on the ground floor; small windows elsewhere
    const g = (u0: number, u1: number, zA: number, zB: number, side: "front" | "back" | "east" | "west") => {
      const o = 0.04;
      if (side === "front") quad(glass, P(u0, hd + o, z0 + zA), P(u1, hd + o, z0 + zA), P(u1, hd + o, z0 + zB), P(u0, hd + o, z0 + zB), N(0, 1, 0), facade, i);
      if (side === "back") quad(glass, P(u1, -hd - o, z0 + zA), P(u0, -hd - o, z0 + zA), P(u0, -hd - o, z0 + zB), P(u1, -hd - o, z0 + zB), N(0, -1, 0), facade, i);
      if (side === "east") quad(glass, P(hw + o, -u0, z0 + zA), P(hw + o, -u1, z0 + zA), P(hw + o, -u1, z0 + zB), P(hw + o, -u0, z0 + zB), N(1, 0, 0), facade, i);
      if (side === "west") quad(glass, P(-hw - o, u0, z0 + zA), P(-hw - o, u1, z0 + zA), P(-hw - o, u1, z0 + zB), P(-hw - o, u0, z0 + zB), N(-1, 0, 0), facade, i);
    };
    g(-hw + 0.7, -0.5, 0.15, 2.55, "front");
    g(0.1, hw - 0.7, 0.15, 2.55, "front");
    g(-hw + 1.2, -hw + 2.2, 1.0, 2.2, "back");
    g(-1.0, 0.6, 1.0, 2.2, "back");
    g(hw - 2.6, hw - 1.4, 1.0, 2.2, "back");
    for (const side of ["east", "west"] as const) {
      g(-1.6, -0.4, 1.0, 2.2, side);
      g(-0.55, 0.55, 3.35, Math.min(4.4, p.house.ridge_m - 0.9), side);
    }

    // roof: two slopes with a 0.5 m overhang and a fascia
    const ov = 0.5;
    const slope = (ridge - eave) / hd;
    const zEdge = eave - slope * ov;
    const roofCol = lin("#2a2e33");
    for (const s of [-1, 1]) {
      const a = P(-hw - ov, s * (hd + ov), zEdge), b = P(hw + ov, s * (hd + ov), zEdge), c = P(hw + ov, 0, ridge + 0.12), d = P(-hw - ov, 0, ridge + 0.12);
      const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize();
      if (n.y < 0) n.negate();
      quad(roof, a, b, c, d, n, roofCol, i);
      // the fascia board under the eaves
      quad(roof, P(-hw - ov, s * (hd + ov), zEdge - 0.22), P(hw + ov, s * (hd + ov), zEdge - 0.22), P(hw + ov, s * (hd + ov), zEdge), P(-hw - ov, s * (hd + ov), zEdge), N(0, s, 0), roofCol, i);
      // the underside of the overhang
      quad(roof, P(-hw - ov, s * hd, eave - 0.02), P(hw + ov, s * hd, eave - 0.02), P(hw + ov, s * (hd + ov), zEdge - 0.02), P(-hw - ov, s * (hd + ov), zEdge - 0.02), new THREE.Vector3(0, -1, 0), roofCol, i);
    }
    for (const s of [-1, 1]) {   // gable overhang edges (verge boards)
      quad(roof, P(s * (hw + ov), -(hd + ov), zEdge - 0.22), P(s * (hw + ov), 0, ridge - 0.1), P(s * (hw + ov), 0, ridge + 0.12), P(s * (hw + ov), -(hd + ov), zEdge), N(s, 0, 0), roofCol, i);
      quad(roof, P(s * (hw + ov), 0, ridge - 0.1), P(s * (hw + ov), hd + ov, zEdge - 0.22), P(s * (hw + ov), hd + ov, zEdge), P(s * (hw + ov), 0, ridge + 0.12), N(s, 0, 0), roofCol, i);
    }

    // solar modules on the view-side slope, in rows from the eaves up, centred along the ridge
    if (modulesPerHouse > 0) {
      const lenSlope = Math.hypot(hd + ov, ridge + 0.12 - zEdge);
      const rows = Math.max(1, Math.floor((lenSlope - 0.45) / (MODULE.h + 0.02)));
      const perRow = Math.max(1, Math.floor((W + 2 * ov - 0.6) / (MODULE.w + 0.02)));
      let left = Math.min(modulesPerHouse, rows * perRow);
      const cosA = (hd + ov) / lenSlope, sinA = (ridge + 0.12 - zEdge) / lenSlope;
      const nrm = (() => { const a = P(0, hd + ov, zEdge), b = P(1, hd + ov, zEdge), c = P(0, 0, ridge + 0.12); const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize(); return n.y < 0 ? n.negate() : n; })();
      for (let r = 0; r < rows && left > 0; r++) {
        const inRow = Math.min(perRow, left);
        left -= inRow;
        const width = inRow * (MODULE.w + 0.02);
        const s0 = 0.25 + r * (MODULE.h + 0.02), s1 = s0 + MODULE.h;
        for (let k = 0; k < inRow; k++) {
          const u0 = -width / 2 + k * (MODULE.w + 0.02), u1 = u0 + MODULE.w;
          const at = (u: number, s: number) => {
            const v = hd + ov - s * cosA, z = zEdge + s * sinA + 0.07;
            return P(u, v, z);
          };
          quad(pv, at(u0, s0), at(u1, s0), at(u1, s1), at(u0, s1), nrm, roofCol, i);
        }
      }
    }

    // the terrace on the view side, with a glass railing
    const deckCol = lin("#7b6046");
    box(deck, P, N, -hw + 0.4, hw - 0.4, hd, hd + 3.0, z0 - 0.16, z0 - 0.02, deckCol, i);
    const rail = (u0: number, v0: number, u1: number, v1: number, n: THREE.Vector3) =>
      quad(glass, P(u0, v0, z0), P(u1, v1, z0), P(u1, v1, z0 + 1.0), P(u0, v0, z0 + 1.0), n, deckCol, i);
    rail(-hw + 0.4, hd + 3.0, hw - 0.4, hd + 3.0, N(0, 1, 0));
    rail(hw - 0.4, hd + 3.0, hw - 0.4, hd + 0.05, N(1, 0, 0));
    rail(-hw + 0.4, hd + 0.05, -hw + 0.4, hd + 3.0, N(-1, 0, 0));
  });

  const geo = (t: Part) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(t.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(t.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(t.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(t.uv, 2));
    g.setAttribute("aHouse", new THREE.Float32BufferAttribute(t.house, 1));
    g.setIndex(t.idx);
    g.computeBoundingSphere();
    return g;
  };
  return { body: geo(body), glass: geo(glass), roof: geo(roof), pv: geo(pv), deck: geo(deck), plinth: geo(plinth) };
}

/** Standing timber cladding in the shader, from metre coordinates along the wall. */
function claddingMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, envMapIntensity: 0.6 });
  m.defines = { USE_UV: "" };
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
#ifdef USE_UV
float board = abs(fract(vUv.x / 0.19) - 0.5);
diffuseColor.rgb *= 1.0 - 0.16 * smoothstep(0.42, 0.49, board);
#endif`);
  };
  m.customProgramCacheKey = () => "twin-cladding-v1";
  return m;
}

/** House-indexed glow: panels light with production, windows with use (and go dark in an outage). */
function energyAware(m: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial, kind: "pv" | "glass", key: string) {
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, houseUniforms, { uNight: twinUniforms.uNight });
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aHouse;\nvarying float vHouse;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHouse = aHouse;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
#define MAX_HOUSES ${MAX_HOUSES}
uniform float uPV[MAX_HOUSES];
uniform float uLoad[MAX_HOUSES];
uniform float uOff[MAX_HOUSES];
uniform float uEnergy;
uniform float uHide;
uniform float uNight;
varying float vHouse;`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
int hIndex = int(vHouse + 0.5);
${kind === "glass" ? "if (abs(vHouse - uHide) < 0.5) discard;" : ""}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
${kind === "pv"
  ? "float shine = uEnergy * uPV[hIndex];\ntotalEmissiveRadiance += vec3(1.0, 0.62, 0.18) * shine * 0.9;"
  : "float lit = (1.0 - uOff[hIndex]) * max(uNight * (0.35 + 0.65 * step(0.5, fract(vHouse * 0.618 + 0.3))), uEnergy * uLoad[hIndex] * uNight);\ntotalEmissiveRadiance += vec3(1.0, 0.74, 0.46) * lit * 1.6;"}`);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

/** The solar module texture: dark cells with thin silver lines, painted once in the browser. */
function moduleTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0d1420"; g.fillRect(0, 0, 64, 128);
  g.strokeStyle = "#3a4656"; g.lineWidth = 1;
  for (let x = 0; x <= 64; x += 10.6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 0; y <= 128; y += 10.6) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  g.strokeStyle = "#9aa3ad"; g.lineWidth = 2; g.strokeRect(1, 1, 62, 126);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function TwinHouses({ plots, shadows, modules, registry, hideGlassFor }: { plots: Plot[]; shadows: boolean; modules: number; registry?: React.RefObject<PlotRegistry>; hideGlassFor?: string | null }) {
  const geo = useMemo(() => buildHouses(plots, modules), [plots, modules]);
  const mats = useMemo(() => ({
    body: claddingMaterial(),
    glass: energyAware(new THREE.MeshPhysicalMaterial({ color: "#1d2a33", roughness: 0.06, metalness: 0.0, envMapIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), "glass", "twin-glass-v1"),
    roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35, envMapIntensity: 0.8 }),
    pv: energyAware(new THREE.MeshPhysicalMaterial({ map: moduleTexture(), roughness: 0.18, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 1.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), "pv", "twin-pv-v1"),
    deck: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    plinth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
  }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  // which house you stand in (its glass is hidden so the room looks out)
  useEffect(() => {
    houseUniforms.uHide.value = hideGlassFor ? plots.findIndex((p) => p.id === hideGlassFor) : -1;
  }, [hideGlassFor, plots]);

  // keep the old registry shape for the camera and labels: one position per plot
  useEffect(() => {
    const r = registry?.current;
    if (!r) return;
    plots.forEach((p) => r.set(p.id, { pos: new THREE.Vector3(p.local.x, p.local.z_floor + p.house.eaves_m, -p.local.y) }));
    return () => { plots.forEach((p) => r.delete(p.id)); };
  }, [plots, registry]);

  return (
    <group>
      <mesh geometry={geo.plinth} material={mats.plinth} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={geo.body} material={mats.body} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={geo.glass} material={mats.glass} />
      <mesh geometry={geo.roof} material={mats.roof} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={geo.pv} material={mats.pv} receiveShadow={shadows} />
      <mesh geometry={geo.deck} material={mats.deck} castShadow={shadows} receiveShadow={shadows} />
    </group>
  );
}
