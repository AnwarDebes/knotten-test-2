/**
 * A small toolkit for building the houses as plain triangle meshes: boxes with softened edges,
 * quads, cylinders, lathes and tubes, each with UVs in metres (so a plank or a tile has its real
 * size whatever it is drawn on) and an optional colour per part. Parts are built in their own frame
 * and placed with a matrix; a mirrored placement keeps faces turned outwards.
 *
 * One builder per material: everything that shares a material ends up in one draw call.
 */
import * as THREE from "three";

export type V3 = [number, number, number];

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

/** A growable list of numbers (cheaper than pushing into plain arrays for big meshes). */
class Buf {
  a: Float32Array;
  n = 0;
  constructor(cap = 1024) { this.a = new Float32Array(cap); }
  push3(x: number, y: number, z: number) {
    if (this.n + 3 > this.a.length) this.grow();
    this.a[this.n++] = x; this.a[this.n++] = y; this.a[this.n++] = z;
  }
  push2(x: number, y: number) {
    if (this.n + 2 > this.a.length) this.grow();
    this.a[this.n++] = x; this.a[this.n++] = y;
  }
  push1(x: number) {
    if (this.n + 1 > this.a.length) this.grow();
    this.a[this.n++] = x;
  }
  grow() { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; }
  view() { return this.a.subarray(0, this.n); }
}

export class Builder {
  pos = new Buf(); nrm = new Buf(); uv = new Buf(); col = new Buf();
  extra = new Map<string, { size: number; buf: Buf; value: number[] }>();
  idx: number[] = [];
  /** the placement of the next parts; set with at() */
  m = new THREE.Matrix4();
  nm = new THREE.Matrix3();
  flip = false;
  color = new THREE.Color(1, 1, 1);

  /** A per-vertex attribute every vertex gets (for example the house index), with its current value. */
  attr(name: string, value: number[]) {
    let e = this.extra.get(name);
    if (!e) {
      e = { size: value.length, buf: new Buf(), value };
      // vertices already in the builder get zeros
      for (let i = 0; i < this.count() * value.length; i++) e.buf.push1(0);
      this.extra.set(name, e);
    }
    e.value = value;
    return this;
  }
  count() { return this.pos.n / 3; }

  at(m: THREE.Matrix4) {
    this.m.copy(m);
    this.nm.getNormalMatrix(m);
    this.flip = m.determinant() < 0;
    return this;
  }
  tint(c: THREE.ColorRepresentation | THREE.Color) {
    if (c instanceof THREE.Color) this.color.copy(c); else this.color.set(c);
    return this;
  }

