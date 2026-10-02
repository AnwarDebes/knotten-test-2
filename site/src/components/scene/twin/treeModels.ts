/**
 * The four kinds of tree on Knotten, built in a unit box (height 1, crown radius 1) and scaled per
 * tree to its measured height and crown. Wood is solid (group 0, bark colours); foliage is cards
 * painted with needles, leaves and twigs (group 1, see foliageTextures.ts), with normals bent out
 * from the crown's middle so a crown is lit like a volume and not like a stack of paper.
 *
 *   spruce  dense, dark, drooping whorls down to near the ground (Picea abies)
 *   pine    tall bare trunk, orange-red higher up, a flat open crown of needle tufts (Pinus sylvestris)
 *   birch   white trunk, upswept twigs, a light oval crown (Betula)
 *   oak     short dark trunk, heavy limbs, a broad rounded crown (Quercus)
 */
import * as THREE from "three";

type B = { pos: number[]; nrm: number[]; col: number[]; uv: number[]; wood: number[]; leaf: number[] };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function vtx(b: B, p: THREE.Vector3, n: THREE.Vector3, c: number[], u = 0, v = 0) {
  b.pos.push(p.x, p.y, p.z);
  const l = n.length() || 1;
  b.nrm.push(n.x / l, n.y / l, n.z / l);
  b.col.push(c[0], c[1], c[2]);
  b.uv.push(u, v);
  return b.pos.length / 3 - 1;
}

/** sRGB 0..1 to linear light (vertex colours are linear). Bark colours below are written as sRGB. */
const lin = (c: number[]) => c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));

/** A tapered trunk or branch from a to e; colours in sRGB. */
function limb(b: B, a: THREE.Vector3, e: THREE.Vector3, r0: number, r1: number, sides: number, s0: number[], s1: number[]) {
  const c0 = lin(s0), c1 = lin(s1);
  const axis = e.clone().sub(a).normalize();
  const tmp = Math.abs(axis.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(axis, tmp).normalize();
  const w = new THREE.Vector3().crossVectors(axis, u).normalize();
  const ring = (p: THREE.Vector3, r: number, c: number[]) => {
    const out: number[] = [];
    for (let i = 0; i < sides; i++) {
      const t = (i / sides) * Math.PI * 2;
      const n = u.clone().multiplyScalar(Math.cos(t)).add(w.clone().multiplyScalar(Math.sin(t)));
      out.push(vtx(b, p.clone().add(n.clone().multiplyScalar(r)), n, c));
    }
    return out;
  };
  const A = ring(a, r0, c0), E = ring(e, r1, c1);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    b.wood.push(A[i], A[j], E[i], A[j], E[j], E[i]);
  }
}

/**
 * A foliage card: from `origin` it runs `len` along `along` (the texture's up) and is `wid` wide
 * across `across`. Normals point out of the crown centre `cc`, lifted a little toward the sky.
 */
function card(b: B, origin: THREE.Vector3, along: THREE.Vector3, across: THREE.Vector3, len: number, wid: number, cc: THREE.Vector3, cr: number, yLo: number, yHi: number) {
  const half = across.clone().multiplyScalar(wid / 2);
  const tip = along.clone().multiplyScalar(len);
  const corners = [origin.clone().sub(half), origin.clone().add(half), origin.clone().add(tip).add(half), origin.clone().add(tip).sub(half)];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const idx = corners.map((p, k) => {
    const out = p.clone().sub(cc).divideScalar(cr);
    const n = out.add(V(0, 0.45, 0));
    const ao = 0.5 + 0.5 * Math.min(1, Math.max(0, (p.y - yLo) / Math.max(0.01, yHi - yLo)));
    return vtx(b, p, n, [ao, ao, ao], uvs[k][0], uvs[k][1]);
  });
  b.leaf.push(idx[0], idx[1], idx[2], idx[0], idx[2], idx[3]);
}

