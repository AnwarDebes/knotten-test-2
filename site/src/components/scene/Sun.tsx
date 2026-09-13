"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { Sky } from "@react-three/drei";
import { sunVector, knottenTime } from "@/lib/solar";

/** The real sun for Knotten at the dial's date/time, with a sky that follows it. */
export function Sun({ month, hour, shadows }: { month: number; hour: number; shadows: boolean }) {
  const sun = useMemo(() => sunVector(knottenTime(2026, month, 21, hour)), [month, hour]);
  const up = sun.elevation > 0;
  const strength = up ? Math.min(1, sun.elevation / 20) : 0;
  const warm = new THREE.Color().setHSL(0.09, 0.55, 0.55 + 0.4 * strength); // low sun is warmer
  const pos = new THREE.Vector3(sun.x, Math.max(sun.y, 0.02), sun.z).multiplyScalar(2500);
  return (
    <group>
      {/* a pale winter sky: low turbidity/rayleigh keep the zenith bright even with an 8° sun */}
      <Sky sunPosition={[sun.x, Math.max(sun.y, 0.03), sun.z]} turbidity={3.5} rayleigh={up ? 0.45 + 0.6 * (1 - strength) : 1.2} mieCoefficient={0.004} mieDirectionalG={0.8} distance={45000} />
      <hemisphereLight args={["#cfd9e0", "#3a4a3f", up ? 0.9 + 0.3 * strength : 0.35]} />
      <directionalLight
        position={pos}
        intensity={up ? 2.4 + 1.4 * strength : 0}
        color={warm}
        castShadow={shadows && up}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.6}
        shadow-camera-near={800}
        shadow-camera-far={4200}
        shadow-camera-left={-520}
        shadow-camera-right={520}
        shadow-camera-top={520}
        shadow-camera-bottom={-520}
      />
    </group>
  );
}
