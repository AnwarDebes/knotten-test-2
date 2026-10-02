"use client";
import { useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

useGLTF.setDecoderPath("/draco/");

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

/** The power lines that are already there (OpenStreetMap, poles and wires). */
export function Powerlines() {
  const p = useGLTF("/models/powerlines.glb");
  useEffect(() => { tuneMaterials(p.scene, { receive: false, cast: false }); }, [p]);
  return <primitive object={p.scene} />;
}

