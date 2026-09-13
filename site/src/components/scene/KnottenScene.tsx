"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { EnergyFrame, Plot, SceneState } from "@/lib/types";
import { Terrain, Water, Existing } from "./layers";
import { Proposal, type PlotRegistry } from "./Proposal";
import { Planned } from "./Planned";
import { Interior } from "./Interior";
import { Forest } from "./Forest";
import { Sun } from "./Sun";
import { EnergyOverlay } from "./Overlay";
import { ViewCorridor } from "./ViewCorridor";

export type CameraPreset = "fjord" | "site" | "drone" | "knoll" | "plan";

export type SceneProps = {
  state: SceneState;
  wipe: number | null;           // 0..1 → left of the split is "today", right is `state`
  month: number;
  hour: number;
  plots: Plot[];
  selectedPlot: string | null;   // stand-on-plot mode when set
  inside?: boolean;              // with selectedPlot: stand in the living room
  preset: CameraPreset;
  frame?: EnergyFrame;
  outage?: boolean;
  quality?: "full" | "lite";
  paused?: boolean;              // stop the render loop when the stage is off screen
  interactive?: boolean;         // wheel and drag only after the visitor has clicked in
  onPick?: (id: string) => void;
  onReady?: () => void;
  onContextLost?: () => void;
};

type Goal = { pos: THREE.Vector3; target: THREE.Vector3; fov: number; min: number; max: number; polarMin: number; polarMax: number };

/** Camera presets framed on the rows on the hill; three.js coords: x = east, y = up, z = south. */
export function framePresets(plots: Plot[]): Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> {
  const hill = plots.filter((p) => p.zone !== "flat");
  const pts = (hill.length ? hill : plots).map((p) => new THREE.Vector3(p.local.x, p.local.z_ground, -p.local.y));
  const box = new THREE.Box3().setFromPoints(pts.length ? pts : [new THREE.Vector3()]);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(60, 0.5 * Math.hypot(size.x, size.z));
  const dist = radius / Math.sin((48 / 2) * (Math.PI / 180));
  const at = (dir: [number, number, number], f = 1): [number, number, number] => {
    const v = new THREE.Vector3(...dir).normalize().multiplyScalar(dist * f).add(c);
    return [v.x, v.y, v.z];
  };
  const target: [number, number, number] = [c.x, c.y - 4, c.z];
  return {
    fjord: { pos: [c.x + 260, 150, c.z + 1500], target: [c.x, c.y + 10, c.z] },   // from over Snigsfjorden, looking in
    site: { pos: at([0.3, 0.38, 1], 0.95), target },                                // from the fjord side, low
    drone: { pos: at([-1, 0.55, 0.5], 1.15), target },                              // from the western ridge
    knoll: { pos: [10, 92, -80], target: [40, 20, 400] },
    plan: { pos: at([0, 1, 0.001], 0.85), target },
  };
}

function goalFor(preset: CameraPreset, plot: Plot | null, inside: boolean, presets: ReturnType<typeof framePresets>): Goal {
  if (plot) {
    const f = (plot.house.facing_deg * Math.PI) / 180;
    const wb = plot.view.water_bearings;
    const look = wb ? (((wb[0] + wb[1]) / 2) * Math.PI) / 180 : f;
    const ca = Math.cos(f), sa = Math.sin(f);
    const dir = new THREE.Vector3(Math.sin(look), 0.02, -Math.cos(look));
    if (inside) {
      // in the living room, a couple of metres from the back wall, looking out through the glass
      const u = -2.1, v = -plot.house.depth_m / 2 + 1.5;
      const eye = new THREE.Vector3(plot.local.x + u * ca + v * sa, plot.local.z_floor + 1.55, -(plot.local.y - u * sa + v * ca));
      const target = eye.clone().add(dir.clone().setY(0.05).multiplyScalar(40));
      return { pos: eye, target, fov: 68, min: 38, max: 42, polarMin: Math.PI / 2 - 0.25, polarMax: Math.PI / 2 + 0.2 };
    }
    const front = Math.max(plot.house.width_m, plot.house.depth_m) / 2 + 3.0;
    const eye = new THREE.Vector3(plot.local.x + Math.sin(look) * front, plot.local.z_floor + 1.6, -plot.local.y - Math.cos(look) * front);
    const target = eye.clone().add(dir.clone().multiplyScalar(60));
    return { pos: eye, target, fov: 62, min: 55, max: 65, polarMin: Math.PI / 2 - 0.35, polarMax: Math.PI / 2 + 0.25 };
  }
  const p = presets[preset];
  return { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target), fov: preset === "plan" ? 34 : 48, min: 30, max: 6000, polarMin: 0.05, polarMax: Math.PI / 2 - 0.04 };
}

