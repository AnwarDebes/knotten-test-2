"use client";
/* eslint-disable react-hooks/immutability -- react-three-fiber's own pattern: uniforms, instance buffers and animated objects are three.js state, changed in effects and useFrame outside React's render */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Plot } from "@/lib/types";
import { houseUniforms, MAX_HOUSES, MODULE } from "./TwinHouses";
import { groundHeight } from "./twinData";
import { twinUniforms } from "./materials";
import { markShadowsDirty } from "./shadowState";

/** One moment of the simulation, as the 3D shows it. */
export type SimFrame = {
  pv: ArrayLike<number>;      // kW per home
  kwp: number;                // installed per home
  load: ArrayLike<number>;    // kW per home
  soc: ArrayLike<number>;     // 0..1 per home
  share: ArrayLike<number>;   // kW per home: + receives from neighbours, - gives
  off?: ArrayLike<number>;    // 1 when the home is dark (power cut, battery empty)
  grid: number;               // kW, + from the grid, - to the grid
  park: number; parkKwp: number;
  wind: number; windKw: number; windSpeed: number;
};

/** Where the field meets the grid: the yard by Rodbergsveien where the access road starts (road.json). */
const GRID_POINT = new THREE.Vector3(204, 0, 66);

export function parkLayout(park: { x: number; y: number }) {
  // 15 tables of 2 x 20 modules (portrait), 5 rows of 3, facing south at 30 degrees: 600 modules
  const tables: { x: number; y: number }[] = [];
  const tw = 20 * (MODULE.w + 0.02), rowStep = 7.5;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) tables.push({ x: park.x + (c - 1) * (tw + 2.5), y: park.y + (r - 2) * rowStep });
  return { tables, tw, depth: 2 * MODULE.h + 0.04 };
}

export function turbineSpots(park: { x: number; y: number }) {
  return [{ x: park.x - 75, y: park.y + 28 }, { x: park.x + 70, y: park.y + 22 }, { x: park.x + 140, y: park.y + 44 }];
}

