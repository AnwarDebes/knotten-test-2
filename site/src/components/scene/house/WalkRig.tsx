"use client";
/* eslint-disable react-hooks/immutability -- react-three-fiber's own pattern: the camera and the shared walk state are changed in useFrame outside React's render */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { Plot } from "@/lib/types";
import { HOUSE, OPENINGS, type HouseFit } from "@/lib/house/plan";
import { fromScene, toScene } from "./frame";
import { BODY, collide, findPath, placeOf, standOn, startNav, stepNav, surfacesAt, type NavBuild } from "./walk";
import { notifyWalk, walkState, type WalkStart } from "./walkState";
import { twinUniforms } from "../twin/materials";
import { forestDetail } from "../twin/TwinForest";

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, "YXZ");

/** Where a walk starts in a house, in its frame, and the way the visitor faces (as a direction in the frame). */
export function startSpot(start: WalkStart, fit: HouseFit) {
  const door = OPENINGS.find((o) => o.kind === "entry")!;
  if (start === "terrace") return { u: 1.5, v: HOUSE.hd + 2.2, z: -0.03, face: [0, -1] as [number, number] };
  if (start === "living") return { u: 1.0, v: 2.6, z: 0, face: [0, 1] as [number, number] };
  void fit;
  return { u: door.c, v: -HOUSE.hd - 1.1, z: -0.02, face: [0, 1] as [number, number] };
}

/** The scene yaw that looks along a direction of a house's frame. */
function yawFor(p: Plot, mirror: boolean, du: number, dv: number) {
  const a = toScene(p, mirror, 0, 0, 0), b = toScene(p, mirror, du, dv, 0);
  return Math.atan2(-(b.x - a.x), -(b.z - a.z));
}

/**
 * The visitor on foot. Keys (WASD or arrows, Shift to run), a stick on touch screens, dragging to look
 * and a click or tap on a floor to walk there; the camera's eye is 1.62 m above the feet and follows
 * the stairs smoothly. Walking up to another house makes it the visited one.
 */
