"use client";
/* eslint-disable react-hooks/immutability -- react-three-fiber's own pattern: the camera, the controls and the renderer are three.js objects, changed in useFrame outside React's render */
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { EnergyFrame, Plot, SceneState } from "@/lib/types";
import { Powerlines } from "./layers";
import { TwinBuildings } from "./twin/TwinBuildings";
import { TwinTerrain } from "./twin/TwinTerrain";
import { Atmosphere, type Weather } from "./twin/Atmosphere";
import { SimLayer, type SimFrame } from "./twin/SimLayer";
import { twinUniforms } from "./twin/materials";
import { TwinLabels } from "./twin/TwinLabels";
import { takeShadowsDirty } from "./twin/shadowState";
import { groundHeight } from "./twin/twinData";
import { knottenTime } from "@/lib/solar";
import { TwinHouses, modulesFor, type PlotRegistry } from "./twin/TwinHouses";
import { PV_KWP_PER_HOME } from "@/lib/facts";
import { Planned } from "./Planned";
import { HouseInterior } from "./house/HouseInterior";
import { WalkRig } from "./house/WalkRig";
import { loadHouses } from "./house/frame";
import { walkState, type WalkStart } from "./house/walkState";
import { TwinForest } from "./twin/TwinForest";
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
  /** The energy simulation drives the scene: its moment (sun), its weather (clouds, wind) and its flows. */
  simDate?: Date;
  weather?: Weather;
  sim?: SimFrame;
  simPark?: { x: number; y: number } | null;
  showPark?: boolean;
  showWind?: boolean;
  /** Official place names over the model: off, the near ones, or also the far ones. */
  labels?: "off" | "near" | "wide";
  locale?: "no" | "en";
  /** On foot: start at a house's door, on its terrace or in its living room, and walk anywhere. */
  walk?: { plot: string; start: WalkStart } | null;
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
    knoll: { pos: [10, 128, -84], target: [40, 25, 380] },        // over the treetops on Lokkeheia, looking out over the field to the sea
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
function CameraRig({ preset, plot, inside, controls, presets, idle, frozen }: { preset: CameraPreset; plot: Plot | null; inside: boolean; controls: React.RefObject<OrbitControlsImpl | null>; presets: ReturnType<typeof framePresets>; idle: boolean; frozen: boolean }) {
  const { camera } = useThree();
  const anim = useRef<{ from: Goal; to: Goal; t0: number; dur: number } | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (frozen) { anim.current = null; return; }
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
  }, [preset, plot, inside, presets, camera, controls, frozen]);
  useFrame(() => {
    if (frozen) return;
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
      // (a debug view placed from the console holds still: no idle rotation)
      c.autoRotate = idle && !plot && !(window as unknown as { __twinHold?: boolean }).__twinHold;
      c.autoRotateSpeed = 0.16;
      if (c.autoRotate) c.update();
    }
  });
  return null;
}

