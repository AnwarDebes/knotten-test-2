/**
 * Terrain rings: decode a ring's height map and turn it into mesh arrays (three.js axes:
 * x east, y up, z south). Runs in a worker (terrain.worker.ts) or, as a fallback, on the page.
 */
import { Martini } from "./martini";

export type RingDesc = {
  name: string;
  half: number;       // the ring covers [-half, half]^2 metres
  n: number;          // posts per side, 2^k + 1
  step: number;       // height code step, metres
  offset?: number;    // height code offset, metres (the manifest's height.offset when absent)
  post_m: number;
  tex_half: number;   // the aerial photo covers [-tex_half, tex_half]^2
  hole: number;       // the next ring in covers [-hole, hole]^2 (0 for the innermost)
  frame?: "local" | "true";
  curved?: boolean;   // the heights already bend down with the earth's curvature
  shore_m?: number;   // the pipeline already ran the land down to the sea at the ring's edge
  files: { height: string; aerial: string; mask: string; roads?: string; depth?: string };
};

export type RingMesh = {
  name: string;
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
  heights: Float32Array;   // the decoded posts, row 0 = north, for height lookups on the page
};

/** Max mesh error per ring: a few centimetres at the site, metres at the horizon. */
const MAX_ERROR: Record<string, number> = { r0: 0.15, r0b: 0.12, r1: 0.6, r2: 2, r3: 8, r4: 30 };
const SKIRT: Record<string, number> = { r0: 2, r0b: 2, r1: 4, r2: 12, r3: 60, r4: 400 };

export function decodeHeights(rgba: Uint8ClampedArray, n: number, offset: number, step: number) {
  const h = new Float32Array(n * n);
  for (let i = 0, p = 0; i < n * n; i++, p += 4) h[i] = (rgba[p] * 256 + rgba[p + 1]) * step - offset;
  return h;
}

export function buildRing(desc: RingDesc, heights: Float32Array, outermost: boolean): RingMesh {
  const { n, half, post_m: post, hole, tex_half: th } = desc;
  const h = heights;
  // the outermost ring slopes down to the sea over its last 40 posts, so its edge never shows as a cliff
  // (unless the pipeline has already run its land down to the curved sea)
  if (outermost && !desc.shore_m) {
    const ramp = 40;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const d = Math.min(i, j, n - 1 - i, n - 1 - j);
      if (d < ramp) h[j * n + i] *= Math.pow(d / ramp, 1.5);
    }
  }
  const martini = new Martini(n);
  const holeIdx = hole > 0 ? hole / post : -1;      // hole edge in posts from the centre
  const c = (n - 1) / 2;
  const onHoleEdge = (x: number, y: number) => {
    if (holeIdx < 0) return false;
    const dx = Math.abs(x - c), dy = Math.abs(y - c);
    return (dx === holeIdx && dy <= holeIdx) || (dy === holeIdx && dx <= holeIdx);
  };
  const forced = (x: number, y: number) => x === 0 || y === 0 || x === n - 1 || y === n - 1 || onHoleEdge(x, y);
  const errors = martini.errors(h, forced);
  const drop = holeIdx > 0 ? (cx: number, cy: number) => Math.abs(cx - c) < holeIdx && Math.abs(cy - c) < holeIdx : undefined;
  const { vertices, triangles } = martini.mesh(errors, MAX_ERROR[desc.name] ?? 1, drop);

  const nv = vertices.length / 2;
  // skirts: every outer-edge post gets a copy hanging below it, joined by a vertical strip
  const edge: number[] = [];
  const at = new Int32Array(n * n).fill(-1);
  for (let v = 0; v < nv; v++) at[vertices[2 * v + 1] * n + vertices[2 * v]] = v;
  const walk: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) walk.push([i, 0]);
  for (let j = 0; j < n - 1; j++) walk.push([n - 1, j]);
  for (let i = n - 1; i > 0; i--) walk.push([i, n - 1]);
  for (let j = n - 1; j > 0; j--) walk.push([0, j]);
  for (const [x, y] of walk) { const v = at[y * n + x]; if (v >= 0) edge.push(v); }

  const total = nv + edge.length;
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const H = (x: number, y: number) => h[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))];
  const put = (k: number, gx: number, gy: number, dz: number) => {
    const x = -half + gx * post;
    const y = half - gy * post;
    const z = H(gx, gy) + dz;
    position[3 * k] = x; position[3 * k + 1] = z; position[3 * k + 2] = -y;
    const hx = (H(gx + 1, gy) - H(gx - 1, gy)) / (2 * post);
    const hy = -(H(gx, gy + 1) - H(gx, gy - 1)) / (2 * post);   // d/d(north)
    const len = Math.hypot(hx, 1, hy);
    normal[3 * k] = -hx / len; normal[3 * k + 1] = 1 / len; normal[3 * k + 2] = hy / len;
    uv[2 * k] = (x + th) / (2 * th);
    uv[2 * k + 1] = (y + th) / (2 * th);
  };
  for (let v = 0; v < nv; v++) put(v, vertices[2 * v], vertices[2 * v + 1], 0);
  const skirt = SKIRT[desc.name] ?? 5;
  edge.forEach((v, k) => put(nv + k, vertices[2 * v], vertices[2 * v + 1], -skirt));

  // martini's winding is clockwise seen from above in three.js axes; flip to counter-clockwise
  const nt = triangles.length / 3;
  const index = new Uint32Array(triangles.length + edge.length * 12);
  for (let t = 0; t < nt; t++) {
    index[3 * t] = triangles[3 * t];
    index[3 * t + 1] = triangles[3 * t + 2];
    index[3 * t + 2] = triangles[3 * t + 1];
  }
  fixWinding(position, index, nt);
  // skirt strips, both faces, so a hairline gap between rings shows ground colour from any side
  let o = triangles.length;
  for (let k = 0; k < edge.length; k++) {
    const a = edge[k], b = edge[(k + 1) % edge.length];
    const a2 = nv + k, b2 = nv + ((k + 1) % edge.length);
    index[o++] = a; index[o++] = a2; index[o++] = b;
    index[o++] = b; index[o++] = a2; index[o++] = b2;
    index[o++] = a; index[o++] = b; index[o++] = a2;
    index[o++] = b; index[o++] = b2; index[o++] = a2;
  }
  return { name: desc.name, position, normal, uv, index, heights: h };
}

/** Make the terrain triangles face up whatever martini's orientation was. */
function fixWinding(p: Float32Array, idx: Uint32Array, nt: number) {
  let up = 0, down = 0;
  for (let t = 0; t < nt; t += 97) {
    const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
    const ux = p[b] - p[a], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vz = p[c + 2] - p[a + 2];
    const ny = uz * vx - ux * vz;   // y of (u x v)
    if (ny > 0) up++; else if (ny < 0) down++;
  }
  if (down > up) {
    for (let t = 0; t < nt; t++) { const tmp = idx[3 * t + 1]; idx[3 * t + 1] = idx[3 * t + 2]; idx[3 * t + 2] = tmp; }
  }
}