/** A clump of foliage: cards crossing at its centre in three directions, one lying nearly flat. */
function clump(b: B, c: THREE.Vector3, r: number, rnd: () => number, cc: THREE.Vector3, cr: number, yLo: number, yHi: number, cards = 3) {
  const phi = rnd() * Math.PI;
  for (let k = 0; k < cards - 1; k++) {
    const a = phi + (k * Math.PI) / (cards - 1);
    const tilt = (rnd() - 0.5) * 0.5;
    const along = V(Math.sin(tilt) * Math.cos(a + 1.57), Math.cos(tilt), Math.sin(tilt) * Math.sin(a + 1.57)).normalize();
    const across = V(Math.cos(a), 0, Math.sin(a));
    card(b, c.clone().sub(along.clone().multiplyScalar(r)), along, across, 2 * r, 2 * r, cc, cr, yLo, yHi);
  }
  const a = rnd() * Math.PI * 2;
  const along = V(Math.cos(a), 0.18, Math.sin(a)).normalize();
  const across = V(-Math.sin(a), 0, Math.cos(a));
  card(b, c.clone().sub(along.clone().multiplyScalar(r)), along, across, 2 * r, 2 * r, cc, cr, yLo, yHi);
}

function finish(b: B) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
  g.setIndex([...b.wood, ...b.leaf]);
  g.addGroup(0, b.wood.length, 0);
  g.addGroup(b.wood.length, b.leaf.length, 1);
  g.computeBoundingSphere();
  return g;
}

const empty = (): B => ({ pos: [], nrm: [], col: [], uv: [], wood: [], leaf: [] });

export function spruce(seed = 1) {
  const b = empty();
  const r = rng(seed);
  limb(b, V(0, -0.05, 0), V(0, 0.99, 0), 0.055, 0.01, 5, [0.25, 0.19, 0.15], [0.3, 0.22, 0.16]);
  const cc = V(0, 0.42, 0);
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1);
    const y = 0.07 + f * 0.86;
    const L = 1.02 * Math.pow(1 - f * 0.94, 0.92);
    const n = 6 - Math.floor(f * 2.2);
    const phase = r() * 6.28;
    for (let k = 0; k < n; k++) {
      const a = phase + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.4;
      const droop = -0.32 - 0.25 * (1 - f) + (r() - 0.5) * 0.12;
      const along = V(Math.cos(a), droop, Math.sin(a)).normalize();
      const across = V(-Math.sin(a), 0, Math.cos(a));
      card(b, V(0, y + 0.03, 0), along, across, L * (0.92 + r() * 0.16), L * 0.62, cc, 0.9, 0.0, 1.0);
    }
  }
  // the leader at the top and a crossed core so the crown never looks hollow
  card(b, V(0, 0.84, 0), V(0, 1, 0), V(1, 0, 0), 0.17, 0.16, cc, 0.9, 0, 1);
  card(b, V(0, 0.84, 0), V(0, 1, 0), V(0, 0, 1), 0.17, 0.16, cc, 0.9, 0, 1);
  return finish(b);
}

export function pine(seed = 1) {
  const b = empty();
  const r = rng(seed);
  limb(b, V(0, -0.05, 0), V(0.015, 0.46, 0), 0.075, 0.058, 6, [0.29, 0.24, 0.2], [0.44, 0.28, 0.17]);
  limb(b, V(0.015, 0.46, 0), V(-0.02, 0.9, 0.01), 0.058, 0.028, 6, [0.44, 0.28, 0.17], [0.62, 0.36, 0.2]);
  const cc = V(0, 0.82, 0);
  // a forest pine's crown: the top third or so, flat-topped and full enough that it reads as a crown
  // from a distance (and not as a stick with a few dots), with its lower branches thinning out
  const tufts: [number, number, number, number][] = [
    [0.0, 0.92, 0.0, 0.34], [0.5, 0.82, 0.18, 0.31], [-0.46, 0.8, -0.18, 0.31], [0.14, 0.72, -0.5, 0.28],
    [-0.2, 0.96, 0.3, 0.27], [-0.34, 0.7, 0.42, 0.26], [0.36, 0.95, -0.24, 0.26], [0.62, 0.74, -0.2, 0.24],
    [0.22, 0.86, 0.5, 0.28], [-0.58, 0.86, 0.12, 0.26], [-0.12, 0.84, -0.6, 0.27], [0.42, 0.66, 0.42, 0.22],
    [-0.4, 0.64, -0.36, 0.21], [0.0, 0.78, 0.0, 0.32], [0.18, 1.0, -0.1, 0.22],
  ];
  for (const [x, y, z, s] of tufts) {
    limb(b, V(0, y - 0.1, 0), V(x * 0.85, y - 0.03, z * 0.85), 0.018, 0.008, 3, [0.5, 0.31, 0.18], [0.45, 0.3, 0.2]);
    clump(b, V(x, y, z), s, r, cc, 0.75, 0.6, 1.05);
  }
  return finish(b);
}

