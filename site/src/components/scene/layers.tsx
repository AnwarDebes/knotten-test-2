"use client";
import { use, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { TWIN_BASE } from "./twin/twinData";

useGLTF.setDecoderPath("/draco/");

/** NVE's overhead lines and masts (pipeline/twin_power.py). */
type Power = {
  poles: [number, number, number, number, number, number][];   // x, y, ground z, height, kind (0 pole, 1 H-frame), heading
  lines: { kind: "distribution" | "regional"; kv: number; sag: number; p: [number, number, number][] }[];
};

let powerP: Promise<Power | null> | null = null;
function loadPower() {
  if (!powerP) powerP = fetch(TWIN_BASE + "power.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return powerP;
}

/** Wires fade out between 250 and 700 m: a 2 cm conductor is gone long before a line of pixels would be. */
function wireMaterial() {
  const m = new THREE.LineBasicMaterial({ color: new THREE.Color(0.08, 0.085, 0.09), transparent: true, depthWrite: false });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vFade;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvFade = 1.0 - smoothstep(250.0, 700.0, length(mvPosition.xyz));");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFade;")
      .replace("#include <opaque_fragment>", "diffuseColor.a *= vFade;\n#include <opaque_fragment>");
  };
  m.customProgramCacheKey = () => "twin-wires-v1";
  return m;
}

function wireGeometry(lines: Power["lines"]) {
  const pos: number[] = [];
  for (const l of lines) {
    const off = l.kind === "regional" ? [-4, 0, 4] : [-1, 0, 1];
    for (let i = 0; i < l.p.length - 1; i++) {
      const [x0, y0, z0] = l.p[i], [x1, y1, z1] = l.p[i + 1];
      const span = Math.hypot(x1 - x0, y1 - y0);
      if (span < 1) continue;
      // across the span (the crossarm), in scene x/y
      const nx = -(y1 - y0) / span, ny = (x1 - x0) / span;
      const steps = Math.max(4, Math.min(16, Math.round(span / 12)));
      for (const o of off) {
        let px = 0, py = 0, pz = 0;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const x = x0 + (x1 - x0) * t + nx * o, y = y0 + (y1 - y0) * t + ny * o;
          const z = z0 + (z1 - z0) * t - 4 * l.sag * span * t * (1 - t);
          if (k > 0) pos.push(px, pz, -py, x, z, -y);
          px = x; py = y; pz = z;
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  return g;
}

/**
 * The overhead power lines as NVE's grid map has them (22-24 kV distribution and 110 kV regional
 * lines, out to 5 km): every mast at its recorded point and height, the wires hanging between them.
 */
export function Powerlines() {
  const power = use(loadPower());
  const parts = useMemo(() => {
    if (!power) return null;
    const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.24, 0.18), roughness: 0.9 });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const poles = power.poles.filter((o) => o[4] === 0), frames = power.poles.filter((o) => o[4] === 1);
    const legs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.15, 1, 6), wood, poles.length + 2 * frames.length);
    const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.13, 0.13), wood, poles.length + frames.length);
    let li = 0, ai = 0;
    for (const [x, y, z, h, , ang] of poles) {
      // a wooden pole with a crossarm across the line
      legs.setMatrixAt(li++, m4.compose(p.set(x, z + h / 2 - 0.5, -y), q.identity(), s.set(1, h + 1, 1)));
      q.setFromAxisAngle(up, ang + Math.PI / 2);
      arms.setMatrixAt(ai++, m4.compose(p.set(x, z + h - 0.3, -y), q, s.set(2.6, 1, 1)));
    }
    for (const [x, y, z, h, , ang] of frames) {
      // an H-frame: two poles across the line, a crossbeam on top
      const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
      for (const o of [-2.6, 2.6]) legs.setMatrixAt(li++, m4.compose(p.set(x + nx * o, z + h / 2 - 0.5, -(y + ny * o)), q.identity(), s.set(1.4, h + 1, 1.4)));
      q.setFromAxisAngle(up, ang + Math.PI / 2);
      arms.setMatrixAt(ai++, m4.compose(p.set(x, z + h - 0.3, -y), q, s.set(10, 2, 2)));
    }
    legs.count = li; arms.count = ai;
    for (const im of [legs, arms]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    const wires = new THREE.LineSegments(wireGeometry(power.lines), wireMaterial());
    wires.renderOrder = 2;
    return [legs, arms, wires];
  }, [power]);
  return <group>{parts?.map((o, i) => <primitive key={i} object={o} />)}</group>;
}
