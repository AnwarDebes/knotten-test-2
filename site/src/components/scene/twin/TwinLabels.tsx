"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { TWIN_BASE, groundHeight } from "./twinData";

type Name = { name: string; kind: "hill" | "water" | "place" | "road" | "project"; tier: 1 | 2; x: number; y: number; z: number; project?: string };

const LIFT: Record<Name["kind"], number> = { hill: 22, water: 8, place: 14, road: 8, project: 6 };
const RANK: Record<Name["kind"], number> = { project: 0, hill: 1, water: 2, place: 3, road: 4 };
const EN: Record<string, string> = { Kontorbygget: "The office building", Boligen: "The house", "Lindesnes fyr": "Lindesnes lighthouse" };

// the label chips: white text keeps 4.5:1 or better on their own backgrounds over the brightest sky
const CHIP = { display: "inline-block", whiteSpace: "nowrap", font: "600 12px/1.2 system-ui, sans-serif", letterSpacing: "0.01em", padding: "3px 8px", borderRadius: 999, transition: "opacity 0.25s", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" } as const;
const STYLE: Record<Name["kind"], React.CSSProperties> = {
  project: { ...CHIP, color: "#17283a", background: "rgba(233,180,90,0.95)", fontStyle: "normal" },
  water: { ...CHIP, color: "#ffffff", background: "rgba(47,102,136,0.92)", fontStyle: "italic" },
  hill: { ...CHIP, color: "#ffffff", background: "rgba(23,40,58,0.75)", fontStyle: "normal" },
  place: { ...CHIP, color: "#ffffff", background: "rgba(23,40,58,0.75)", fontStyle: "normal" },
  road: { ...CHIP, color: "#ffffff", background: "rgba(23,40,58,0.75)", fontStyle: "normal" },
};
const HTML_STYLE: React.CSSProperties = { pointerEvents: "none" };

/** True while the ground stands between the camera and a point (three.js axes), sampled along the sight line. */
function behindGround(cam: THREE.Vector3, p: THREE.Vector3, steps = 48) {
  for (let k = 1; k < steps; k++) {
    const t = k / steps;
    const x = cam.x + (p.x - cam.x) * t, y = cam.y + (p.y - cam.y) * t, z = cam.z + (p.z - cam.z) * t;
    if (groundHeight(x, -z) > y + 1) return true;
  }
  return false;
}

/**
 * Official place names (Kartverket's register) floating over the model, as on the owner's maps:
 * the hills round the field, Mjaavann and the Audna, the fjord, the villages, the roads, and the
 * project's own office and house. Far names (settlements, fjords, lakes and hills out to 5 km, and
 * Spangereid, Lenefjorden, Mandal and Lindesnes fyr) only in the wide views. A name the ground hides from the
 * camera is not shown; where two would overlap on screen, the more important one stays (the
 * project's buildings, then hills, water, places, roads).
 */
export function TwinLabels({ locale, wide }: { locale: "no" | "en"; wide: boolean }) {
  const [names, setNames] = useState<Name[]>([]);
  const els = useRef<(HTMLSpanElement | null)[]>([]);
  const { camera, size } = useThree();
  useEffect(() => {
    let alive = true;
    fetch(TWIN_BASE + "names.json").then((r) => r.json()).then((j: { names: Name[] }) => {
      if (alive) setNames(j.names.slice().sort((a, b) => a.tier - b.tier || RANK[a.kind] - RANK[b.kind]));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const shown = names.filter((n) => n.tier === 1 || wide);

  // declutter a few times a second: project every label, keep those that do not overlap a kept one
  // (a label's size never changes while it is shown: measured once, since reading it forces a layout)
  const sizes = useRef(new Map<string, [number, number]>());
  const last = useRef(0);
  const v = new THREE.Vector3(), at = new THREE.Vector3();
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.2) return;
    last.current = clock.elapsedTime;
    const kept: [number, number, number, number][] = [];
    shown.forEach((n, i) => {
      const el = els.current[i];
      if (!el) return;
      at.set(n.x, n.z + LIFT[n.kind], -n.y);
      v.copy(at).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width, y = (-v.y * 0.5 + 0.5) * size.height;
      const id = n.name + n.x;
      let wh = sizes.current.get(id);
      if (!wh && el.offsetWidth > 0) { wh = [el.offsetWidth, el.offsetHeight]; sizes.current.set(id, wh); }
      const [w, h] = wh ?? [80, 20];
      const box: [number, number, number, number] = [x - w / 2 - 4, y - h / 2 - 3, x + w / 2 + 4, y + h / 2 + 3];
      const clash = v.z > 1 || kept.some((k) => box[0] < k[2] && box[2] > k[0] && box[1] < k[3] && box[3] > k[1]) || behindGround(camera.position, at);
      const op = clash ? "0" : "1";
      if (el.style.opacity !== op) el.style.opacity = op;
      if (!clash) kept.push(box);
    });
  });

  return (
    <group>
      {shown.map((n, i) => (
        <Html key={n.name + n.x} position={[n.x, n.z + LIFT[n.kind], -n.y]} center zIndexRange={[20, 0]} style={HTML_STYLE}>
          <span ref={(el) => { els.current[i] = el; }} style={STYLE[n.kind]}>
            {locale === "en" ? EN[n.name] ?? n.name : n.name}
          </span>
        </Html>
      ))}
    </group>
  );
}