export function birch(seed = 1) {
  const b = empty();
  const r = rng(seed);
  limb(b, V(0, -0.05, 0), V(0.01, 0.32, 0), 0.045, 0.034, 6, [0.26, 0.23, 0.21], [0.66, 0.64, 0.6]);
  limb(b, V(0.01, 0.32, 0), V(-0.02, 0.96, 0.02), 0.034, 0.008, 6, [0.66, 0.64, 0.6], [0.46, 0.4, 0.37]);
  const cc = V(0, 0.68, 0);
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2 + r();
    const y = 0.36 + (i / 8) * 0.44;
    const len = 0.5 + r() * 0.3;
    limb(b, V(0, y, 0), V(Math.cos(t) * len, y + 0.22 + r() * 0.1, Math.sin(t) * len), 0.014, 0.004, 3, [0.55, 0.47, 0.42], [0.36, 0.28, 0.27]);
  }
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.55;
    const y = 0.48 + r() * 0.46;
    const shrink = 1 - Math.max(0, y - 0.8) * 1.8;
    clump(b, V(Math.cos(a) * d * shrink, y, Math.sin(a) * d * shrink), 0.32 + r() * 0.08, r, cc, 0.7, 0.4, 1.0, 3);
  }
  return finish(b);
}

export function oak(seed = 1) {
  const b = empty();
  const r = rng(seed);
  limb(b, V(0, -0.05, 0), V(0.02, 0.46, 0), 0.095, 0.072, 7, [0.24, 0.21, 0.18], [0.28, 0.24, 0.2]);
  const arms: [number, number, number][] = [[0.6, 0.66, 0.2], [-0.55, 0.62, -0.12], [0.16, 0.7, -0.56], [-0.22, 0.74, 0.54], [0.05, 0.9, 0.04]];
  for (const [x, y, z] of arms) limb(b, V(0.02, 0.42, 0), V(x * 0.85, y, z * 0.85), 0.045, 0.014, 4, [0.27, 0.23, 0.2], [0.3, 0.26, 0.22]);
  const cc = V(0, 0.68, 0);
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.7;
    const y = 0.5 + r() * 0.42 - d * 0.12;
    clump(b, V(Math.cos(a) * d, y, Math.sin(a) * d), 0.36 + r() * 0.08, r, cc, 0.8, 0.42, 0.98, 3);
  }
  return finish(b);
}

/*
 * Close-range trees (within about 70 m of the camera). The models above are built to read at 100 to
 * 250 m; from a few metres away a pine of eight tufts on a pole is plainly not a pine. These have
 * the real architecture: branches in whorls that bend with weight and light, sub-branches, needle
 * sprays and leaf twigs along them, and in winter a broadleaf crown that is a skeleton of twigs.
 * Still one unit box (height 1, crown radius 1), so the same per-tree scale applies.
 */

/** A limb that bends as it grows: `lift` turns it toward the sky (positive) or lets it hang (negative). */
function bentLimb(b: B, start: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, r1: number, segs: number, lift: number, s0: number[], s1: number[], sides = 4) {
  const pts = [start.clone()];
  const d = dir.clone().normalize();
  const step = len / segs;
  for (let i = 0; i < segs; i++) {
    d.y += lift / segs;
    d.normalize();
    pts.push(pts[i].clone().add(d.clone().multiplyScalar(step)));
  }
  const mix = (t: number) => s0.map((v, k) => v + (s1[k] - v) * t);
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    limb(b, pts[i], pts[i + 1], r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, sides, mix(t0), mix(t1));
  }
  return { pts, tip: pts[segs], dir: d };
}