export function SimLayer({ plots, frame, park, showPark, showWind }: { plots: Plot[]; frame: SimFrame; park: { x: number; y: number } | null; showPark: boolean; showWind: boolean }) {
  const n = Math.min(plots.length, MAX_HOUSES);
  // house-indexed glow
  useEffect(() => {
    houseUniforms.uEnergy.value = 1;
    for (let k = 0; k < n; k++) {
      houseUniforms.uPV.value[k] = Math.min(1, frame.pv[k] / Math.max(0.1, frame.kwp * 0.75));
      houseUniforms.uLoad.value[k] = Math.min(1, frame.load[k] / 5);
      houseUniforms.uOff.value[k] = frame.off ? frame.off[k] : 0;
    }
  }, [frame, n]);
  useEffect(() => () => { houseUniforms.uEnergy.value = 0; houseUniforms.uOff.value.fill(0); }, []);

  // batteries: a slim bar beside each terrace, height = charge
  const bars = useMemo(() => {
    const g = new THREE.BoxGeometry(0.45, 1, 0.45);
    g.translate(0, 0.5, 0);
    // the bar glows faintly in its own colour, so it reads at night without lighting up the scene
    const m = new THREE.MeshStandardMaterial({ roughness: 0.5 });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * 0.22;`);
    };
    const mesh = new THREE.InstancedMesh(g, m, n);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const shell = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 1, 0.55).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: "#1d2a33", transparent: true, opacity: 0.35, depthWrite: false }), n);
    return { mesh, shell };
  }, [n]);
  useEffect(() => () => {
    for (const x of [bars.mesh, bars.shell]) { x.geometry.dispose(); (x.material as THREE.Material).dispose(); x.dispose(); }
  }, [bars]);
  // the grid point, the plant's tables and the turbines throw shadows: draw the shadow map again as they come and go
  useEffect(() => { markShadowsDirty(); return () => markShadowsDirty(); }, [showPark, showWind, park]);
  useEffect(() => {
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const p = plots[k];
      const f = (p.house.facing_deg * Math.PI) / 180;
      const u = p.house.width_m / 2 + 0.9, v = p.house.depth_m / 2 + 1.2;
      const x = p.local.x + u * Math.cos(f) + v * Math.sin(f), y = p.local.y - u * Math.sin(f) + v * Math.cos(f);
      const z = p.local.z_floor;
      const s = Math.max(0.03, frame.soc[k]);
      m4.compose(new THREE.Vector3(x, z, -y), new THREE.Quaternion(), new THREE.Vector3(1, 2.2 * s, 1));
      bars.mesh.setMatrixAt(k, m4);
      m4.compose(new THREE.Vector3(x, z, -y), new THREE.Quaternion(), new THREE.Vector3(1, 2.2, 1));
      bars.shell.setMatrixAt(k, m4);
      c.setHSL(0.02 + 0.3 * s, 0.75, 0.5);
      bars.mesh.setColorAt(k, c);
    }
    bars.mesh.instanceMatrix.needsUpdate = true;
    bars.shell.instanceMatrix.needsUpdate = true;
    if (bars.mesh.instanceColor) bars.mesh.instanceColor.needsUpdate = true;
  }, [frame, plots, n, bars]);

  // flows: neighbours sharing, and the field's exchange with the grid
  const flows = useMemo(() => {
    const homes = plots.slice(0, n).map((p) => new THREE.Vector3(p.local.x, p.local.z_floor + 7, -p.local.y));
    const givers: { i: number; kw: number }[] = [], takers: { i: number; kw: number }[] = [];
    for (let k = 0; k < n; k++) {
      if (frame.share[k] < -0.05) givers.push({ i: k, kw: -frame.share[k] });
      if (frame.share[k] > 0.05) takers.push({ i: k, kw: frame.share[k] });
    }
    givers.sort((a, b) => b.kw - a.kw); takers.sort((a, b) => b.kw - a.kw);
    const segs: { a: THREE.Vector3; b: THREE.Vector3; kw: number; kind: 0 | 1 }[] = [];
    let ti = 0;
    for (const g of givers) {
      let left = g.kw;
      while (left > 0.05 && ti < takers.length && segs.length < 40) {
        const t = takers[ti];
        const kw = Math.min(left, t.kw);
        segs.push({ a: homes[g.i], b: homes[t.i], kw, kind: 0 });
        left -= kw; t.kw -= kw;
        if (t.kw <= 0.05) ti++;
      }
    }
    if (Math.abs(frame.grid) > 0.5) {
      const mid = homes.reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(Math.max(1, homes.length));
      const gp = GRID_POINT.clone().setY(groundHeight(GRID_POINT.x, -GRID_POINT.z) + 6);
      segs.push(frame.grid > 0 ? { a: gp, b: mid, kw: frame.grid, kind: 1 } : { a: mid, b: gp, kw: -frame.grid, kind: 1 });
    }
    return segs;
  }, [frame, plots, n]);
  const PER = 12;
  const pts = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(1, flows.length * PER) * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(Math.max(1, flows.length * PER) * 3), 3));
    return g;
  }, [flows]);
  // (a new set of points with each moment of the simulation: the old one is let go, or the GPU keeps every one)
  useEffect(() => () => pts.dispose(), [pts]);
  const ptsMat = useMemo(() => new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }), []);
  useEffect(() => () => ptsMat.dispose(), [ptsMat]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pos = pts.attributes.position.array as Float32Array, col = pts.attributes.color.array as Float32Array;
    flows.forEach((f, fi) => {
      const speed = 0.25 + Math.min(0.6, f.kw / 40);
      for (let k = 0; k < PER; k++) {
        const u = (t * speed + k / PER + fi * 0.137) % 1;
        const i = (fi * PER + k) * 3;
        const lift = Math.sin(u * Math.PI) * (f.kind ? 30 : 8 + f.a.distanceTo(f.b) * 0.12);
        pos[i] = f.a.x + (f.b.x - f.a.x) * u;
        pos[i + 1] = f.a.y + (f.b.y - f.a.y) * u + lift;
        pos[i + 2] = f.a.z + (f.b.z - f.a.z) * u;
        // amber: sun power shared or sold; blue: power bought from the grid
        col[i] = f.kind ? (frame.grid > 0 ? 0.45 : 1.0) : 1.0; col[i + 1] = f.kind ? (frame.grid > 0 ? 0.7 : 0.66) : 0.72; col[i + 2] = f.kind ? (frame.grid > 0 ? 1.0 : 0.2) : 0.25;
      }
    });
    pts.attributes.position.needsUpdate = true;
    pts.attributes.color.needsUpdate = true;
  });

  return (
    <group>
      <primitive object={bars.shell} />
      <primitive object={bars.mesh} />
      <points geometry={pts} material={ptsMat} visible={flows.length > 0} frustumCulled={false} />
      {park && showPark && <SolarPark park={park} power={frame.park / Math.max(1, frame.parkKwp)} />}
      {park && showWind && <Turbines park={park} speed={frame.windSpeed} power={frame.wind / Math.max(1, frame.windKw)} />}
      <GridPoint />
    </group>
  );
}

function GridPoint() {
  const y = groundHeight(GRID_POINT.x, -GRID_POINT.z);
  return (
    <group position={[GRID_POINT.x, y, GRID_POINT.z]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[2.2, 2.2, 1.6]} />
        <meshStandardMaterial color="#7d8790" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
}

/** The shared plant on Lokkeheia (the energy direction's 600-panel scenario; placement illustrative). */
function SolarPark({ park, power }: { park: { x: number; y: number }; power: number }) {
  const geo = useMemo(() => {
    const { tables, tw, depth } = parkLayout(park);
    const tilt = (30 * Math.PI) / 180;
    const g = new THREE.BufferGeometry();
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (const t of tables) {
      const z0 = groundHeight(t.x, t.y) + 0.7;
      const yLow = t.y - (depth * Math.cos(tilt)) / 2, yHigh = t.y + (depth * Math.cos(tilt)) / 2;
      const zLow = z0, zHigh = z0 + depth * Math.sin(tilt);
      const base = pos.length / 3;
      // the table surface (south-facing), modules repeat along u
      pos.push(t.x - tw / 2, zLow, -yLow, t.x + tw / 2, zLow, -yLow, t.x + tw / 2, zHigh, -yHigh, t.x - tw / 2, zHigh, -yHigh);
      uv.push(0, 0, 20, 0, 20, 2, 0, 2);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [park]);
  const mat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 32; c.height = 64;
    const x = c.getContext("2d")!;
    x.fillStyle = "#0e1622"; x.fillRect(0, 0, 32, 64);
    x.strokeStyle = "#8f99a4"; x.lineWidth = 2; x.strokeRect(1, 1, 30, 62);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.2, metalness: 0.1, clearcoat: 0.5, side: THREE.DoubleSide, emissive: new THREE.Color("#ffb347"), emissiveIntensity: 0 });
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => { mat.map?.dispose(); mat.dispose(); }, [mat]);
  useEffect(() => { mat.emissiveIntensity = 0.5 * Math.min(1, power); }, [mat, power]);
  // the trees on the site of the plant are cleared in this scenario
  useEffect(() => {
    const { tables, tw } = parkLayout(park);
    const xs = tables.map((t) => t.x), ys = tables.map((t) => t.y);
    twinUniforms.uClear.value.set(Math.min(...xs) - tw / 2 - 4, -(Math.max(...ys) + 8), Math.max(...xs) + tw / 2 + 4, -(Math.min(...ys) - 8));
    twinUniforms.uClearOn.value = 1;
    return () => { twinUniforms.uClearOn.value = 0; };
  }, [park]);
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
}

/** Three small turbines (the budget's 3 x 8 kW; placement illustrative), turning with the hour's wind. */
function Turbines({ park, speed, power }: { park: { x: number; y: number }; speed: number; power: number }) {
  const rotors = useRef<THREE.Group[]>([]);
  const spots = useMemo(() => turbineSpots(park).map((s) => ({ ...s, z: groundHeight(s.x, s.y) })), [park]);
  useFrame((_, dt) => {
    // a small turbine spins at about 150 to 250 rpm in good wind; a third of that reads better on screen
    const rps = speed > 3 ? Math.min(1.2, 0.25 + power * 1.0) : speed * 0.04;
    rotors.current.forEach((r) => { if (r) r.rotation.z += rps * dt * Math.PI * 2; });
  });
  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, s.z, -s.y]} rotation={[0, -Math.PI / 4, 0]}>
          <mesh position={[0, 9, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.22, 18, 8]} />
            <meshStandardMaterial color="#e8e9ea" roughness={0.5} />
          </mesh>
          <group position={[0, 18, 0.35]} ref={(g) => { if (g) rotors.current[i] = g; }}>
            {[0, 1, 2].map((b) => (
              <group key={b} rotation={[0, 0, (b * 2 * Math.PI) / 3]}>
                <mesh position={[0, 1.7, 0]}>
                  <boxGeometry args={[0.22, 3.2, 0.05]} />
                  <meshStandardMaterial color="#f2f3f4" roughness={0.4} />
                </mesh>
              </group>
            ))}
          </group>
          <mesh position={[0, 18, 0]}>
            <boxGeometry args={[0.4, 0.4, 0.9]} />
            <meshStandardMaterial color="#d9dbdd" roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
