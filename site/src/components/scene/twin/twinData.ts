/**
 * Loads the twin's terrain once per page: the ring layout, the meshes (built in a worker), the aerial
 * photos and the masks. The promise is cached, so remounting the scene does not fetch again.
 */
import * as THREE from "three";
import { buildRing, decodeHeights, type RingDesc, type RingMesh } from "./rings";

export const TWIN_BASE = "/twin/";

export type TwinManifest = {
  version: number;
  built: string;
  height: { offset: number };
  sea_level: number;
  rings: RingDesc[];
  sources: Record<string, string>;
  graded?: { ring: string; height: string; mask: string; note: string };
};

export type TwinRing = { desc: RingDesc; geometry: THREE.BufferGeometry; aerial: THREE.Texture; mask: THREE.Texture; heights: Float32Array };
/** The innermost ring as built: the plan's pads, roads and footpath graded in (twin_grading.py). */
export type GradedRing = { geometry: THREE.BufferGeometry; built: THREE.Texture; heights: Float32Array };
export type Twin = { manifest: TwinManifest; rings: TwinRing[]; graded: GradedRing | null; heightAt: (x: number, y: number) => number };

/** The ring list the worker meshes: the four rings, and the graded copy of r0 when there is one. */
function jobs(manifest: TwinManifest): RingDesc[] {
  const out = [...manifest.rings];
  if (manifest.graded) {
    const r0 = manifest.rings.find((r) => r.name === manifest.graded!.ring)!;
    out.push({ ...r0, name: "r0b", files: { ...r0.files, height: manifest.graded.height } });
  }
  return out;
}

let cached: Promise<Twin> | null = null;
let loaded: Twin | null = null;

/** Ground height at scene coordinates once the terrain is in (0 before). */
export function groundHeight(x: number, y: number) {
  return loaded ? loaded.heightAt(x, y) : 0;
}

/** Ground height once the field is built: the plan's pads, patios, roads and path graded in (r0b), the terrain beyond. */
export function builtGroundHeight(x: number, y: number) {
  if (!loaded) return 0;
  const g = loaded.graded;
  const r0 = loaded.rings[0];
  if (g && Math.abs(x) < r0.desc.half && Math.abs(y) < r0.desc.half) return bilinear(g.heights, r0.desc, x, y);
  return loaded.heightAt(x, y);
}

/** The twin, loading it the first time. Use with React's use() inside the scene's Suspense. */
export function loadTwin(): Promise<Twin> {
  if (!cached) cached = load().catch((e) => { cached = null; throw e; });
  return cached;
}

async function ringsInWorker(manifest: TwinManifest): Promise<RingMesh[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" });
    } catch (e) { reject(e); return; }
    const out: RingMesh[] = [];
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("terrain worker timed out")); }, 60000);
    worker.onmessage = (e: MessageEvent<{ type: string; mesh?: RingMesh; message?: string }>) => {
      if (e.data.type === "ring" && e.data.mesh) out.push(e.data.mesh);
      if (e.data.type === "done") { clearTimeout(timer); worker.terminate(); resolve(out); }
      if (e.data.type === "error") { clearTimeout(timer); worker.terminate(); reject(new Error(e.data.message)); }
    };
    worker.onerror = (e) => { clearTimeout(timer); worker.terminate(); reject(new Error(e.message)); };
    worker.postMessage({ base: new URL(TWIN_BASE, location.href).href, rings: jobs(manifest), offset: manifest.height.offset, outermost: manifest.rings[manifest.rings.length - 1].name });
  });
}

async function ringsOnPage(manifest: TwinManifest): Promise<RingMesh[]> {
  const out: RingMesh[] = [];
  const list = jobs(manifest);
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const img = new Image();
    img.src = TWIN_BASE + r.files.height;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, img.width, img.height).data;
    out.push(buildRing(r, decodeHeights(px, r.n, manifest.height.offset, r.step), r.name === manifest.rings[manifest.rings.length - 1].name));
    await new Promise((res) => setTimeout(res, 0));
  }
  return out;
}

async function load(): Promise<Twin> {
  const manifest: TwinManifest = await (await fetch(TWIN_BASE + "twin.json")).json();
  const loader = new THREE.TextureLoader();
  const tex = (file: string, srgb: boolean) => loader.loadAsync(TWIN_BASE + file).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
  const meshesP = ringsInWorker(manifest).catch(() => ringsOnPage(manifest));
  const [meshes, aerials, masks, builtMask] = await Promise.all([
    meshesP,
    Promise.all(manifest.rings.map((r) => tex(r.files.aerial, true))),
    Promise.all(manifest.rings.map((r) => tex(r.files.mask, false))),
    manifest.graded ? tex(manifest.graded.mask, false) : Promise.resolve(null),
  ]);
  const geometryOf = (m: RingMesh) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(m.uv, 2));
    g.setIndex(new THREE.BufferAttribute(m.index, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  };
  const rings: TwinRing[] = manifest.rings.map((desc, i) => {
    const m = meshes.find((x) => x.name === desc.name)!;
    return { desc, geometry: geometryOf(m), aerial: aerials[i], mask: masks[i], heights: m.heights };
  });
  const gm = meshes.find((x) => x.name === "r0b");
  const graded: GradedRing | null = gm && builtMask ? { geometry: geometryOf(gm), built: builtMask, heights: gm.heights } : null;
  loaded = { manifest, rings, graded, heightAt: (x, y) => heightAt(rings, x, y) };
  return loaded;
}

/** Ground height (m above sea level) at scene coordinates, from the finest ring that covers the point. */
function heightAt(rings: TwinRing[], x: number, y: number): number {
  for (const r of rings) {
    const { half } = r.desc;
    if (Math.abs(x) > half || Math.abs(y) > half) continue;
    return bilinear(r.heights, r.desc, x, y);
  }
  return 0;
}

function bilinear(h: Float32Array, desc: RingDesc, x: number, y: number) {
  const { half, n, post_m: p } = desc;
  const fx = (x + half) / p, fy = (half - y) / p;
  const i = Math.min(n - 2, Math.max(0, Math.floor(fx))), j = Math.min(n - 2, Math.max(0, Math.floor(fy)));
  const tx = fx - i, ty = fy - j;
  const a = h[j * n + i] * (1 - tx) + h[j * n + i + 1] * tx;
  const b = h[(j + 1) * n + i] * (1 - tx) + h[(j + 1) * n + i + 1] * tx;
  return a * (1 - ty) + b * ty;
}
