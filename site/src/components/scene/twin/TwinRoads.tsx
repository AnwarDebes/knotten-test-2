"use client";
import { use, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { twinUniforms } from "./materials";
import { TWIN_BASE } from "./twinData";

/** Guardrails, guard stones and street lights from the road database (pipeline/twin_roads.py). */
type RoadObjects = {
  rails: { k: "steel" | "concrete"; p: [number, number, number][] }[];
  wood: [number, number, number][];
  steel: [number, number, number][];
  stones: [number, number, number, number][];
  lights: [number, number, number, number][];
};

let objectsP: Promise<RoadObjects | null> | null = null;
function loadObjects() {
  if (!objectsP) objectsP = fetch(TWIN_BASE + "road_objects.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return objectsP;
}

/** Rails, posts and stones further out than this are smaller than a pixel from anywhere a visitor stands. */
const NEAR = 2200;
const near = (x: number, y: number) => Math.max(Math.abs(x), Math.abs(y)) < NEAR;

function railGeometry(rails: RoadObjects["rails"]) {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const steel = new THREE.Color(0.62, 0.64, 0.66).convertSRGBToLinear();
  const concrete = new THREE.Color(0.66, 0.65, 0.62).convertSRGBToLinear();
  for (const r of rails) {
    const [bot, top] = r.k === "concrete" ? [0.0, 0.8] : [0.45, 0.76];
    const c = r.k === "concrete" ? concrete : steel;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [x0, y0, z0] = r.p[i], [x1, y1, z1] = r.p[i + 1];
      if (!near(x0, y0) && !near(x1, y1)) continue;
      const b = pos.length / 3;
      pos.push(x0, z0 + bot, -y0, x1, z1 + bot, -y1, x1, z1 + top, -y1, x0, z0 + top, -y0);
      for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, items: number[][], place: (m: THREE.Matrix4, it: number[]) => void) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  const m = new THREE.Matrix4();
  items.forEach((it, i) => { place(m, it); mesh.setMatrixAt(i, m); });
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
/** A standing object at scene point (x, y north, z), turned by `ang` (radians from east, counter-clockwise). */
function stand(m: THREE.Matrix4, x: number, y: number, z: number, ang: number, dx = 0, dz = 0) {
  _q.setFromAxisAngle(_up, ang);
  _p.set(x + Math.cos(ang) * dx, z + dz, -(y + Math.sin(ang) * dx));
  return m.compose(_p, _q, _s);
}

/**
 * The roads' 3D parts as recorded in Statens vegvesen's road database: the bridges (their decks at
 * their own height, with railings), the guardrails of each recorded type, the old guard stones and
 * the street lights, whose lamps are lit at night. The road surfaces themselves are painted into the
 * ground (materials.ts). In lite mode the posts and stones (a draw call each, tens of thousands of
 * small boxes) are left out; the rails, bridges and lights stay.
 */
export function TwinRoads({ shadows, quality = "full" }: { shadows: boolean; quality?: "full" | "lite" }) {
  const gltf = useGLTF(TWIN_BASE + "roads.glb");
  const objects = use(loadObjects());
  // the lamps come on at dusk: their glow follows the scene's night uniform in the shader
  const lampMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.92, 0.82), roughness: 0.4, emissive: new THREE.Color(1.0, 0.82, 0.55), emissiveIntensity: 6 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = twinUniforms.uNight;
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uNight;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uNight;");
    };
    m.customProgramCacheKey = () => "twin-lamps-v1";
    return m;
  }, []);
  const parts = useMemo(() => {
    if (!objects) return null;
    const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.6, 0.62, 0.64), roughness: 0.45, metalness: 0.5 });
    const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.34, 0.26, 0.19), roughness: 0.9 });
    const stone = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.52, 0.51, 0.48), roughness: 0.95 });
    const rails = new THREE.Mesh(railGeometry(objects.rails), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.45, side: THREE.DoubleSide }));
    const poles = instanced(new THREE.CylinderGeometry(0.06, 0.085, 8.5, 6), metal, objects.lights, (m, [x, y, z, a]) => stand(m, x, y, z, a, 0, 3.75));
    const arms = instanced(new THREE.BoxGeometry(1.6, 0.12, 0.08), metal, objects.lights, (m, [x, y, z, a]) => stand(m, x, y, z, a, 0.8, 7.8));
    const heads = instanced(new THREE.BoxGeometry(0.6, 0.14, 0.32), lampMat, objects.lights, (m, [x, y, z, a]) => stand(m, x, y, z, a, 1.6, 7.7));
    const all: THREE.Object3D[] = [rails, poles, arms, heads];
    if (quality === "full") {
      all.push(
        instanced(new THREE.BoxGeometry(0.15, 1.15, 0.15), wood, objects.wood.filter(([x, y]) => near(x, y)), (m, [x, y, z]) => stand(m, x, y, z, 0, 0, 0.17)),
        instanced(new THREE.BoxGeometry(0.1, 1.12, 0.1), metal, objects.steel.filter(([x, y]) => near(x, y)), (m, [x, y, z]) => stand(m, x, y, z, 0, 0, 0.16)),
        instanced(new THREE.BoxGeometry(0.4, 0.85, 0.34), stone, objects.stones.filter(([x, y]) => near(x, y)), (m, [x, y, z, a]) => stand(m, x, y, z, a, 0, 0.12)),
      );
    }
    for (const o of all) { o.castShadow = shadows; o.receiveShadow = shadows; }
    return all;
  }, [objects, shadows, lampMat, quality]);
  useEffect(() => {
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
    });
  }, [gltf, shadows]);
  useEffect(() => () => { parts?.forEach((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); }); }, [parts]);
  return (
    <group>
      <primitive object={gltf.scene} />
      {parts?.map((o, i) => <primitive key={i} object={o} />)}
    </group>
  );
}

useGLTF.preload(TWIN_BASE + "roads.glb");
