"use client";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { Plot } from "@/lib/types";

/**
 * The proposed houses and roads, built in the browser from the same plots.json and road.json the
 * passports read. Each house faces its plot's `facing_deg`, which the pipeline set toward the
 * water: the glazed front, the terrace and the PV pitch all sit on that side.
 *
 * local metres (x east, y north, z up) -> three.js (x, y up, z south)
 */
export type PlotMeshes = { walls?: THREE.Mesh; roof?: THREE.Mesh; pos: THREE.Vector3 };
export type PlotRegistry = Map<string, PlotMeshes>;

type RoadSeg = { from: [number, number, number]; to: [number, number, number] };
type RoadFile = { segments: RoadSeg[] };

const T = (x: number, y: number, z: number): [number, number, number] => [x, z, -y];

function box(P: (u: number, v: number, z: number) => [number, number, number], u0: number, u1: number, v0: number, v1: number, z0: number, z1: number) {
  const p = [P(u0, v0, z0), P(u1, v0, z0), P(u1, v1, z0), P(u0, v1, z0), P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)];
  const f = [[0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7], [4, 5, 6], [4, 6, 7]];
  return { p, f };
}

function houseGeometry(p: Plot) {
  const { x, y, z_floor } = p.local;
  const ground = z_floor - 1.0;
  const eaves = z_floor + p.house.eaves_m;
  const ridge = z_floor + p.house.ridge_m;
  const f = (p.house.facing_deg * Math.PI) / 180;
  const ca = Math.cos(f), sa = Math.sin(f);
  // u runs along the contour (the long side); v points where the house faces (down the slope, to the water)
  const P = (u: number, v: number, z: number) => T(x + u * ca + v * sa, y - u * sa + v * ca, z);
  const hw = p.house.width_m / 2, hd = p.house.depth_m / 2;

  // walls: the body, plus a terrace slab in front
  const body = box(P, -hw, hw, -hd, hd, ground, eaves);
  const terrace = box(P, -hw + 0.6, hw - 0.6, hd, hd + 3.2, z_floor - 0.35, z_floor);
  const wallPts = [...body.p, ...terrace.p];
  const wallIdx = [...body.f.flat(), ...terrace.f.flat().map((i) => i + 8)];
  const walls = new THREE.BufferGeometry();
  walls.setAttribute("position", new THREE.Float32BufferAttribute(wallPts.flat(), 3));
  walls.setIndex(wallIdx);
  walls.computeVertexNormals();

  // the glazed front: a dark band across the water side, slightly proud of the wall
  const g = box(P, -hw + 0.7, hw - 0.7, hd, hd + 0.08, z_floor + 0.4, eaves - 0.5);
  const glass = new THREE.BufferGeometry();
  glass.setAttribute("position", new THREE.Float32BufferAttribute(g.p.flat(), 3));
  glass.setIndex(g.f.flat());
  glass.computeVertexNormals();

  // roof: two pitches with an overhang; the front pitch (v > 0) carries the PV
  const ov = 0.55;
  const rp = [P(-hw - ov, -hd - ov, eaves), P(hw + ov, -hd - ov, eaves), P(hw + ov, hd + ov, eaves), P(-hw - ov, hd + ov, eaves), P(-hw - ov, 0, ridge), P(hw + ov, 0, ridge)];
  const rf = [[2, 3, 4], [2, 4, 5], [0, 1, 5], [0, 5, 4], [0, 4, 3], [1, 2, 5]];
  const roof = new THREE.BufferGeometry();
  roof.setAttribute("position", new THREE.Float32BufferAttribute(rp.flat(), 3));
  roof.setIndex(rf.flat());
  roof.computeVertexNormals();

  return { walls, glass, roof, pos: new THREE.Vector3(...T(x, y, eaves)) };
}

function roadRuns(segments: RoadSeg[]) {
  const runs: [number, number, number][][] = [];
  let cur: [number, number, number][] = [];
  const same = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
  for (const s of segments) {
    if (cur.length === 0) { cur = [s.from, s.to]; continue; }
    if (same(cur[cur.length - 1], s.from)) cur.push(s.to);
    else { if (cur.length > 1) runs.push(cur); cur = [s.from, s.to]; }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

function roadGeometry(segments: RoadSeg[], width = 5) {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const run of roadRuns(segments)) {
    const base = pos.length / 3;
    run.forEach((pt, k) => {
      const a = run[Math.max(k - 1, 0)], b = run[Math.min(k + 1, run.length - 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * (width / 2), oy = (dx / len) * (width / 2);
      pos.push(...T(pt[0] + ox, pt[1] + oy, pt[2] + 0.2));
      pos.push(...T(pt[0] - ox, pt[1] - oy, pt[2] + 0.2));
    });
    for (let k = 0; k < run.length - 1; k++) {
      const a = base + k * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const WALL = ["#e6e1d6", "#4a413a", "#cfc6b6"]; // limewashed, tarred timber, pale ochre; rotating along a row
const ROOF = "#2e353b";

export function Proposal({ plots, shadows, registry, onPick, hideGlassFor = null }: { plots: Plot[]; shadows: boolean; registry: React.RefObject<PlotRegistry>; onPick?: (id: string) => void; hideGlassFor?: string | null }) {
  const [road, setRoad] = useState<RoadFile | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/data/road.json").then((r) => r.json()).then((j: RoadFile) => { if (alive) setRoad(j); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const houses = useMemo(() => plots.map((p, i) => ({ plot: p, i, ...houseGeometry(p) })), [plots]);
  const roadGeo = useMemo(() => (road ? roadGeometry(road.segments) : null), [road]);
  const mats = useMemo(() => houses.map(({ i }) => ({
    wall: new THREE.MeshStandardMaterial({ color: new THREE.Color(WALL[i % 3]), roughness: 0.8 }),
    roof: new THREE.MeshStandardMaterial({ color: new THREE.Color(ROOF), roughness: 0.45, metalness: 0.15 }),
  })), [houses]);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color("#1c2a33"), roughness: 0.15, metalness: 0.6 }), []);
  const roadMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color("#3a3b3d"), roughness: 0.95 }), []);

  useEffect(() => () => {
    houses.forEach((h) => { h.walls.dispose(); h.roof.dispose(); h.glass.dispose(); });
    mats.forEach((m) => { m.wall.dispose(); m.roof.dispose(); });
    roadGeo?.dispose();
  }, [houses, mats, roadGeo]);

  const reg = (id: string, pos: THREE.Vector3, key: "walls" | "roof") => (m: THREE.Mesh | null) => {
    const r = registry.current;
    if (!r) return;
    if (!m) { r.delete(id); return; }
    const e = r.get(id) ?? { pos };
    e[key] = m;
    e.pos = pos;
    r.set(id, e);
  };

  return (
    <group>
      {houses.map((h) => (
        <group key={h.plot.id} onClick={(e) => { e.stopPropagation(); onPick?.(h.plot.id); }}>
          <mesh geometry={h.walls} material={mats[h.i].wall} castShadow={shadows} receiveShadow ref={reg(h.plot.id, h.pos, "walls")} />
          {hideGlassFor !== h.plot.id && <mesh geometry={h.glass} material={glassMat} />}
          <mesh geometry={h.roof} material={mats[h.i].roof} castShadow={shadows} receiveShadow ref={reg(h.plot.id, h.pos, "roof")} />
        </group>
      ))}
      {roadGeo && <mesh geometry={roadGeo} material={roadMat} receiveShadow />}
    </group>
  );
}