/** Two crossed cards along a twig: a spray of needles or leaves, its base at `base`. */
function spray(b: B, base: THREE.Vector3, dir: THREE.Vector3, len: number, wid: number, roll: number, cc: THREE.Vector3, cr: number, yLo: number, yHi: number) {
  const along = dir.clone().normalize();
  const ref = Math.abs(along.y) < 0.95 ? V(0, 1, 0) : V(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(along, ref).normalize();
  const up = new THREE.Vector3().crossVectors(side, along).normalize();
  for (const a of [roll, roll + Math.PI / 2]) {
    const across = side.clone().multiplyScalar(Math.cos(a)).add(up.clone().multiplyScalar(Math.sin(a)));
    card(b, base, along, across, len, wid, cc, cr, yLo, yHi);
  }
}

export function pineDetail(seed = 1) {
  const b = empty();
  const r = rng(seed);
  // a straight, slightly wandering stem; grey-brown flaking bark low, orange "fox" bark in the crown
  const stem: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) stem.push(V((r() - 0.5) * 0.03 * (i / 8), -0.04 + (i / 8) * 1.0, (r() - 0.5) * 0.03 * (i / 8)));
  const barkLow = [0.3, 0.25, 0.21], barkHigh = [0.66, 0.4, 0.24];
  const at = (y: number) => { const i = Math.min(7, Math.max(0, Math.floor((y + 0.04) * 8))); const t = (y + 0.04) * 8 - i; return stem[i].clone().lerp(stem[i + 1], t); };
  for (let i = 0; i < 8; i++) {
    const t0 = i / 8, t1 = (i + 1) / 8;
    const c0 = barkLow.map((v, k) => v + (barkHigh[k] - v) * Math.max(0, t0 - 0.35) / 0.65);
    const c1 = barkLow.map((v, k) => v + (barkHigh[k] - v) * Math.max(0, t1 - 0.35) / 0.65);
    limb(b, stem[i], stem[i + 1], 0.075 * (1 - t0 * 0.8), 0.075 * (1 - t1 * 0.8), 7, c0, c1);
  }
  const cc = V(0, 0.76, 0);
  // dead stubs low on the stem, as on a pine that grew up in forest
  for (let i = 0; i < 6; i++) {
    const y = 0.22 + r() * 0.3, a = r() * Math.PI * 2;
    limb(b, at(y), at(y).add(V(Math.cos(a) * 0.16, 0.03, Math.sin(a) * 0.16)), 0.01, 0.004, 3, [0.32, 0.27, 0.23], [0.36, 0.31, 0.26]);
  }
  // living crown: whorls from 45 % of the height to the top; a broad, flattening crown
  const whorls = 9;
  for (let w = 0; w < whorls; w++) {
    const f = w / (whorls - 1);
    const y = 0.47 + f * 0.47;
    const n = 3 + Math.floor(r() * 3);
    const phase = r() * Math.PI * 2;
    const reach = (0.62 + 0.4 * Math.sin(Math.PI * Math.min(1, 0.25 + f * 0.85))) * (1 - f * 0.55);
    for (let k = 0; k < n; k++) {
      const a = phase + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.6;
      const dir = V(Math.cos(a), 0.15 + 0.35 * f + (r() - 0.5) * 0.2, Math.sin(a));
      const L = reach * (0.75 + r() * 0.4);
      const main = bentLimb(b, at(y), dir, L, 0.022 * (1 - f * 0.5), 0.006, 3, 0.35, [0.42, 0.33, 0.26], [0.38, 0.31, 0.25], 4);
      // sub-branches toward the light, each carrying shoots of needles along its outer part
      for (let s = 1; s <= 3; s++) {
        const p = main.pts[s];
        const side = V(-dir.z, 0, dir.x).multiplyScalar(r() < 0.5 ? -1 : 1);
        const sd = main.dir.clone().add(side.multiplyScalar(0.7)).add(V(0, 0.45, 0)).normalize();
        const sub = bentLimb(b, p, sd, L * (0.32 + r() * 0.12), 0.007, 0.003, 2, 0.3, [0.4, 0.32, 0.25], [0.38, 0.31, 0.25], 3);
        spray(b, sub.pts[1], sub.dir, 0.17 + r() * 0.06, 0.15 + r() * 0.05, r() * 3.14, cc, 0.85, 0.45, 1.05);
        spray(b, sub.pts[0].clone().lerp(sub.pts[1], 0.5), sub.dir.clone().add(V(0, 0.4, 0)), 0.13 + r() * 0.05, 0.12, r() * 3.14, cc, 0.85, 0.45, 1.05);
      }
      // the branch's own leading shoots, and a few more along it
      spray(b, main.pts[2], main.dir.clone().add(V(0, 0.5, 0)), 0.2 + r() * 0.06, 0.17, r() * 3.14, cc, 0.85, 0.45, 1.05);
      spray(b, main.pts[3].clone().sub(main.dir.clone().multiplyScalar(0.04)), main.dir.clone().add(V(0, 0.3, 0)), 0.18 + r() * 0.05, 0.16, r() * 3.14, cc, 0.85, 0.45, 1.05);
    }
  }
  spray(b, at(0.9), V(0, 1, 0), 0.16, 0.16, r() * 3.14, cc, 0.85, 0.45, 1.05);
  return finish(b);
}

