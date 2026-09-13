"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Plot } from "@/lib/types";

/**
 * The inside of one house on its plot: a living room the size of the real footprint, with the
 * glazed wall on the side that faces the water. Everything is built in the plot's own frame
 * (u along the contour, v toward the view), so the room looks out at exactly what the passport
 * measured. Deliberately calm: oak floor, limewashed walls, a sofa, a table, a kitchen wall.
 */
const T = (x: number, y: number, z: number): [number, number, number] => [x, z, -y];

function boxAt(P: (u: number, v: number, z: number) => [number, number, number], u0: number, u1: number, v0: number, v1: number, z0: number, z1: number) {
  const p = [P(u0, v0, z0), P(u1, v0, z0), P(u1, v1, z0), P(u0, v1, z0), P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)];
  const f = [[0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7], [4, 5, 6], [4, 6, 7], [3, 2, 1], [3, 1, 0]];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p.flat(), 3));
  g.setIndex(f.flat());
  g.computeVertexNormals();
  return g;
}

export function Interior({ plot }: { plot: Plot }) {
  const parts = useMemo(() => {
    const { x, y, z_floor } = plot.local;
    const f = (plot.house.facing_deg * Math.PI) / 180;
    const ca = Math.cos(f), sa = Math.sin(f);
    const P = (u: number, v: number, z: number) => T(x + u * ca + v * sa, y - u * sa + v * ca, z);
    const hw = plot.house.width_m / 2, hd = plot.house.depth_m / 2;
    const floor = z_floor + 0.02, ceil = z_floor + 2.75, wall = 0.18;
    const mk = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number) => boxAt(P, u0, u1, v0, v1, z0, z1);
    return {
      floor: mk(-hw + 0.1, hw - 0.1, -hd + 0.1, hd - 0.1, z_floor - 0.1, floor),
      ceiling: mk(-hw + 0.1, hw - 0.1, -hd + 0.1, hd - 0.1, ceil, ceil + 0.2),
      back: mk(-hw + 0.1, hw - 0.1, -hd + 0.1, -hd + 0.1 + wall, floor, ceil),
      left: mk(-hw + 0.1, -hw + 0.1 + wall, -hd + 0.1, hd - 0.1, floor, ceil),
      right: mk(hw - 0.1 - wall, hw - 0.1, -hd + 0.1, hd - 0.1, floor, ceil),
      // the glazed front: sill, head, three slim mullions and the glass itself
      sill: mk(-hw + 0.1, hw - 0.1, hd - 0.1 - wall, hd - 0.1, floor, floor + 0.45),
      head: mk(-hw + 0.1, hw - 0.1, hd - 0.1 - wall, hd - 0.1, ceil - 0.25, ceil),
      mullions: [-hw / 2, 0, hw / 2].map((u) => mk(u - 0.04, u + 0.04, hd - 0.1 - wall, hd - 0.1, floor + 0.45, ceil - 0.25)),
      glass: mk(-hw + 0.1, hw - 0.1, hd - 0.1 - 0.02, hd - 0.1, floor + 0.45, ceil - 0.25),
      // furniture
      rug: mk(-2.2, 2.2, -0.4, 2.6, floor, floor + 0.02),
      sofaSeat: mk(-1.6, 1.6, -0.2, 0.75, floor, floor + 0.42),
      sofaBack: mk(-1.6, 1.6, -0.35, -0.2, floor, floor + 0.82),
      table: mk(-0.55, 0.55, 1.3, 1.9, floor + 0.36, floor + 0.4),
      tableLeg: mk(-0.08, 0.08, 1.52, 1.68, floor, floor + 0.36),
      kitchen: mk(-hw + 0.3, -hw + 0.3 + 3.6, -hd + 0.3, -hd + 0.95, floor, floor + 0.9),
      kitchenTall: mk(-hw + 0.3, -hw + 0.3 + 0.6, -hd + 0.3, -hd + 0.95, floor, ceil - 0.05),
      shelf: mk(hw - 0.3 - 2.4, hw - 0.3, -hd + 0.3, -hd + 0.65, floor, floor + 1.1),
      lampPos: new THREE.Vector3(...P(0, 1.6, floor + 1.4)),
      pendantPos: new THREE.Vector3(...P(-hw + 2.1, -hd + 0.6, ceil - 0.9)),
    };
  }, [plot]);

  const m = useMemo(() => ({
    floor: new THREE.MeshStandardMaterial({ color: "#c9a97a", roughness: 0.62, emissive: "#c9a97a", emissiveIntensity: 0.12 }),
    wall: new THREE.MeshStandardMaterial({ color: "#efe9df", roughness: 0.95, emissive: "#efe9df", emissiveIntensity: 0.22 }),
    ceiling: new THREE.MeshStandardMaterial({ color: "#f4f0e8", roughness: 1, emissive: "#f4f0e8", emissiveIntensity: 0.38 }),
    frame: new THREE.MeshStandardMaterial({ color: "#2a2f33", roughness: 0.5, metalness: 0.2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#dfe9ee", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, transmission: 0, side: THREE.DoubleSide }),
    rug: new THREE.MeshStandardMaterial({ color: "#a9a397", roughness: 1 }),
    sofa: new THREE.MeshStandardMaterial({ color: "#5b6b6a", roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: "#7a5a3a", roughness: 0.6 }),
    kitchen: new THREE.MeshStandardMaterial({ color: "#3a3f43", roughness: 0.45 }),
    lamp: new THREE.MeshStandardMaterial({ color: "#f6e7c8", emissive: "#f0c86a", emissiveIntensity: 1.4 }),
  }), []);

  useEffect(() => () => {
    Object.values(parts).forEach((g) => { if (g instanceof THREE.BufferGeometry) g.dispose(); if (Array.isArray(g)) g.forEach((x) => x.dispose()); });
    Object.values(m).forEach((x) => x.dispose());
  }, [parts, m]);

  return (
    <group>
      <mesh geometry={parts.floor} material={m.floor} receiveShadow />
      <mesh geometry={parts.ceiling} material={m.ceiling} />
      <mesh geometry={parts.back} material={m.wall} />
      <mesh geometry={parts.left} material={m.wall} />
      <mesh geometry={parts.right} material={m.wall} />
      <mesh geometry={parts.sill} material={m.wall} />
      <mesh geometry={parts.head} material={m.frame} />
      {parts.mullions.map((g, i) => <mesh key={i} geometry={g} material={m.frame} />)}
      <mesh geometry={parts.glass} material={m.glass} />
      <mesh geometry={parts.rug} material={m.rug} />
      <mesh geometry={parts.sofaSeat} material={m.sofa} castShadow />
      <mesh geometry={parts.sofaBack} material={m.sofa} castShadow />
      <mesh geometry={parts.table} material={m.wood} />
      <mesh geometry={parts.tableLeg} material={m.frame} />
      <mesh geometry={parts.kitchen} material={m.kitchen} />
      <mesh geometry={parts.kitchenTall} material={m.kitchen} />
      <mesh geometry={parts.shelf} material={m.wood} />
      <mesh position={parts.pendantPos} material={m.lamp}><sphereGeometry args={[0.16, 16, 12]} /></mesh>
      <pointLight position={parts.pendantPos} intensity={3} distance={6} decay={2} color="#f6d9a0" />
      <pointLight position={parts.lampPos} intensity={2} distance={7} decay={2} color="#f0e6d6" />
    </group>
  );
}
