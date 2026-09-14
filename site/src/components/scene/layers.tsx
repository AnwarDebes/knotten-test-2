"use client";
import { useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

useGLTF.setDecoderPath("/draco/");

export const toThree = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

function tuneMaterials(root: THREE.Object3D, opts: { receive?: boolean; cast?: boolean; roughness?: number; envMapIntensity?: number } = {}) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.receiveShadow = opts.receive ?? true;
    m.castShadow = opts.cast ?? false;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat && mat.isMeshStandardMaterial) {
      if (opts.roughness !== undefined) mat.roughness = opts.roughness;
      mat.envMapIntensity = opts.envMapIntensity ?? 0.6;
      if (mat.map) { mat.map.anisotropy = 8; mat.map.colorSpace = THREE.SRGBColorSpace; }
    }
  });
}

/** The measured ground in four tiers: the site at 1 m, then coarser rings out to a 30 km horizon. */
export function Terrain({ shadows }: { shadows: boolean }) {
  const site = useGLTF("/models/site_terrain.glb");
  const context = useGLTF("/models/context_terrain.glb");
  const surround = useGLTF("/models/surround_terrain.glb");
  const horizon = useGLTF("/models/horizon_terrain.glb");
  useEffect(() => {
    tuneMaterials(site.scene, { receive: shadows, roughness: 1 });
    tuneMaterials(context.scene, { receive: false, roughness: 1 });
    tuneMaterials(surround.scene, { receive: false, roughness: 1 });
    tuneMaterials(horizon.scene, { receive: false, roughness: 1 });
  }, [site, context, surround, horizon, shadows]);
  return (
    <group>
      <primitive object={site.scene} />
      <primitive object={context.scene} />
      <primitive object={surround.scene} />
      <primitive object={horizon.scene} />
    </group>
  );
}

/**
 * The sea and the Audna: one water material for both, so the river reads as water and not as a
 * brown patch. The river sheet sits 0.45 m over the sea and over the flat river-bed cells of the
 * LiDAR, which used to z-fight and flicker at distance; the log depth buffer on the renderer plus a
 * polygon offset on the water keeps it stable.
 */
export function Water() {
  const sea = useGLTF("/models/sea.glb");
  const river = useGLTF("/models/river.glb");
  useEffect(() => {
    const water = (order: number) => new THREE.MeshStandardMaterial({ color: new THREE.Color("#3e5a6e"), roughness: 0.2, metalness: 0.08, envMapIntensity: 1.0, polygonOffset: true, polygonOffsetFactor: -order, polygonOffsetUnits: -order * 4 });
    sea.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = water(1);
      m.renderOrder = 1;
    });
    river.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = water(2);
      m.renderOrder = 2;
    });
    river.scene.position.y = 0.25;
  }, [sea, river]);
  return (
    <group>
      <primitive object={sea.scene} />
      <primitive object={river.scene} />
    </group>
  );
}

/** The buildings and power lines that are already there, from the surface model and OSM. */
export function Existing({ shadows }: { shadows: boolean }) {
  const b = useGLTF("/models/existing_buildings.glb");
  const p = useGLTF("/models/powerlines.glb");
  useEffect(() => {
    tuneMaterials(b.scene, { receive: true, cast: shadows, roughness: 0.7 });
    tuneMaterials(p.scene, { receive: false, cast: false });
  }, [b, p, shadows]);
  return (
    <group>
      <primitive object={b.scene} />
      <primitive object={p.scene} />
    </group>
  );
}

useGLTF.preload("/models/site_terrain.glb");
useGLTF.preload("/models/context_terrain.glb");
