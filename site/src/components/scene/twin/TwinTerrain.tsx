"use client";
import { use, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { loadTwin } from "./twinData";
import { oceanMaterial, terrainMaterial, twinClock, twinUniforms } from "./materials";

/**
 * The open sea beyond the outermost ring, out to 220 km: four strips running outward from the ring's
 * edges, bent down with the earth's curvature (less refraction) like the rings themselves, so the sea
 * meets the ring's edge exactly and its horizon dips as the real one does (0.23 degrees seen from the
 * field, 1.3 degrees from 2 km up).
 */
function oceanGeometry(half: number, rEff: number, outer = 220000, along = 129, out = 40) {
  const pos: number[] = [];
  const idx: number[] = [];
  const corners: [number, number][] = [[-half, half], [half, half], [half, -half], [-half, -half]];
  for (let side = 0; side < 4; side++) {
    const [ax, ay] = corners[side], [bx, by] = corners[(side + 1) % 4];
    const base = pos.length / 3;
    for (let i = 0; i < along; i++) {
      const s = i / (along - 1);
      const x0 = ax + (bx - ax) * s, y0 = ay + (by - ay) * s;
      const d0 = Math.hypot(x0, y0);
      const x1 = (x0 / d0) * outer, y1 = (y0 / d0) * outer;
      for (let j = 0; j <= out; j++) {
        const t = Math.pow(j / out, 1.6);
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const z = rEff > 0 ? -(x * x + y * y) / (2 * rEff) : 0;
        pos.push(x, z, -y);
      }
    }
    for (let i = 0; i < along - 1; i++) for (let j = 0; j < out; j++) {
      const a = base + i * (out + 1) + j, b = a + out + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // face up whatever the winding came out as
  g.computeVertexNormals();
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  if (n.getY(0) < 0) {
    const ia = g.getIndex()!.array as Uint32Array | Uint16Array;
    for (let k = 0; k < ia.length; k += 3) { const tmp = ia[k + 1]; ia[k + 1] = ia[k + 2]; ia[k + 2] = tmp; }
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  return g;
}

/**
 * The ground for 100 km around Knotten: five nested rings of Kartverket's terrain model with the
 * aerial photo on top (the outer three bend down with the earth's curvature), and the open sea
 * beyond. The water is part of the same surface (see materials.ts), so sea, river and lakes sit
 * exactly where the terrain model has them.
 */
export function TwinTerrain({ shadows, todayRef, gradedRef }: { shadows: boolean; todayRef?: React.Ref<THREE.Group>; gradedRef?: React.Ref<THREE.Group> }) {
  const twin = use(loadTwin());
  const materials = useMemo(() => twin.rings.map((r) => terrainMaterial(r.aerial, r.mask, undefined, r.roads ?? undefined, r.depth ?? undefined)), [twin]);
  const gradedMat = useMemo(() => (twin.graded ? terrainMaterial(twin.rings[0].aerial, twin.rings[0].mask, twin.graded.built, twin.rings[0].roads ?? undefined) : null), [twin]);
  const ocean = useMemo(() => {
    const last = twin.rings[twin.rings.length - 1].desc;
    const rEff = last.curved ? (twin.manifest.earth?.r_eff ?? 0) : 0;
    return { geometry: oceanGeometry(last.half, rEff), material: oceanMaterial() };
  }, [twin]);

  useFrame(({ clock, camera, size }) => {
    twinUniforms.uTime.value = twinClock.frozen ?? clock.getElapsedTime();
    const cam = camera as THREE.PerspectiveCamera;
    twinUniforms.uPixelAngle.value = ((cam.fov ?? 48) * Math.PI) / 180 / Math.max(1, size.height);
  });

  // the innermost ring exists twice: as measured today, and graded for the plan (pads, roads, path)
  const [r0, ...outer] = twin.rings;
  return (
    <group>
      <group ref={todayRef}>
        <mesh name="terrain-r0" geometry={r0.geometry} material={materials[0]} receiveShadow={shadows} castShadow={shadows} />
      </group>
      {twin.graded && gradedMat && (
        <group ref={gradedRef}>
          <mesh name="terrain-r0b" geometry={twin.graded.geometry} material={gradedMat} receiveShadow={shadows} castShadow={shadows} />
        </group>
      )}
      {outer.map((r, i) => (
        <mesh key={r.desc.name} name={`terrain-${r.desc.name}`} geometry={r.geometry} material={materials[i + 1]} receiveShadow={shadows && i < 1} castShadow={shadows && i < 2} />
      ))}
      <mesh name="ocean" geometry={ocean.geometry} material={ocean.material} />
    </group>
  );
}