export function spruceDetail(seed = 1) {
  const b = empty();
  const r = rng(seed);
  limb(b, V(0, -0.05, 0), V(0, 0.5, 0), 0.06, 0.035, 6, [0.26, 0.2, 0.16], [0.3, 0.23, 0.17]);
  limb(b, V(0, 0.5, 0), V(0, 1.0, 0), 0.035, 0.006, 5, [0.3, 0.23, 0.17], [0.34, 0.26, 0.18]);
  const cc = V(0, 0.45, 0);
  const tiers = 18;
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1);
    const y = 0.05 + f * 0.9;
    const L = 1.0 * Math.pow(1 - f * 0.95, 0.95);
    const n = 7 - Math.floor(f * 3);
    const phase = r() * 6.28;
    for (let k = 0; k < n; k++) {
      const a = phase + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
      // branches leave the stem level and droop with their weight; the lowest hang most
      const dir = V(Math.cos(a), 0.05, Math.sin(a));
      const main = bentLimb(b, V(0, y, 0), dir, L * 0.85, 0.012 * (1 - f * 0.6), 0.003, 3, -0.55 - 0.3 * (1 - f), [0.3, 0.23, 0.17], [0.27, 0.22, 0.16], 3);
      // the frond lies along the branch; a second, steeper one gives the hanging "curtain" of shoots
      const along = main.tip.clone().sub(V(0, y, 0)).normalize();
      const across = V(-Math.sin(a), 0, Math.cos(a));
      card(b, V(0, y + 0.02, 0), along, across, L * (0.95 + r() * 0.12), L * 0.6, cc, 0.9, 0, 1);
      if (L > 0.25) {
        const hang = along.clone().add(V(0, -0.55, 0)).normalize();
        card(b, V(0, y, 0).add(along.clone().multiplyScalar(L * 0.25)), hang, across, L * 0.7, L * 0.45, cc, 0.9, 0, 1);
      }
    }
  }
  card(b, V(0, 0.88, 0), V(0, 1, 0), V(1, 0, 0), 0.14, 0.12, cc, 0.9, 0, 1);
  card(b, V(0, 0.88, 0), V(0, 1, 0), V(0, 0, 1), 0.14, 0.12, cc, 0.9, 0, 1);
  return finish(b);
}

