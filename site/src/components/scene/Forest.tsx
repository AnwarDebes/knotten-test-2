"use client";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

const SPECIES = ["spruce", "pine", "birch"] as const;
type Species = (typeof SPECIES)[number];
type T = { x: number; y: number; z: number; h: number; crown: number; rot: number; tint: number; species: Species; cleared: boolean };

function templateGeometry(scene: THREE.Group): THREE.BufferGeometry {
  let found: THREE.Mesh | null = null;
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && !found) found = o as THREE.Mesh; });
  return (found as unknown as THREE.Mesh).geometry;
}

const COLORS: Record<Species, string> = { spruce: "#1d3324", pine: "#2c4a2b", birch: "#4e6a2f" };

function Instanced({ trees, species, geometry }: { trees: T[]; species: Species; geometry: THREE.BufferGeometry }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS[species]), roughness: 0.92, metalness: 0 }), [species]);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3(), scl = new THREE.Vector3(), color = new THREE.Color();
    trees.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      pos.set(t.x, t.z, -t.y);
      scl.set(t.crown, t.h, t.crown);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      color.setScalar(0.7 + t.tint * 0.7);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [trees]);
  if (trees.length === 0) return null;
  // the trees shade themselves through their normals; 30k shadow casters is what kills weak GPUs
  return <instancedMesh ref={ref} args={[geometry, material, trees.length]} castShadow={false} receiveShadow={false} frustumCulled={false} />;
}

/**
 * The measured forest, read from the compact binary (8 floats per tree, 1 MB instead of 4 MB of
 * JSON). Kept trees are always drawn; the trees the plan clears live in a group exposed through
 * `ref`, so the renderer can toggle them per pass (wipe) or per state.
 */
export const Forest = forwardRef<THREE.Group, { maxRadius?: number; onLoaded?: (n: number) => void }>(function Forest({ maxRadius = 520, onLoaded }, clearedRef) {
  const [data, setData] = useState<Float32Array | null>(null);
  const spruce = useGLTF("/models/tree_spruce.glb");
  const pine = useGLTF("/models/tree_pine.glb");
  const birch = useGLTF("/models/tree_birch.glb");
  useEffect(() => {
    let alive = true;
    fetch("/data/trees.bin").then((r) => r.arrayBuffer()).then((b) => { if (alive) { const f = new Float32Array(b); setData(f); onLoaded?.(f.length / 8); } }).catch(() => {});
    return () => { alive = false; };
  }, [onLoaded]);
  const geometries = useMemo(() => ({
    spruce: templateGeometry(spruce.scene),
    pine: templateGeometry(pine.scene),
    birch: templateGeometry(birch.scene),
  }), [spruce, pine, birch]);
  const groups = useMemo(() => {
    const out: Record<Species, { kept: T[]; cleared: T[] }> = { spruce: { kept: [], cleared: [] }, pine: { kept: [], cleared: [] }, birch: { kept: [], cleared: [] } };
    if (!data) return out;
    const r2 = maxRadius * maxRadius;
    for (let i = 0; i < data.length; i += 8) {
      const x = data[i], y = data[i + 1];
      if (x * x + y * y > r2) continue;
      const code = data[i + 7];
      const cleared = code >= 10;
      const species = SPECIES[Math.round(code % 10)] ?? "spruce";
      const t: T = { x, y, z: data[i + 2], h: data[i + 3], crown: data[i + 4], rot: data[i + 5], tint: data[i + 6], species, cleared };
      (cleared ? out[species].cleared : out[species].kept).push(t);
    }
    return out;
  }, [data, maxRadius]);
  if (!data) return null;
  return (
    <group>
      {SPECIES.map((s) => <Instanced key={s} trees={groups[s].kept} species={s} geometry={geometries[s]} />)}
      <group ref={clearedRef}>
        {SPECIES.map((s) => <Instanced key={s} trees={groups[s].cleared} species={s} geometry={geometries[s]} />)}
      </group>
    </group>
  );
});

useGLTF.preload("/models/tree_spruce.glb");
useGLTF.preload("/models/tree_pine.glb");
useGLTF.preload("/models/tree_birch.glb");