/** Owns the render loop: per-state visibility, one shadow update per frame, scissor split for the wipe. */
function StateRenderer({ state, wipe, cleared, proposal, ground }: { state: SceneState; wipe: number | null; cleared: React.RefObject<THREE.Group | null>; proposal: React.RefObject<THREE.Group | null>; ground: { today: React.RefObject<THREE.Group | null>; graded: React.RefObject<THREE.Group | null> } }) {
  const { gl, scene, camera, size } = useThree();
  useEffect(() => { gl.shadowMap.autoUpdate = false; }, [gl]);
  const last = useRef<string>("");
  useFrame(() => {
    const c = cleared.current;
    const p = proposal.current;
    const showCleared = state === "today";
    const showProposal = state === "built" || state === "lived";
    const key = `${state}|${wipe === null}`;
    const changed = key !== last.current;
    last.current = key;
    gl.shadowMap.needsUpdate = takeShadowsDirty() || changed || wipe !== null;
    // today's ground or the graded ground of the plan (pads, roads), whichever this pass shows
    const groundFor = (today: boolean) => {
      const t = ground.today.current, g = ground.graded.current;
      if (t) t.visible = today || !g;
      if (g) g.visible = !today;
    };
    if (wipe === null) {
      if (c) c.visible = showCleared;
      if (p) p.visible = showProposal;
      groundFor(state === "today");
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
    groundFor(true);
    gl.setScissor(0, 0, split, h);
    gl.render(scene, camera);
    gl.shadowMap.needsUpdate = false;
    if (c) c.visible = false;
    if (p) p.visible = true;
    groundFor(false);
    gl.setScissor(split, 0, w - split, h);
    gl.shadowMap.needsUpdate = true;
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
  // ?twindebug can override the date from the console (for checking seasons and light)
  const [dateOverride, setDateOverride] = useState<{ month: number; hour: number; clouds?: number } | null>(null);
  const month = dateOverride?.month ?? props.month;
  const hour = dateOverride?.hour ?? props.hour;
  const weather = dateOverride?.clouds !== undefined ? { clouds: dateOverride.clouds, wind: 2 } : props.weather;
  const { state, wipe, plots, selectedPlot, inside = false, preset, frame, outage, quality = "full", paused = false, interactive = true, onPick, onReady, onContextLost } = props;
  const controls = useRef<OrbitControlsImpl | null>(null);
  const clearedGroup = useRef<THREE.Group>(null);
  const proposalGroup = useRef<THREE.Group>(null);
  const todayGround = useRef<THREE.Group>(null);
  const gradedGround = useRef<THREE.Group>(null);
  const registry = useRef<PlotRegistry>(new Map());
  // the scene only renders in the browser (Stage loads it with ssr: false), so the screen can be read directly
  const shadows = useMemo(() => quality === "full" && !(window.innerWidth < 900 || navigator.maxTouchPoints > 1), [quality]);
  const plot = useMemo(() => plots.find((p) => p.id === selectedPlot) ?? null, [plots, selectedPlot]);
  const presets = useMemo(() => framePresets(plots), [plots]);
  const showOverlay = state === "lived" && !!frame;
  // on foot: the house being walked through (it changes as the visitor walks up to another one)
  const [walkOverride, setWalkOverride] = useState<{ plot: string; start: WalkStart } | null | undefined>(undefined);
  const walkProp = walkOverride !== undefined ? walkOverride : props.walk;
  const walking = !!walkProp;
  const [visitIndex, setVisitIndex] = useState<number>(-1);
  const walkPlot = walkProp?.plot ?? null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the walk's house follows the page's choice, then the visitor's feet
    setVisitIndex(walkPlot ? plots.findIndex((p) => p.id === walkPlot) : -1);
  }, [walkPlot, plots]);
  const onSwitch = useCallback((i: number) => setVisitIndex(i), []);
  const visitId = walking ? (plots[visitIndex]?.id ?? null) : inside && plot ? plot.id : null;
  const interiorIndex = walking ? visitIndex : inside && plot ? plots.indexOf(plot) : -1;
  const date = useMemo(() => props.simDate ?? knottenTime(2026, month, 21, hour), [props.simDate, month, hour]);
  useEffect(() => { twinUniforms.uWind.value = weather?.wind ?? 3; }, [weather?.wind]);

  return (
    <Canvas
      shadows={shadows}
      dpr={[1, quality === "lite" ? 1 : 1.5]}
      frameloop={paused ? "never" : "always"}
      gl={{ alpha: false, antialias: quality !== "lite", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.92, powerPreference: "high-performance", logarithmicDepthBuffer: false }}
      camera={{ fov: 48, near: 1, far: 200000, position: presets.site.pos }}
      onCreated={({ gl }) => { gl.setClearColor("#c3cfd8"); }}
    >
      <Atmosphere date={date} weather={weather} shadows={shadows} quality={quality} />
      <Suspense fallback={null}>
        <TwinTerrain shadows={shadows} todayRef={todayGround} gradedRef={gradedGround} />
        <TwinBuildings shadows={shadows} />
        <Powerlines />
        <TwinForest ref={clearedGroup} month={month} quality={quality} shadows={shadows} />
        <group ref={proposalGroup}>
          <group onClick={(e) => { const a = (e.object as THREE.Mesh).geometry?.getAttribute("aHouse"); const idx = a && e.face ? Math.round(a.getX(e.face.a)) : -1; if (idx >= 0 && plots[idx]) { e.stopPropagation(); onPick?.(plots[idx].id); } }}>
            <TwinHouses plots={plots} shadows={shadows} modules={modulesFor(PV_KWP_PER_HOME)} registry={registry} visit={visitId} />
          </group>
          <Planned />
          {interiorIndex >= 0 && <HouseInterior plots={plots} index={interiorIndex} locale={props.locale ?? "no"} />}
          {props.sim ? (
            <SimLayer plots={plots} frame={props.sim} park={props.simPark ?? null} showPark={!!props.showPark} showWind={!!props.showWind} />
          ) : showOverlay && frame && <EnergyOverlay frame={frame} plots={plots} outage={!!outage} registry={registry} />}
        </group>
        {plot && !inside && !walking && <ViewCorridor plot={plot} />}
        {props.labels && props.labels !== "off" && !plot && !walking && <TwinLabels locale={props.locale ?? "no"} wide={props.labels === "wide"} />}
        {walking && visitIndex >= 0 && <Walker plots={plots} start={walkProp!.start} onSwitch={onSwitch} interactive={interactive || walkOverride !== undefined} />}
        <Ready onReady={onReady} />
      </Suspense>
      <ContextGuard onLost={onContextLost} />
      <DepthRange walking={walking || inside} />
      <DebugHook controls={controls} setDate={setDateOverride} setWalk={setWalkOverride} groups={{ cleared: clearedGroup, proposal: proposalGroup, today: todayGround, graded: gradedGround }} />
      <OrbitControls ref={controls} makeDefault enabled={!walking} enableDamping dampingFactor={0.08} enablePan={!plot && interactive} enableZoom={interactive && !inside} enableRotate={interactive} />
      <CameraRig preset={preset} plot={plot} inside={inside} controls={controls} presets={presets} idle={!interactive} frozen={walking} />
      <StateRenderer state={state} wipe={wipe} cleared={clearedGroup} proposal={proposalGroup} ground={{ today: todayGround, graded: gradedGround }} />
    </Canvas>
  );
}

/** The walk, once the houses' fit to their plots is known (the house's own world is set by HouseInterior). */
function Walker({ plots, start, onSwitch, interactive }: { plots: Plot[]; start: WalkStart; onSwitch: (i: number) => void; interactive: boolean }) {
  use(loadHouses());
  return <WalkRig plots={plots} start={start} onSwitch={onSwitch} interactive={interactive} />;
}

/**
 * The near plane follows the camera's height above the ground: close to the ground it is under a
 * metre, from the air it is several metres. The depth buffer then stays precise from the living
 * room to the horizon without a logarithmic depth buffer, which would stop the GPU from skipping
 * hidden forest (the most expensive part of the picture).
 */
function DepthRange({ walking }: { walking: boolean }) {
  const { camera } = useThree();
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    // on foot and indoors, furniture can be a hand's breadth from the eye
    if (walking) { if (cam.near !== 0.08) { cam.near = 0.08; cam.updateProjectionMatrix(); } return; }
    const ground = groundHeight(cam.position.x, -cam.position.z);
    const h = Math.max(0, cam.position.y - Math.max(0, ground));
    const near = Math.min(30, Math.max(0.8, h * 0.03));
    if (Math.abs(near - cam.near) / cam.near > 0.05) { cam.near = near; cam.updateProjectionMatrix(); }
  });
  return null;
}