/** Moves the camera between goals with an ease, so every change of view is a short flight, not a cut. */
function CameraRig({ preset, plot, inside, controls, presets, idle }: { preset: CameraPreset; plot: Plot | null; inside: boolean; controls: React.RefObject<OrbitControlsImpl | null>; presets: ReturnType<typeof framePresets>; idle: boolean }) {
  const { camera } = useThree();
  const anim = useRef<{ from: Goal; to: Goal; t0: number; dur: number } | null>(null);
  const first = useRef(true);
  useEffect(() => {
    const c = controls.current;
    const cam = camera as THREE.PerspectiveCamera;
    const to = goalFor(preset, plot, inside, presets);
    const from: Goal = { pos: cam.position.clone(), target: c ? c.target.clone() : to.target.clone(), fov: cam.fov, min: 0, max: 0, polarMin: 0, polarMax: Math.PI };
    if (first.current) {
      first.current = false;
      cam.position.copy(to.pos);
      cam.fov = to.fov;
      cam.updateProjectionMatrix();
      if (c) { c.target.copy(to.target); c.minDistance = to.min; c.maxDistance = to.max; c.minPolarAngle = to.polarMin; c.maxPolarAngle = to.polarMax; c.update(); }
      return;
    }
    if (c) { c.minDistance = 1; c.maxDistance = 1e6; c.minPolarAngle = 0; c.maxPolarAngle = Math.PI; }
    const far = from.pos.distanceTo(to.pos);
    anim.current = { from, to, t0: performance.now(), dur: Math.min(3200, 900 + far * 0.9) };
  }, [preset, plot, inside, presets, camera, controls]);
  useFrame(() => {
    const a = anim.current;
    const c = controls.current;
    const cam = camera as THREE.PerspectiveCamera;
    if (a) {
      const t = Math.min(1, (performance.now() - a.t0) / a.dur);
      const e = 1 - Math.pow(1 - t, 3);
      cam.position.lerpVectors(a.from.pos, a.to.pos, e);
      cam.fov = a.from.fov + (a.to.fov - a.from.fov) * e;
      cam.updateProjectionMatrix();
      if (c) { c.target.lerpVectors(a.from.target, a.to.target, e); c.update(); }
      if (t >= 1) {
        if (c) { c.minDistance = a.to.min; c.maxDistance = a.to.max; c.minPolarAngle = a.to.polarMin; c.maxPolarAngle = a.to.polarMax; c.update(); }
        anim.current = null;
      }
      return;
    }
    if (c) {
      c.autoRotate = idle && !plot;
      c.autoRotateSpeed = 0.16;
      if (c.autoRotate) c.update();
    }
  });
  return null;
}

