"use client";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

/**
 * The buildings that are planned next to the existing ones: the extension of the office and the
 * workshop behind the residential house. Drawn from data/buildings.json as pale volumes, so they
 * read as "planned" next to the measured existing buildings from the LiDAR.
 */
type Building = { id: string; kind: string; status: "existing" | "planned"; ring_local: [number, number][]; ground_z: number; roof_z_max: number; height_m: number };

export function Planned() {
  const [list, setList] = useState<Building[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/data/buildings.json").then((r) => r.json()).then((j: { buildings: Building[] }) => { if (alive) setList(j.buildings.filter((b) => b.status === "planned")); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const geos = useMemo(() => list.map((b) => {
    const shape = new THREE.Shape(b.ring_local.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: b.height_m, bevelEnabled: false });
    // extrude runs along +z; rotating -90° about x maps (x, north, depth) to (x, depth, -north), the scene's frame
    g.rotateX(-Math.PI / 2);
    g.translate(0, b.ground_z, 0);
    return { id: b.id, g };
  }), [list]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color("#c9d3c6"), roughness: 0.85, transparent: true, opacity: 0.85 }), []);
  useEffect(() => () => geos.forEach((x) => x.g.dispose()), [geos]);
  return (
    <group>
      {geos.map((x) => <mesh key={x.id} geometry={x.g} material={mat} castShadow receiveShadow />)}
    </group>
  );
}
