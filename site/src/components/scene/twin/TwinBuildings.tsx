"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { twinUniforms } from "./materials";
import { TWIN_BASE } from "./twinData";

/**
 * Every building within 1.3 km, as measured: footprints and roofs from Kartverket's laser data
 * (pipeline/twin_buildings.py). Walls get standing timber cladding and windows in the shader, from
 * the metre coordinates along each wall; at night some windows are lit.
 */
export function buildingMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.7 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = twinUniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float _kind;\nvarying float vKind;\nvarying vec2 vWall;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvKind = _kind;\nvWall = uv;");
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
  // 0 house, 0.25 barn, 0.5 shed, 0.75 large building
  float barn = step(0.2, vKind) * step(vKind, 0.3);
  float shed = step(0.4, vKind) * step(vKind, 0.6);
  float big = step(0.7, vKind);
  float board = mix(0.14, 0.24, barn);
  float groove = smoothstep(0.38, 0.47, abs(fract(vWall.x / board) - 0.5));
  diffuseColor.rgb *= 1.0 - 0.13 * groove;
  float floorH = mix(2.7, 3.2, big);
  float fy = (vWall.y - 0.8) / floorH;
  float fl = floor(fy), wy = fract(fy);
  float spacing = mix(mix(mix(3.1, 6.5, barn), 5.0, shed), 2.7, big);
  float fx = fract(vWall.x / spacing + 0.37);
  float ww = mix(mix(0.34, 0.16, barn), 0.24, shed);
  float inside = step(0.0, fy) * step(fl, 1.0 + big) * step(0.2, wy) * step(wy, 0.74) * step(0.5 - ww * 0.5, fx) * step(fx, 0.5 + ww * 0.5);
  float frame = inside * (1.0 - step(0.26, wy) * step(wy, 0.68) * step(0.5 - ww * 0.42, fx) * step(fx, 0.5 + ww * 0.42));
  bWin = inside - frame;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.92, 0.9), frame);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.05, 0.06), bWin);
  bLit = step(0.45, bHash(floor(vec2(vWall.x / spacing + 0.37, fy)) + vec2(vKind * 7.0, 3.0)));
}`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.06, bWin);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * bWin * bLit * uNight * 1.8;");
  };
  m.customProgramCacheKey = () => "twin-buildings-v1";
  return m;
}

export function TwinBuildings({ shadows }: { shadows: boolean }) {
  const gltf = useGLTF(TWIN_BASE + "buildings.glb");
  const material = useMemo(() => buildingMaterial(), []);
  useEffect(() => {
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = material;
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
    });
  }, [gltf, material, shadows]);
  return <primitive object={gltf.scene} />;
}

useGLTF.preload(TWIN_BASE + "buildings.glb");