/** Owns the render loop: per-state visibility, one shadow update per frame, scissor split for the wipe. */
function StateRenderer({ state, wipe, cleared, proposal }: { state: SceneState; wipe: number | null; cleared: React.RefObject<THREE.Group | null>; proposal: React.RefObject<THREE.Group | null> }) {
  const { gl, scene, camera, size } = useThree();
  useEffect(() => { gl.shadowMap.autoUpdate = false; }, [gl]);
  useFrame(() => {
    const c = cleared.current;
    const p = proposal.current;
    const showCleared = state === "today";
    const showProposal = state === "built" || state === "lived";
    gl.shadowMap.needsUpdate = true;
    if (wipe === null) {
      if (c) c.visible = showCleared;
      if (p) p.visible = showProposal;
      gl.setScissorTest(false);
      gl.render(scene, camera);
      return;
    }
    const w = Math.round(size.width * gl.getPixelRatio());
    const h = Math.round(size.height * gl.getPixelRatio());
    const split = Math.round(w * Math.min(0.999, Math.max(0.001, wipe)));
    gl.setScissorTest(true);
    if (c) c.visible = true;
    if (p) p.visible = false;
    gl.setScissor(0, 0, split, h);
    gl.render(scene, camera);
    gl.shadowMap.needsUpdate = false;
    if (c) c.visible = false;
    if (p) p.visible = true;
    gl.setScissor(split, 0, w - split, h);
    gl.render(scene, camera);
    gl.setScissorTest(false);
  }, 1);
  return null;
}

function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => { onReady?.(); }, [onReady]);
  return null;
}

export default function KnottenScene(props: SceneProps) {
  const { state, wipe, month, hour, plots, selectedPlot, inside = false, preset, frame, outage, quality = "full", paused = false, interactive = true, onPick, onReady, onContextLost } = props;
  const controls = useRef<OrbitControlsImpl | null>(null);
  const clearedGroup = useRef<THREE.Group>(null);
  const proposalGroup = useRef<THREE.Group>(null);
  const registry = useRef<PlotRegistry>(new Map());
  const [shadows, setShadows] = useState(false);
  useEffect(() => { setShadows(quality === "full" && !(window.innerWidth < 900 || navigator.maxTouchPoints > 1)); }, [quality]);
  const plot = useMemo(() => plots.find((p) => p.id === selectedPlot) ?? null, [plots, selectedPlot]);
  const presets = useMemo(() => framePresets(plots), [plots]);
  const showOverlay = state === "lived" && !!frame;
  const treeRadius = quality === "lite" ? 360 : 520;

  return (
    <Canvas
      shadows={shadows}
      dpr={[1, quality === "lite" ? 1 : 1.5]}
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: quality !== "lite", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, powerPreference: "high-performance" }}
      camera={{ fov: 48, near: 0.5, far: 40000, position: presets.site.pos }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#b7c6ce");
        scene.fog = new THREE.Fog("#c5d3da", 900, 9000);
      }}
    >
      <Sun month={month} hour={hour} shadows={shadows} />
      <Suspense fallback={null}>
        <Terrain shadows={shadows} />
        <Water />
        <Existing shadows={shadows} />
        <Forest ref={clearedGroup} maxRadius={treeRadius} />
        <group ref={proposalGroup}>
          <Proposal plots={plots} shadows={shadows} registry={registry} onPick={onPick} hideGlassFor={inside && plot ? plot.id : null} />
          <Planned />
          {inside && plot && <Interior plot={plot} />}
          {showOverlay && frame && <EnergyOverlay frame={frame} plots={plots} outage={!!outage} registry={registry} />}
        </group>
        {plot && !inside && <ViewCorridor plot={plot} />}
        <Ready onReady={onReady} />
      </Suspense>
      <ContextGuard onLost={onContextLost} />
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} enablePan={!plot && interactive} enableZoom={interactive && !inside} enableRotate={interactive} />
      <CameraRig preset={preset} plot={plot} inside={inside} controls={controls} presets={presets} idle={!interactive} />
      <StateRenderer state={state} wipe={wipe} cleared={clearedGroup} proposal={proposalGroup} />
    </Canvas>
  );
}

function ContextGuard({ onLost }: { onLost?: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const h = (e: Event) => { e.preventDefault(); onLost?.(); };
    el.addEventListener("webglcontextlost", h, false);
    return () => el.removeEventListener("webglcontextlost", h);
  }, [gl, onLost]);
  return null;
}