  private vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) {
    _v.set(x, y, z).applyMatrix4(this.m);
    _n.set(nx, ny, nz).applyMatrix3(this.nm).normalize();
    this.pos.push3(_v.x, _v.y, _v.z);
    this.nrm.push3(_n.x, _n.y, _n.z);
    this.uv.push2(u, v);
    this.col.push3(this.color.r, this.color.g, this.color.b);
    for (const e of this.extra.values()) for (const k of e.value) e.buf.push1(k);
    return this.count() - 1;
  }
  private tri(a: number, b: number, c: number) {
    if (this.flip) this.idx.push(a, c, b); else this.idx.push(a, b, c);
  }

  /**
   * A flat quad a b c d (counter-clockwise seen from the side it faces). UVs default to metres in
   * the quad's own plane, starting at a.
   */
  quad(a: V3, b: V3, c: V3, d: V3, uv?: [number, number][]) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _b.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    _c.crossVectors(_a, _b).normalize();
    let t: [number, number][];
    if (uv) t = uv;
    else {
      // metres along a->b and a->d
      const ax = _a.clone().normalize(), ay = _c.clone().cross(ax);
      const p = (q: V3) => { const w = new THREE.Vector3(q[0] - a[0], q[1] - a[1], q[2] - a[2]); return [w.dot(ax), w.dot(ay)] as [number, number]; };
      t = [p(a), p(b), p(c), p(d)];
    }
    const n = _c;
    const i0 = this.vert(a[0], a[1], a[2], n.x, n.y, n.z, t[0][0], t[0][1]);
    const i1 = this.vert(b[0], b[1], b[2], n.x, n.y, n.z, t[1][0], t[1][1]);
    const i2 = this.vert(c[0], c[1], c[2], n.x, n.y, n.z, t[2][0], t[2][1]);
    const i3 = this.vert(d[0], d[1], d[2], n.x, n.y, n.z, t[3][0], t[3][1]);
    this.tri(i0, i1, i2); this.tri(i0, i2, i3);
    return this;
  }

  /**
   * A flat quad cut into cells of about `cell` metres (floors, walls and ceilings carry their light
   * per vertex, so they need vertices to carry it). Corners counter-clockwise seen from the side it
   * faces; UVs in metres in its plane, starting at a.
   */
  grid(a: V3, b: V3, c: V3, d: V3, cell = 0.3) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _b.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const n = _c.crossVectors(_a, _b).normalize().clone();
    const lu = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), lv = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const nu = Math.max(1, Math.ceil(lu / cell)), nv = Math.max(1, Math.ceil(lv / cell));
    const ax = _a.clone().normalize(), ay = n.clone().cross(ax);
    const base = this.count();
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const s = i / nu, t = j / nv;
      // bilinear between the four corners
      const x = (1 - s) * (1 - t) * a[0] + s * (1 - t) * b[0] + s * t * c[0] + (1 - s) * t * d[0];
      const y = (1 - s) * (1 - t) * a[1] + s * (1 - t) * b[1] + s * t * c[1] + (1 - s) * t * d[1];
      const z = (1 - s) * (1 - t) * a[2] + s * (1 - t) * b[2] + s * t * c[2] + (1 - s) * t * d[2];
      const w = new THREE.Vector3(x - a[0], y - a[1], z - a[2]);
      this.vert(x, y, z, n.x, n.y, n.z, w.dot(ax), w.dot(ay));
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const p = base + j * (nu + 1) + i;
      this.tri(p, p + 1, p + nu + 2); this.tri(p, p + nu + 2, p + nu + 1);
    }
    return this;
  }

  /** A triangle (counter-clockwise seen from the side it faces), UVs in metres in its plane. */
  triangle(a: V3, b: V3, c: V3) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = _c.crossVectors(_a, _b).normalize().clone();
    const ax = _a.clone().normalize(), ay = n.clone().cross(ax);
    const p = (q: V3) => { const w = new THREE.Vector3(q[0] - a[0], q[1] - a[1], q[2] - a[2]); return [w.dot(ax), w.dot(ay)]; };
    const ta = p(a), tb = p(b), tc = p(c);
    const i0 = this.vert(a[0], a[1], a[2], n.x, n.y, n.z, ta[0], ta[1]);
    const i1 = this.vert(b[0], b[1], b[2], n.x, n.y, n.z, tb[0], tb[1]);
    const i2 = this.vert(c[0], c[1], c[2], n.x, n.y, n.z, tc[0], tc[1]);
    this.tri(i0, i1, i2);
    return this;
  }

  /**
   * An axis-aligned box from (x0,y0,z0) to (x1,y1,z1) in the current frame (here y is "up" only if
   * the frame says so: the house frame uses x = u, y = z (height), z = -v). `skip` leaves faces out
   * ("px","nx","py","ny","pz","nz") where they would never be seen.
   */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, skip: string[] = []) {
    const s = (k: string) => skip.includes(k);
    if (!s("px")) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [[z1, y0], [z0, y0], [z0, y1], [z1, y1]].map(([u, v]) => [-u, v]) as [number, number][]);
    if (!s("nx")) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]]);
    if (!s("py")) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [[x0, -z1], [x1, -z1], [x1, -z0], [x0, -z0]]);
    if (!s("ny")) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
    if (!s("pz")) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    if (!s("nz")) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [[-x1, y0], [-x0, y0], [-x0, y1], [-x1, y1]]);
    return this;
  }

  /**
   * A box with chamfered edges (cushions, mattresses, furniture fronts): reads as soft without the
   * cost of real rounding. `r` is the chamfer.
   */
  soft(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, skipBottom = true) {
    r = Math.min(r, (x1 - x0) / 2.01, (y1 - y0) / 2.01, (z1 - z0) / 2.01);
    // the six inset faces
    this.quad([x1, y0 + r, z1 - r], [x1, y0 + r, z0 + r], [x1, y1 - r, z0 + r], [x1, y1 - r, z1 - r]);
    this.quad([x0, y0 + r, z0 + r], [x0, y0 + r, z1 - r], [x0, y1 - r, z1 - r], [x0, y1 - r, z0 + r]);
    this.quad([x0 + r, y1, z1 - r], [x1 - r, y1, z1 - r], [x1 - r, y1, z0 + r], [x0 + r, y1, z0 + r]);
    if (!skipBottom) this.quad([x0 + r, y0, z0 + r], [x1 - r, y0, z0 + r], [x1 - r, y0, z1 - r], [x0 + r, y0, z1 - r]);
    this.quad([x0 + r, y0 + r, z1], [x1 - r, y0 + r, z1], [x1 - r, y1 - r, z1], [x0 + r, y1 - r, z1]);
    this.quad([x1 - r, y0 + r, z0], [x0 + r, y0 + r, z0], [x0 + r, y1 - r, z0], [x1 - r, y1 - r, z0]);
    // the twelve chamfers
    const P = (sx: number, sy: number, sz: number, ix: number, iy: number, iz: number): V3 => [sx > 0 ? x1 - ix * r : x0 + ix * r, sy > 0 ? y1 - iy * r : y0 + iy * r, sz > 0 ? z1 - iz * r : z0 + iz * r];
    for (const sy of [1, -1]) {
      if (sy < 0 && skipBottom) continue;
      for (const sx of [1, -1]) {
        // along z, between the x face and the y face
        const a = P(sx, sy, -1, 0, 1, 1), b = P(sx, sy, 1, 0, 1, 1), c = P(sx, sy, 1, 1, 0, 1), d = P(sx, sy, -1, 1, 0, 1);
        if (sx * sy > 0) this.quad(a, d, c, b); else this.quad(a, b, c, d);
      }
      for (const sz of [1, -1]) {
        const a = P(-1, sy, sz, 1, 1, 0), b = P(1, sy, sz, 1, 1, 0), c = P(1, sy, sz, 1, 0, 1), d = P(-1, sy, sz, 1, 0, 1);
        if (sz * sy > 0) this.quad(a, b, c, d); else this.quad(a, d, c, b);
      }
    }
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      // vertical chamfers
      const a = P(sx, -1, sz, 0, skipBottom ? 0 : 1, 1), b = P(sx, 1, sz, 0, 1, 1), c = P(sx, 1, sz, 1, 1, 0), d = P(sx, -1, sz, 1, skipBottom ? 0 : 1, 0);
      if (sx * sz > 0) this.quad(a, b, c, d); else this.quad(a, d, c, b);
    }
    // corners
    for (const sy of [1, -1]) {
      if (sy < 0 && skipBottom) continue;
      for (const sx of [1, -1]) for (const sz of [1, -1]) {
        const a = P(sx, sy, sz, 0, 1, 1), b = P(sx, sy, sz, 1, 0, 1), c = P(sx, sy, sz, 1, 1, 0);
        if (sx * sy * sz > 0) this.triangle(a, b, c); else this.triangle(a, c, b);
      }
    }
    if (skipBottom) {
      // close the band of chamfers down to the bottom edge
      this.quad([x1, y0, z1 - r], [x1, y0, z0 + r], [x1, y0 + r, z0 + r], [x1, y0 + r, z1 - r]);
      this.quad([x0, y0, z0 + r], [x0, y0, z1 - r], [x0, y0 + r, z1 - r], [x0, y0 + r, z0 + r]);
      this.quad([x0 + r, y0, z1], [x1 - r, y0, z1], [x1 - r, y0 + r, z1], [x0 + r, y0 + r, z1]);
      this.quad([x1 - r, y0, z0], [x0 + r, y0, z0], [x0 + r, y0 + r, z0], [x1 - r, y0 + r, z0]);
    }
    return this;
  }

  /** A cylinder along y from y0 to y1 at (cx, cz). */
  cyl(cx: number, cz: number, r: number, y0: number, y1: number, seg = 12, caps = true, r1 = r) {
    const base = this.count();
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const slope = (r - r1) / Math.max(1e-6, y1 - y0);
      const nl = Math.hypot(1, slope);
      this.vert(cx + c * r, y0, cz + s * r, c / nl, slope / nl, s / nl, (i / seg) * Math.PI * 2 * r, y0);
      this.vert(cx + c * r1, y1, cz + s * r1, c / nl, slope / nl, s / nl, (i / seg) * Math.PI * 2 * r, y1);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      this.tri(a, a + 1, a + 3); this.tri(a, a + 3, a + 2);
    }
    if (caps) { this.disk(cx, y1, cz, r1, 1, seg); this.disk(cx, y0, cz, r, -1, seg); }
    return this;
  }

  /** A flat disc facing up (dir 1) or down (dir -1). */
  disk(cx: number, y: number, cz: number, r: number, dir: 1 | -1, seg = 12, r0 = 0) {
    const base = this.count();
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      this.vert(cx + c * r, y, cz + s * r, 0, dir, 0, cx + c * r, cz + s * r);
      this.vert(cx + c * r0, y, cz + s * r0, 0, dir, 0, cx + c * r0, cz + s * r0);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      if (dir > 0) { this.tri(a, a + 1, a + 3); this.tri(a, a + 3, a + 2); }
      else { this.tri(a, a + 3, a + 1); this.tri(a, a + 2, a + 3); }
    }
    return this;
  }

  /** A disc standing upright in the x-y plane at depth z, facing -z (dir -1, the front) or +z (dir 1). */
  fdisk(cx: number, cy: number, z: number, r: number, dir: 1 | -1, seg = 16, r0 = 0) {
    const base = this.count();
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      this.vert(cx + c * r, cy + s * r, z, 0, 0, dir, 0.5 + 0.5 * c, 0.5 + 0.5 * s);
      this.vert(cx + c * r0, cy + s * r0, z, 0, 0, dir, 0.5 + 0.5 * c * (r0 / r), 0.5 + 0.5 * s * (r0 / r));
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      if (dir > 0) { this.tri(a, a + 3, a + 1); this.tri(a, a + 2, a + 3); }
      else { this.tri(a, a + 1, a + 3); this.tri(a, a + 3, a + 2); }
    }
    return this;
  }

  /** A front-facing (-z) rectangle with UVs given for its corners (screens drawn from a texture atlas). */
  panel(x0: number, y0: number, x1: number, y1: number, z: number, uv: [number, number, number, number]) {
    const [u0, v0, u1, v1] = uv;
    // seen from the front (-z), +x is on the viewer's left: the texture runs from x1 to x0
    return this.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  }

  /** A surface of revolution about y through (cx, cz): profile points [radius, height] from bottom to top. */
  lathe(cx: number, cz: number, profile: [number, number][], seg = 16) {
    const base = this.count();
    const n = profile.length;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let k = 0; k < n; k++) {
        const [r, y] = profile[k];
        const p = profile[Math.max(0, k - 1)], q = profile[Math.min(n - 1, k + 1)];
        const dr = q[0] - p[0], dy = q[1] - p[1];
        const l = Math.hypot(dr, dy) || 1;
        // outward normal of the profile, turned about y
        this.vert(cx + c * r, y, cz + s * r, (c * dy) / l, -dr / l, (s * dy) / l, i / seg, y);
      }
    }
    for (let i = 0; i < seg; i++) for (let k = 0; k < n - 1; k++) {
      const a = base + i * n + k, b = a + n;
      this.tri(a, b + 1, b); this.tri(a, a + 1, b + 1);
    }
    return this;
  }

  /** A round bar between two points (pipes, rails, legs, rods). */
  tube(a: V3, b: V3, r: number, seg = 8) {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    if (len < 1e-6) return this;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...a), q, new THREE.Vector3(1, 1, 1));
    const saved = this.m.clone();
    this.at(saved.clone().multiply(local));
    this.cyl(0, 0, r, 0, len, seg, true);
    this.at(saved);
    return this;
  }

  /** The finished geometry (null when nothing was added). */
  geometry(): THREE.BufferGeometry | null {
    if (this.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos.view().slice(), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nrm.view().slice(), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(this.uv.view().slice(), 2));
    g.setAttribute("color", new THREE.BufferAttribute(this.col.view().slice(), 3));
    for (const [name, e] of this.extra) g.setAttribute(name, new THREE.BufferAttribute(e.buf.view().slice(), e.size));
    g.setIndex(this.count() > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** One builder per material key, created on first use. */
export class Builders {
  map = new Map<string, Builder>();
  private m = new THREE.Matrix4();
  private attrs = new Map<string, number[]>();
  get(key: string) {
    let b = this.map.get(key);
    if (!b) {
      b = new Builder();
      for (const [k, v] of this.attrs) b.attr(k, v);
      b.at(this.m);
      this.map.set(key, b);
    }
    return b;
  }
  /** Same placement for every builder, now and for builders made later. */
  at(m: THREE.Matrix4) { this.m.copy(m); for (const b of this.map.values()) b.at(m); return this; }
  /** Same per-vertex attribute value for every builder. */
  attr(name: string, value: number[]) { this.attrs.set(name, value); for (const b of this.map.values()) b.attr(name, value); return this; }
  geometries() {
    const out: Record<string, THREE.BufferGeometry> = {};
    for (const [k, b] of this.map) { const g = b.geometry(); if (g) out[k] = g; }
    return out;
  }
}
