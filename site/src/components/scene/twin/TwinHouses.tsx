"use client";
import { use, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Plot } from "@/lib/types";
import { buildExteriors, MODULE } from "../house/exterior";
import { fitFor, loadHouses } from "../house/frame";
import { houseUniforms, MAX_HOUSES, sharedHouseMaterials } from "../house/materials";
import { builtGroundHeight, loadTwin } from "./twinData";

export { MODULE, houseUniforms, MAX_HOUSES };

/** Each house's position by plot id, for the camera, the labels and the energy overlay. */
export type PlotMeshes = { walls?: THREE.Mesh; roof?: THREE.Mesh; pos: THREE.Vector3 };
export type PlotRegistry = Map<string, PlotMeshes>;

/** How many modules a house carries in a scenario: from kWp, laid in rows from the eaves up. */
export function modulesFor(kwp: number) {
  return Math.max(0, Math.round((kwp * 1000) / MODULE.wp));
}

const meshRaycast = THREE.Mesh.prototype.raycast;
const _inv = new THREE.Matrix4();
const _ray = new THREE.Ray();
const _v = new THREE.Vector3();

/**
 * Picking a house by its own triangles, but only the triangles of houses the ray can reach. Every house is
 * one run of the merged index (they are built one after another), so a test against each house's box decides
 * which runs are tested at all. The hits are exactly those of testing every triangle: a triangle can only be
 * hit where its house's box is. (Testing all 335 000 triangles took about 16 ms on a laptop for each press,
 * release and click.) The runs and boxes are found on the first pick.
 */
function housePicker(g: THREE.BufferGeometry): THREE.Mesh["raycast"] {
  let runs: { start: number; count: number; box: THREE.Box3 }[] | null = null;
  const findRuns = () => {
    const out: { start: number; count: number; box: THREE.Box3 }[] = [];
    const index = g.index, house = g.getAttribute("aHouse"), pos = g.getAttribute("position");
    if (!index || !house) return out;
    let cur = -1, start = 0, box: THREE.Box3 | null = null;
    for (let i = 0; i + 2 < index.count; i += 3) {
      const h = Math.round(house.getX(index.getX(i)));
      if (h !== cur) {
        if (box) out.push({ start, count: i - start, box });
        cur = h; start = i; box = new THREE.Box3();
      }
      for (let k = 0; k < 3; k++) box!.expandByPoint(_v.fromBufferAttribute(pos, index.getX(i + k)));
    }
    if (box) out.push({ start, count: index.count - start, box });
    return out;
  };
  return function (this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    if (!g.index) { meshRaycast.call(this, raycaster, intersects); return; }
    runs ??= findRuns();
    _inv.copy(this.matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inv);
    const { start, count } = g.drawRange;
    try {
      for (const r of runs) {
        if (!_ray.intersectsBox(r.box)) continue;
        g.setDrawRange(r.start, r.count);
        meshRaycast.call(this, raycaster, intersects);
      }
    } finally {
      g.setDrawRange(start, count);
    }
  };
}

// which materials throw shadows (glass, lamps and the thin modules only take them)
const CASTS = new Set(["clad", "paint", "frame", "metal", "roof", "deck", "concrete", "paving", "stone"]);

/**
 * The 30 houses of the model, outside: the example house (src/lib/house/plan.ts) on every plot,
 * fitted to the graded ground, with or without its lower floor (houses.json). Every material is one
 * mesh for all houses. `visit` is the house being walked through: its glass turns clear and its
 * doors are drawn apart, so they can open.
 */
export function TwinHouses({ plots, shadows, modules, registry, visit }: { plots: Plot[]; shadows: boolean; modules: number; registry?: React.RefObject<PlotRegistry>; visit?: string | null }) {
  const twin = use(loadTwin());
  const file = use(loadHouses());
  const fits = useMemo(() => plots.map((p) => fitFor(file, p)), [file, plots]);
  // the ground is read from the graded terrain, which is in once loadTwin has resolved
  const geos = useMemo(() => { void twin; return buildExteriors(plots, fits, modules, builtGroundHeight); }, [plots, fits, modules, twin]);
  const mats = sharedHouseMaterials();
  const pickers = useMemo(() => Object.fromEntries(Object.entries(geos).map(([k, g]) => [k, housePicker(g)])), [geos]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  useEffect(() => {
    houseUniforms.uVisit.value = visit ? plots.findIndex((p) => p.id === visit) : -1;
  }, [visit, plots]);

  // one position per plot for the camera and labels
  useEffect(() => {
    const r = registry?.current;
    if (!r) return;
    plots.forEach((p) => r.set(p.id, { pos: new THREE.Vector3(p.local.x, p.local.z_floor + p.house.eaves_m, -p.local.y) }));
    return () => { plots.forEach((p) => r.delete(p.id)); };
  }, [plots, registry]);

  return (
    <group>
      {Object.entries(geos).map(([k, g]) => {
        const m = (mats as Record<string, THREE.Material>)[k];
        if (!m) return null;
        return <mesh key={k} name={`houses-${k}`} geometry={g} material={m} raycast={pickers[k]} castShadow={shadows && CASTS.has(k)} receiveShadow={shadows && k !== "glass" && k !== "railglass"} renderOrder={k === "railglass" ? 2 : 0} />;
      })}
    </group>
  );
}