/** With ?twindebug in the address, the camera and controls are reachable from the console (for checks against photos). */
type Groups = { cleared: React.RefObject<THREE.Group | null>; proposal: React.RefObject<THREE.Group | null>; today: React.RefObject<THREE.Group | null>; graded: React.RefObject<THREE.Group | null> };
function DebugHook({ controls, setDate, setWalk, groups }: { controls: React.RefObject<OrbitControlsImpl | null>; setDate: (d: { month: number; hour: number; clouds?: number } | null) => void; setWalk: (w: { plot: string; start: WalkStart } | null | undefined) => void; groups: Groups }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    if (!window.location.search.includes("twindebug")) return;
    const w = window as unknown as { __twin?: unknown };
    w.__twin = {
      camera, gl, scene, controls: controls.current,
      date(month: number, hour: number, clouds?: number) { setDate({ month, hour, clouds }); },
      /** Walk from the console: __twin.walk("plot-12", "door"); __twin.walk(null) stops; __twin.walk() hands back to the page. */
      walk(plot?: string | null, start: WalkStart = "door") { setWalk(plot === undefined ? undefined : plot === null ? null : { plot, start }); },
      walkState,
      /** A still at any size, for one state of the field, read straight back as a PNG data URL. */
      still(o: { w: number; h: number; state: "today" | "cleared" | "built" }) {
        const cam = camera as THREE.PerspectiveCamera;
        const size = gl.getSize(new THREE.Vector2()), ratio = gl.getPixelRatio(), aspect = cam.aspect;
        const c = groups.cleared.current, p = groups.proposal.current, t = groups.today.current, g = groups.graded.current;
        if (c) c.visible = o.state === "today";
        if (p) p.visible = o.state === "built";
        if (t) t.visible = o.state === "today" || !g;
        if (g) g.visible = o.state !== "today";
        gl.setPixelRatio(1);
        gl.setSize(o.w, o.h, false);
        cam.aspect = o.w / o.h;
        cam.updateProjectionMatrix();
        gl.setScissorTest(false);
        gl.shadowMap.needsUpdate = true;
        gl.render(scene, cam);
        const url = gl.domElement.toDataURL("image/png");
        gl.setPixelRatio(ratio);
        gl.setSize(size.x, size.y, false);
        cam.aspect = aspect;
        cam.updateProjectionMatrix();
        return url;
      },
      view(pos: [number, number, number], target: [number, number, number], fov?: number) {
        const c = controls.current;
        (window as unknown as { __twinHold?: boolean }).__twinHold = true;
        camera.position.set(...pos);
        if (fov) { (camera as THREE.PerspectiveCamera).fov = fov; (camera as THREE.PerspectiveCamera).updateProjectionMatrix(); }
        if (c) { c.minDistance = 0.1; c.maxDistance = 1e6; c.minPolarAngle = 0; c.maxPolarAngle = Math.PI; c.target.set(...target); c.update(); }
        else camera.lookAt(...target);
      },
    };
    return () => { delete w.__twin; };
  }, [camera, gl, scene, controls, setDate, setWalk, groups]);
  return null;
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
