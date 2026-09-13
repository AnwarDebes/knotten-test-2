"use client";
import * as THREE from "three";
import type { Plot } from "@/lib/types";

/**
 * Glowing arc on the horizon where, from this plot, water is visible; brighter where open sea is.
 * Drawn on top of terrain so the direction reads even when a near hill is in the way.
 */
export function ViewCorridor({ plot }: { plot: Plot }) {
  if (!plot.view.water_bearings) return null;
  const [b0, b1] = plot.view.water_bearings;
  const r = 2600;
  const toTheta = (b: number) => Math.PI - (b * Math.PI) / 180;
  const start = toTheta(b1);
  const len = ((b1 - b0) * Math.PI) / 180;
  const center = new THREE.Vector3(plot.local.x, plot.local.z_floor + 70, -plot.local.y);
  return (
    <group position={center} renderOrder={999}>
      <mesh renderOrder={999}>
        <cylinderGeometry args={[r, r, 40, 96, 1, true, start, len]} />
        <meshBasicMaterial color="#d9a441" transparent opacity={plot.view.open_sea_visible ? 0.55 : 0.3} side={THREE.DoubleSide} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  );
}
