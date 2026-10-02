"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { twinUniforms } from "./materials";
import { TWIN_BASE } from "./twinData";

/**
 * Every building within 1.3 km, as measured: footprints and roofs from Kartverket's laser data
 * (pipeline/twin_buildings.py). Walls get standing timber cladding and windows in the shader, from
 * the metre coordinates along each wall; at night some windows are lit. The far file is packed
 * smaller (`packed`): its kind of face is in the colour's alpha byte and its wall coordinates are
 * 16-bit, a fraction of `uvScale` metres.
 */
export function buildingMaterial(packed?: { uvScale: number }) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.7 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = twinUniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${packed ? "" : "attribute float _kind;"}\nvarying float vKind;\nvarying vec2 vWall;`)
      .replace("#include <begin_vertex>", packed
        ? `#include <begin_vertex>\nvKind = color.a;\nvWall = uv * ${packed.uvScale.toFixed(1)};`
        : "#include <begin_vertex>\nvKind = _kind;\nvWall = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uNight;
varying float vKind;
varying vec2 vWall;
float bHash(vec2 p) { return fract(sin(dot(p, vec2(41.31, 289.17))) * 43758.5453); }
float bWin;
float bLit;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
bWin = 0.0; bLit = 0.0;
if (vKind < 0.9) {
  // 0 house, 0.25 barn, 0.5 shed, 0.75 large building, 0.875 church
  float barn = step(0.2, vKind) * step(vKind, 0.3);
  float shed = step(0.4, vKind) * step(vKind, 0.6);
  float big = step(0.7, vKind);
  float board = mix(0.14, 0.24, barn);
  float groove = smoothstep(0.38, 0.47, abs(fract(vWall.x / board) - 0.5));
  diffuseColor.rgb *= 1.0 - 0.13 * groove;
  // a church (0.875): one row of tall windows, 3.6 m apart
  float church = step(0.82, vKind) * step(vKind, 0.9);
  float floorH = mix(mix(2.7, 3.2, big), 4.6, church);
  float fy = (vWall.y - mix(0.8, 1.3, church)) / floorH;
  float fl = floor(fy), wy = fract(fy);
  float spacing = mix(mix(mix(mix(3.1, 6.5, barn), 5.0, shed), 2.7, big), 3.6, church);
  float fx = fract(vWall.x / spacing + 0.37);
  float ww = mix(mix(mix(0.34, 0.16, barn), 0.24, shed), 0.3, church);
  float y0w = mix(0.2, 0.04, church), y1w = mix(0.74, 0.86, church);
  float inside = step(0.0, fy) * step(fl, mix(1.0 + big, 0.0, church)) * step(y0w, wy) * step(wy, y1w) * step(0.5 - ww * 0.5, fx) * step(fx, 0.5 + ww * 0.5);
  float frame = inside * (1.0 - step(y0w + 0.06, wy) * step(wy, y1w - 0.06) * step(0.5 - ww * 0.42, fx) * step(fx, 0.5 + ww * 0.42));
  bWin = inside - frame;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.92, 0.9), frame);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.05, 0.06), bWin);
  bLit = step(0.45, bHash(floor(vec2(vWall.x / spacing + 0.37, fy)) + vec2(vKind * 7.0, 3.0)));
}`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.06, bWin);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * bWin * bLit * uNight * 1.8;");
  };
  m.customProgramCacheKey = () => `twin-buildings-v2${packed ? `-packed-${packed.uvScale}` : ""}`;
  return m;
}

/**
 * Every building within 1.3 km (buildings.glb), and every registered building from 1.3 to 5 km that
 * the laser data shows (buildings_far.glb, pipeline/twin_world_buildings.py: Vigeland, Snig,
 * Lonestrand, the farms). The far file has no normals (every face is flat), so it is shaded by face,
 * and its positions are 16-bit (KHR_mesh_quantization: the loader's node transform restores metres).
 */
export function TwinBuildings({ shadows }: { shadows: boolean }) {
  const gltf = useGLTF(TWIN_BASE + "buildings.glb");
  const far = useGLTF(TWIN_BASE + "buildings_far.glb");
  const material = useMemo(() => buildingMaterial(), []);
  const flat = useMemo(() => {
    const m = buildingMaterial({ uvScale: Number((far.userData as { uv_scale?: number }).uv_scale ?? 1) });
    m.flatShading = true;
    return m;
  }, [far]);
  useEffect(() => {
    for (const [scene, mat, cast] of [[gltf.scene, material, shadows], [far.scene, flat, false]] as const) {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = mat;
        mesh.castShadow = cast;
        mesh.receiveShadow = shadows;
      });
    }
  }, [gltf, far, material, flat, shadows]);
  return (
    <group>
      <primitive object={gltf.scene} />
      <primitive object={far.scene} />
    </group>
  );
}

useGLTF.preload(TWIN_BASE + "buildings.glb");
useGLTF.preload(TWIN_BASE + "buildings_far.glb");