export function WalkRig({ plots, start, onSwitch, interactive }: { plots: Plot[]; start: WalkStart; onSwitch: (index: number) => void; interactive: boolean }) {
  const { camera, size } = useThree();
  const fly = useRef<{ from: THREE.Vector3; fromQ: THREE.Quaternion; t0: number; dur: number } | null>(null);
  const started = useRef(false);
  const eyeZ = useRef(0);
  const fallV = useRef(0);
  const stuck = useRef(0);
  const lastGap = useRef<number | null>(null);
  const vel = useRef(new THREE.Vector2());
  const lastVisit = useRef(-1);
  const scenePos = useRef(new THREE.Vector3());
  const exposure = useRef(1);
  const lastNotify = useRef("");
  const navBuild = useRef<NavBuild | null>(null);

  // keyboard, while the model has the visitor's attention
  useEffect(() => {
    if (!interactive) return;
    const keys = walkState.keys;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        keys.add(k);
        if (k.startsWith("arrow")) e.preventDefault();
        walkState.path = [];
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); keys.clear(); };
  }, [interactive]);

  // a fresh start each time the walk begins
  useEffect(() => {
    started.current = false;
    lastVisit.current = -1;
    return () => { twinUniforms.uExposureBoost.value = 1; forestDetail.scale = 1; forestDetail.near = 1; walkState.path = []; };
  }, [start]);

  useFrame((_, rawDt) => {
    // a step never longer than a tenth of a second (a slow device still walks at a walking pace)
    const dt = Math.min(0.1, rawDt);
    const w = walkState;
    const world = w.world;
    if (!world || world.index !== w.visit) return;
    const p = world.plot, fit = world.fit;
    const cam = camera as THREE.PerspectiveCamera;

    // the house changed under the visitor (walked to another one): carry the position over
    if (lastVisit.current !== world.index) {
      if (started.current) {
        const s = fromScene(p, fit.mirror, scenePos.current.x, scenePos.current.y - BODY.eye, scenePos.current.z);
        w.u = s.u; w.v = s.v; w.z = s.z;
        const st = standOn(world, w.u, w.v, w.z);
        if (st) w.z = st.z;
        eyeZ.current = w.z;
      } else {
        // the first frame: the start spot, and a flight to it from where the camera is
        const s = startSpot(start, fit);
        w.u = s.u; w.v = s.v; w.z = s.z;
        eyeZ.current = s.z;
        w.yaw = yawFor(p, fit.mirror, s.face[0], s.face[1]);
        w.pitch = start === "living" ? -0.06 : -0.03;
        fly.current = { from: cam.position.clone(), fromQ: cam.quaternion.clone(), t0: performance.now(), dur: 1900 };
        w.flying = true;
        started.current = true;
        cam.near = 0.08; cam.updateProjectionMatrix();
      }
      lastVisit.current = world.index;
    }

    // ---- the grid for finding the way: a few milliseconds of it each frame from the moment the house is
    // ready, all of what is left at once when a way is asked for before it is done
    const nav = () => {
      if (!w.nav) {
        const b = navBuild.current?.world === world ? navBuild.current : startNav(world);
        stepNav(b);
        w.nav = b.nav;
        navBuild.current = null;
      }
      return w.nav;
    };
    if (!w.nav) {
      if (navBuild.current?.world !== world) navBuild.current = startNav(world);
      if (stepNav(navBuild.current, 3)) { w.nav = navBuild.current.nav; navBuild.current = null; }
    }

    // ---- look
    if (w.look.x || w.look.y) {
      w.yaw -= w.look.x * 0.0042;
      w.pitch = Math.max(-1.3, Math.min(1.3, w.pitch - w.look.y * 0.0042));
      w.look.x = 0; w.look.y = 0;
    }

    // ---- a click on the scene: march the ray to the first floor it meets, then find the way there
    if (w.click) {
      const c = w.click;
      w.click = null;
      const ndc = new THREE.Vector2((c.x / size.width) * 2 - 1, -(c.y / size.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, cam);
      let hit: [number, number, number] | null = null, under: [number, number, number] | null = null;
      for (let t = 0.3; t < 45; t += t < 8 ? 0.04 : 0.12) {
        _v.copy(ray.ray.direction).multiplyScalar(t).add(ray.ray.origin);
        const h = fromScene(p, fit.mirror, _v.x, _v.y, _v.z);
        // stopped by a wall standing in the way: a click on a wall walks to its foot
        const blocked = world.walls.some((wl) => !wl.door && wl.z0 < h.z && wl.z1 > h.z && segDist(h.u, h.v, wl.a, wl.b) < wl.t / 2);
        if (blocked && t > 0.6) { hit = under; break; }
        const ss = surfacesAt(world, h.u, h.v);
        const s = ss.find((x) => h.z - x.z < 0.03 && h.z - x.z > -0.25);
        if (s) { hit = [h.u, h.v, s.z]; break; }
        // the floor under the ray so far
        let zb = -Infinity;
        for (const x of ss) if (x.z < h.z && x.z > zb) zb = x.z;
        if (zb > -Infinity && h.z - zb < 3) under = [h.u, h.v, zb];
      }
      if (hit) w.path = findPath(nav(), [w.u, w.v, w.z], hit) ?? [];
    }
    if (w.goto) {
      const g = w.goto;
      w.goto = null;
      w.path = findPath(nav(), [w.u, w.v, w.z], [g.u, g.v, g.z]) ?? [];
    }

    // ---- move
    const keys = w.keys;
    let fwd = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0) + w.stick.y;
    let str = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0) + w.stick.x;
    const run = keys.has("shift") || w.run;
    const ml = Math.hypot(fwd, str);
    if (ml > 1) { fwd /= ml; str /= ml; }
    // scene directions of the view (flat)
    const fx = -Math.sin(w.yaw), fz = -Math.cos(w.yaw);
    const rx = Math.cos(w.yaw), rz = -Math.sin(w.yaw);
    let dx = (fwd * fx + str * rx), dz = (fwd * fz + str * rz);
    // following a path when the visitor does not steer
    if (ml < 0.05 && w.path.length) {
      const [tu, tv, tz] = w.path[0];
      const ts = toScene(p, fit.mirror, tu, tv, tz), here = toScene(p, fit.mirror, w.u, w.v, w.z);
      const ex = ts.x - here.x, ez = ts.z - here.z, d = Math.hypot(ex, ez);
      if (Math.abs(tz - w.z) < 0.5 && (d < 0.22 || (w.path.length > 1 && d < 0.4))) w.path.shift();
      else {
        dx = ex / d; dz = ez / d;
        // turn the view gently towards the way
        const want = Math.atan2(-dx, -dz);
        let dy = want - w.yaw;
        while (dy > Math.PI) dy -= 2 * Math.PI;
        while (dy < -Math.PI) dy += 2 * Math.PI;
        w.yaw += dy * Math.min(1, dt * 3.2);
      }
    }
    // a walking pace; on a long way to a chosen place a brisk one, down to a walk for the last metres
    let pace = 1.35;
    if (ml < 0.05 && w.path.length) {
      let rest = Math.hypot(w.path[0][0] - w.u, w.path[0][1] - w.v);
      for (let i = 1; i < w.path.length && rest <= 4; i++) rest += Math.hypot(w.path[i][0] - w.path[i - 1][0], w.path[i][1] - w.path[i - 1][1]);
      if (rest > 4) pace = 2.0;
    }
    const speed = (run ? 2.6 : pace) * (w.flying ? 0 : 1);
    const k = Math.min(1, dt * 7);
    vel.current.x += (dx * speed - vel.current.x) * k;
    vel.current.y += (dz * speed - vel.current.y) * k;
    if (!w.flying && (Math.abs(vel.current.x) > 1e-4 || Math.abs(vel.current.y) > 1e-4)) {
      // the step in the house's frame
      const a = fromScene(p, fit.mirror, 0, 0, 0), b = fromScene(p, fit.mirror, vel.current.x * dt, 0, vel.current.y * dt);
      const nu = w.u + (b.u - a.u), nv = w.v + (b.v - a.v);
      const [cu, cv] = collide(world, nu, nv, w.z, w.doorOpen);
      const s = standOn(world, cu, cv, w.z);
      const dist = Math.hypot(cu - w.u, cv - w.v);
      const tooSteep = s && s.kind === "ground" && s.z > w.z && (s.z - w.z) / Math.max(0.01, dist) > BODY.maxSlope;
      if (s && !tooSteep) {
        w.u = cu; w.v = cv;
        if (s.z < w.z - 0.06) { fallV.current += 9.81 * dt; w.z = Math.max(s.z, w.z - fallV.current * dt); }
        else { fallV.current = 0; w.z = s.z; }
      } else vel.current.multiplyScalar(0.3);
      // a path that makes no headway towards its next point for a second is given up (something is in the way)
      if (w.path.length) {
        const [tu, tv] = w.path[0];
        const now = Math.hypot(tu - w.u, tv - w.v);
        stuck.current = now > (lastGap.current ?? 1e9) - 0.15 * speed * dt ? stuck.current + dt : 0;
        lastGap.current = now;
        if (stuck.current > 1.0) { w.path = []; stuck.current = 0; lastGap.current = null; }
      } else lastGap.current = null;
    } else {
      const s = standOn(world, w.u, w.v, w.z);
      if (s && s.z < w.z - 0.06) { fallV.current += 9.81 * dt; w.z = Math.max(s.z, w.z - fallV.current * dt); }
      else if (s) { fallV.current = 0; w.z = s.z; }
    }
    eyeZ.current += (w.z - eyeZ.current) * Math.min(1, dt * 9);

    // ---- the camera
    const eye = toScene(p, fit.mirror, w.u, w.v, eyeZ.current + BODY.eye);
    _e.set(w.pitch, w.yaw, 0, "YXZ");
    _q.setFromEuler(_e);
    if (fly.current) {
      const f = fly.current;
      const t = Math.min(1, (performance.now() - f.t0) / f.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // over the roofs rather than through them: an arc that rises in the middle of the flight
      cam.position.lerpVectors(f.from, eye, e);
      cam.position.y += Math.sin(e * Math.PI) * Math.min(25, f.from.distanceTo(eye) * 0.25);
      cam.quaternion.slerpQuaternions(f.fromQ, _q, e);
      if (t >= 1) { fly.current = null; w.flying = false; notifyWalk(); }
    } else {
      cam.position.copy(eye);
      cam.quaternion.copy(_q);
    }
    scenePos.current.copy(cam.position);
    if (cam.fov !== 70) { cam.fov += (70 - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix(); }

    // ---- where the visitor is: room, level; eye adaptation indoors
    const place = placeOf(world, w.u, w.v, w.z);
    const key = `${place.level}|${place.room}|${w.flying}`;
    if (key !== lastNotify.current) { lastNotify.current = key; w.place = place; notifyWalk(); }
    const target = place.level === "outside" ? 1 : 1.45;
    exposure.current += (target - exposure.current) * Math.min(1, dt * 1.5);
    twinUniforms.uExposureBoost.value = exposure.current;
    // indoors the forest is seen only through the windows: fewer detailed trees, and painted ones from 140 m
    forestDetail.scale = place.level === "outside" ? 0.65 : 0.36;
    forestDetail.near = place.level === "outside" ? 1 : 0.55;

    // ---- the house nearest the visitor becomes the visited one (they can walk into any of them)
    if (!w.flying && place.level === "outside") {
      let best = world.index, bd = Math.hypot(w.u, w.v);
      const here = cam.position;
      plots.forEach((q, j) => {
        if (j === world.index) return;
        const d = Math.hypot(q.local.x - here.x, q.local.y + here.z);
        if (d < bd - 3 && d < 15) { bd = d; best = j; }
      });
      if (best !== world.index) onSwitch(best);
    }

    // ---- the hotspots follow their objects on screen, hidden behind walls and on other floors
    for (const [id, el] of w.hotEls) {
      const pos = w.hotPos.get(id);
      if (!pos) { el.style.opacity = "0"; continue; }
      _v.copy(pos).project(cam);
      const hp = fromScene(p, fit.mirror, pos.x, pos.y, pos.z);
      const lvl = w.hotLevel.get(id);
      const sameLevel = place.level === "outside" ? false : lvl === place.level;
      const dist = Math.hypot(hp.u - w.u, hp.v - w.v);
      let seen = !w.flying && sameLevel && _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05 && dist < 9;
      if (seen) seen = !world.walls.some((wl) => !wl.door && wl.t > 0.08 && wl.z0 < w.z + 1.5 && wl.z1 > w.z + 1.0 && segCross(w.u, w.v, hp.u, hp.v, wl.a, wl.b));
      el.style.transform = `translate(${((_v.x + 1) / 2) * size.width}px, ${((1 - _v.y) / 2) * size.height}px)`;
      el.style.opacity = seen ? "1" : "0";
      el.style.pointerEvents = seen ? "auto" : "none";
    }
  });
  return null;
}

function segDist(x: number, y: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 > 1e-9 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
}

/** Do the segments p-q and a-b cross (in plan)? */
function segCross(px: number, py: number, qx: number, qy: number, a: [number, number], b: [number, number]) {
  const d1 = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
  const d2 = (b[0] - a[0]) * (qy - a[1]) - (b[1] - a[1]) * (qx - a[0]);
  const d3 = (qx - px) * (a[1] - py) - (qy - py) * (a[0] - px);
  const d4 = (qx - px) * (b[1] - py) - (qy - py) * (b[0] - px);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
