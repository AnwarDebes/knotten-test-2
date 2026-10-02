"use client";
import { use, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { loadTwin } from "./twinData";
import { oceanMaterial, terrainMaterial, twinUniforms } from "./materials";

/**
 * The ground for 20 km around Knotten: four nested rings of Kartverket's terrain model with the
 * aerial photo on top, and the open sea beyond. The water is part of the same surface (see
 * materials.ts), so sea, river and lakes sit exactly where the terrain model has them.
 */
export function TwinTerrain({ shadows, todayRef, gradedRef }: { shadows: boolean; todayRef?: React.Ref<THREE.Group>; gradedRef?: React.Ref<THREE.Group> }) {
  const twin = use(loadTwin());
  const materials = useMemo(() => twin.rings.map((r) => terrainMaterial(r.aerial, r.mask)), [twin]);
  const gradedMat = useMemo(() => (twin.graded ? terrainMaterial(twin.rings[0].aerial, twin.rings[0].mask, twin.graded.built) : null), [twin]);
  const ocean = useMemo(() => {
    const half = twin.rings[twin.rings.length - 1].desc.half;
    const shape = new THREE.Shape();
    const R = 160000;
    shape.absarc(0, 0, R, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.moveTo(-half, -half); hole.lineTo(-half, half); hole.lineTo(half, half); hole.lineTo(half, -half); hole.lineTo(-half, -half);
    shape.holes.push(hole);
    const g = new THREE.ShapeGeometry(shape, 48);
    g.rotateX(-Math.PI / 2);
    return { geometry: g, material: oceanMaterial() };
  }, [twin]);

  useFrame(({ clock, camera, size }) => {
    twinUniforms.uTime.value = clock.getElapsedTime();
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