/** Birch and oak: a branching skeleton (it is what one sees in winter), leaf twigs on its ends. */
function broadleafDetail(seed: number, kind: "birch" | "oak") {
  const b = empty();
  const r = rng(seed);
  const birch = kind === "birch";
  // trunk: white with black fissures low on a birch, dark ridged bark on an oak
  const trunkTop = birch ? 0.42 : 0.38;
  const low = birch ? [0.2, 0.19, 0.18] : [0.24, 0.21, 0.18], high = birch ? [0.78, 0.76, 0.72] : [0.3, 0.26, 0.22];
  limb(b, V(0, -0.05, 0), V(0, 0.12, 0), birch ? 0.05 : 0.1, birch ? 0.042 : 0.085, 7, low, birch ? [0.5, 0.48, 0.45] : low);
  limb(b, V(0, 0.12, 0), V(0.02, trunkTop, 0), birch ? 0.042 : 0.085, birch ? 0.034 : 0.07, 7, birch ? [0.5, 0.48, 0.45] : low, high);
  const cc = V(0, birch ? 0.66 : 0.64, 0);
  const tips: { p: THREE.Vector3; d: THREE.Vector3 }[] = [];
  const grow = (p: THREE.Vector3, d: THREE.Vector3, len: number, rad: number, depth: number) => {
    const lift = birch ? 0.25 : 0.05;
    const seg = bentLimb(b, p, d, len, rad, rad * 0.55, depth > 1 ? 3 : 2, lift + (depth === 0 && birch ? -0.5 : 0), birch ? [0.62, 0.6, 0.57] : [0.3, 0.26, 0.22], birch ? [0.36, 0.3, 0.29] : [0.3, 0.27, 0.23], depth > 1 ? 4 : 3);
    if (depth === 0) { tips.push({ p: seg.tip, d: seg.dir }); return; }
    const kids = 2 + (r() < (birch ? 0.6 : 0.45) ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const at = seg.pts[Math.min(seg.pts.length - 1, 1 + Math.floor(r() * (seg.pts.length - 1)))];
      const spin = r() * Math.PI * 2;
      const nd = seg.dir.clone().add(V(Math.cos(spin), (r() - 0.3) * 0.6, Math.sin(spin)).multiplyScalar(birch ? 0.75 : 0.95)).normalize();
      grow(at, nd, len * (0.55 + r() * 0.15), rad * 0.6, depth - 1);
    }
    tips.push({ p: seg.tip, d: seg.dir });
  };
  const n = birch ? 7 : 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.8;
    const y = trunkTop - 0.04 + (i / n) * (birch ? 0.3 : 0.12);
    const up = birch ? 0.9 + r() * 0.5 : 0.35 + r() * 0.4;
    grow(V(0.02, y, 0), V(Math.cos(a), up, Math.sin(a)), (birch ? 0.42 : 0.5) * (0.85 + r() * 0.3), birch ? 0.022 : 0.04, 3);
  }
  // the leader of a birch keeps going to the top
  if (birch) grow(V(0.02, trunkTop, 0), V(0.05, 1, 0.02), 0.45, 0.026, 3);
  for (const t of tips) spray(b, t.p.clone().sub(t.d.clone().multiplyScalar(0.06)), t.d.clone().add(V(0, birch ? -0.25 : 0.1, 0)), birch ? 0.26 : 0.3, birch ? 0.22 : 0.28, r() * 3.14, cc, 0.8, 0.35, 1.0);
  return finish(b);
}

export const birchDetail = (seed = 1) => broadleafDetail(seed, "birch");
export const oakDetail = (seed = 1) => broadleafDetail(seed, "oak");

/** The close-range models, in species order, two variants each. */
export const DETAIL_MODELS = [spruceDetail, pineDetail, birchDetail, oakDetail];

/** A cheap cone that stands in for any tree when the sun draws its shadow. */
export function shadowCone() {
  const g = new THREE.ConeGeometry(0.8, 0.85, 7, 1, false);
  g.translate(0, 0.575, 0);
  return g;
}

export const SPECIES_NAMES = ["spruce", "pine", "birch", "oak"] as const;
export const MODELS = [spruce, pine, birch, oak];
