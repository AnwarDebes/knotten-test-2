"use client";
/* eslint-disable react-hooks/immutability -- react-three-fiber's own pattern: three.js materials, geometry and loaded scenes are changed in effects and useFrame, outside React's render */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { EnergyFrame, Plot } from "@/lib/types";
import type { PlotRegistry } from "./twin/TwinHouses";

/** The living field: production on roofs, load in windows, sharing as flow, storage as a pulse. */
export function EnergyOverlay({ frame, plots, outage, registry }: { frame: EnergyFrame; plots: Plot[]; outage: boolean; registry: React.RefObject<PlotRegistry> }) {
  const amber = useMemo(() => new THREE.Color("#e2a44a"), []);
  const warm = useMemo(() => new THREE.Color("#e9b45a"), []);
  const hubRef = useRef<THREE.Mesh>(null);
  // the registry fills in as the house meshes mount; re-read it once they are all there
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const r = registry.current;
    if (r && r.size >= plots.length) return;
    const id = setTimeout(() => setTick((t) => t + 1), 250);
    return () => clearTimeout(id);
  }, [registry, plots.length, tick]);

  // emissive per plot
  useEffect(() => {
    const objects = registry.current;
    if (!objects) return;
    for (const [id, o] of objects) {
      const f = frame.plots[id];
      const pv = f ? Math.min(1, f.pv_kw / 6) : 0;
      const load = f ? Math.min(1, f.load_kw / 3.5) : 0;
      if (o.roof) (o.roof.material as THREE.MeshStandardMaterial).emissive = amber.clone().multiplyScalar(pv * 1.5);
      if (o.walls) (o.walls.material as THREE.MeshStandardMaterial).emissive = warm.clone().multiplyScalar(load * 0.5);
    }
    return () => {
      for (const [, o] of objects) {
        if (o.roof) (o.roof.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0);
        if (o.walls) (o.walls.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0);
      }
    };
  }, [frame, registry, amber, warm, tick]);

  // flows: one particle stream per sharing pair
  const flows = useMemo(() => {
    const segs: { a: THREE.Vector3; b: THREE.Vector3; kw: number }[] = [];
    const objects = registry.current;
    if (!objects) return segs;
    for (const [id, f] of Object.entries(frame.plots)) {
      const from = objects.get(id)?.pos;
      if (!from) continue;
      for (const s of f.sharing_to) {
        const to = objects.get(s.plot)?.pos;
        if (!to) continue;
        segs.push({ a: from.clone().add(new THREE.Vector3(0, 4, 0)), b: to.clone().add(new THREE.Vector3(0, 4, 0)), kw: s.kw });
      }
    }
    return segs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, registry, tick]);

  const perFlow = 14;
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = Math.max(1, flows.length * perFlow);
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return g;
  }, [flows]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const arr = geometry.attributes.position.array as Float32Array;
    flows.forEach((f, fi) => {
      for (let k = 0; k < perFlow; k++) {
        const u = (t * 0.35 + k / perFlow + fi * 0.13) % 1;
        const i = (fi * perFlow + k) * 3;
        arr[i] = f.a.x + (f.b.x - f.a.x) * u;
        arr[i + 1] = f.a.y + (f.b.y - f.a.y) * u + Math.sin(u * Math.PI) * 6;
        arr[i + 2] = f.a.z + (f.b.z - f.a.z) * u;
      }
    });
    geometry.attributes.position.needsUpdate = true;
    if (hubRef.current) {
      const s = 1 + 0.08 * Math.sin(t * 2.2) * (outage ? 2 : 1);
      hubRef.current.scale.setScalar(s);
      const m = hubRef.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.6 + 1.6 * frame.field.soc;
    }
  });

  // the shared energy hub sits by the entrance road, at the lowest plot level
  const hub = useMemo(() => {
    const low = plots.reduce((a, p) => (p.local.z_ground < a.local.z_ground ? p : a), plots[0]);
    return new THREE.Vector3(low.local.x + 18, low.local.z_ground + 5, -low.local.y + 14);
  }, [plots]);

  return (
    <group>
      <points geometry={geometry} visible={flows.length > 0}>
        <pointsMaterial color={amber} size={2.2} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
      </points>
      <mesh ref={hubRef} position={hub}>
        <sphereGeometry args={[3.2, 24, 16]} />
        <meshStandardMaterial color="#2b2f33" emissive={amber} emissiveIntensity={1} roughness={0.4} />
      </mesh>
    </group>
  );
}
