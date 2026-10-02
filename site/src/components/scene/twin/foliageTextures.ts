/**
 * Foliage cards, painted in the browser (no downloads): a spruce frond, pine needle tufts, birch
 * leaves on twigs and oak leaves on twigs. Channels are data, not colour:
 *   R  shading (0..1, multiplied with the season's colour)
 *   B  0 for twigs; for leaves a random 0.05..1 per leaf, so leaves can be dropped one by one in autumn
 *   A  coverage
 */
import * as THREE from "three";

const SIZE = 256;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function surface() {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, SIZE, SIZE);
  g.lineCap = "round";
  return { c, g };
}

const col = (shade: number, id: number) => `rgb(${Math.round(shade * 255)},0,${Math.round(id * 255)})`;

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** A spruce branch seen from above: a stem with side shoots, densely needled. Branch points up (v = 1). */
export function spruceFrond(seed = 3) {
  const { c, g } = surface();
  const r = rng(seed);
  const stem = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    g.strokeStyle = col(0.42, 1); g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  };
  const needles = (x0: number, y0: number, x1: number, y1: number, len: number) => {
    const n = Math.hypot(x1 - x0, y1 - y0) / 2.2;
    const a = Math.atan2(y1 - y0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const side of [-1, 1]) {
        const b = a + side * (1.05 + r() * 0.35);
        const l = len * (0.75 + r() * 0.4) * (1 - 0.35 * t);
        g.strokeStyle = col(0.62 + r() * 0.38, 1); g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l); g.stroke();
      }
    }
  };
  const cx = SIZE / 2;
  stem(cx, SIZE - 2, cx + 6, 8, 3);
  needles(cx, SIZE - 2, cx + 6, 8, 10);
  for (let i = 0; i < 9; i++) {
    const t = 0.1 + i * 0.09;
    const y = SIZE - t * SIZE;
    const L = SIZE * 0.42 * (1 - t * 0.75);
    for (const side of [-1, 1]) {
      const x1 = cx + side * L, y1 = y - L * 0.55;
      stem(cx, y, x1, y1, 1.6);
      needles(cx, y, x1, y1, 8);
    }
  }
  return texture(c);
}

/** Scots pine: a few twigs ending in tufts of long needles. */
export function pineTufts(seed = 5) {
  const { c, g } = surface();
  const r = rng(seed);
  const tuft = (x: number, y: number, s: number) => {
    for (let i = 0; i < 46; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
      const l = s * (0.6 + r() * 0.5);
      g.strokeStyle = col(0.55 + r() * 0.45, 1); g.lineWidth = 1.7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  };
  g.strokeStyle = col(0.38, 1); g.lineWidth = 3;
  const pts: [number, number][] = [[128, 250], [128, 150], [70, 110], [186, 96], [104, 52], [160, 40]];
  g.beginPath(); g.moveTo(128, 255); g.lineTo(128, 150); g.lineTo(70, 110); g.moveTo(128, 150); g.lineTo(186, 96); g.moveTo(128, 150); g.lineTo(104, 52); g.moveTo(128, 150); g.lineTo(160, 40); g.stroke();
  for (const [x, y] of pts.slice(1)) tuft(x, y, 46);
  tuft(128, 170, 40);
  return texture(c);
}

/**
 * A Scots pine shoot seen from the side, for the close-range trees: a twig with paired needles all
 * round it (a bottle brush), two side shoots, needles longest near the tip. Base at the bottom.
 */
export function pineShoot(seed = 7) {
  const { c, g } = surface();
  const r = rng(seed);
  const shoots: [number, number, number, number][] = [[128, 254, 122 + r() * 12, 26], [126, 168, 62, 70], [127, 140, 194, 58]];
  for (const [x0, y0, x1, y1] of shoots) {
    g.strokeStyle = col(0.36, 0); g.lineWidth = 3;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const a0 = Math.atan2(y1 - y0, x1 - x0);
    const n = Math.hypot(x1 - x0, y1 - y0) / 2.6;
    for (let i = 0; i < n; i++) {
      const t = 0.22 + 0.78 * (i / n);
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const side of [-1, 1]) {
        const a = a0 + side * (0.45 + r() * 0.65);
        const L = (18 + r() * 14) * (0.75 + 0.35 * t);
        g.strokeStyle = col(0.5 + r() * 0.5, 1); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
      }
    }
  }
  return texture(c);
}

/** Broadleaf twigs with leaves: birch (small, pointed) or oak (larger, lobed). */
export function broadleaf(kind: "birch" | "oak", seed = 9) {
  const { c, g } = surface();
  const r = rng(seed);
  const twigs: [number, number][] = [];
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    g.strokeStyle = col(0.5, 0); g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
    twigs.push([x1, y1]);
    if (depth > 0) {
      const n = 2 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) branch(x1, y1, a + (r() - 0.5) * 1.5, len * (0.6 + r() * 0.15), Math.max(0.8, w * 0.65), depth - 1);
    }
  };
  branch(128, 254, -Math.PI / 2 + (r() - 0.5) * 0.3, 78, 3.2, 4);
  const leaf = (x: number, y: number) => {
    const a = r() * Math.PI * 2;
    const L = kind === "birch" ? 6 + r() * 3 : 8 + r() * 4;
    const W = kind === "birch" ? L * 0.62 : L * 0.7;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = col(0.55 + r() * 0.45, 0.05 + r() * 0.95);
    g.beginPath();
    if (kind === "birch") {
      g.moveTo(0, -L); g.quadraticCurveTo(W, 0, 0, L * 0.6); g.quadraticCurveTo(-W, 0, 0, -L);
    } else {
      for (let k = 0; k <= 10; k++) {
        const t = (k / 10) * Math.PI * 2;
        const lobe = 1 + 0.22 * Math.sin(t * 4);
        g.lineTo(Math.cos(t) * W * lobe, Math.sin(t) * L * lobe);
      }
    }
    g.fill(); g.restore();
  };
  for (const [x, y] of twigs) {
    const n = kind === "birch" ? 9 : 7;
    for (let i = 0; i < n; i++) leaf(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30);
  }
  return texture(c);
}

export type FoliageSet = THREE.Texture[];

/** One texture per species, in species order (spruce, pine, birch, oak). */
export function foliageTextures(): FoliageSet {
  return [spruceFrond(), pineTufts(), broadleaf("birch"), broadleaf("oak")];
}

/** The close-range trees' textures: the same, but a pine shoot instead of the tuft fan. */
export function closeFoliageTextures(base: FoliageSet): FoliageSet {
  return [base[0], pineShoot(), base[2], base[3]];
}
