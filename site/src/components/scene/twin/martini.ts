/**
 * RTIN terrain meshing (right-triangulated irregular network), after the algorithm in Mapbox's
 * MARTINI. A height grid of (2^k + 1)^2 posts becomes a mesh that stays within `maxError` metres of
 * the grid, with big triangles on flat ground and water and small ones on slopes and shores.
 *
 * Two additions for nested rings: `forced` posts are always kept as vertices (ring edges, so
 * neighbouring rings meet post to post), and triangles inside a hole can be dropped.
 */
export class Martini {
  readonly gridSize: number;
  readonly numTriangles: number;
  readonly numParentTriangles: number;
  readonly coords: Uint16Array;

  constructor(gridSize: number) {
    const tileSize = gridSize - 1;
    if (tileSize & (tileSize - 1)) throw new Error(`grid size must be 2^k + 1, got ${gridSize}`);
    this.gridSize = gridSize;
    this.numTriangles = tileSize * tileSize * 2 - 2;
    this.numParentTriangles = this.numTriangles - tileSize * tileSize;
    this.coords = new Uint16Array(this.numTriangles * 4);
    for (let i = 0; i < this.numTriangles; i++) {
      let id = i + 2;
      let ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0;
      if (id & 1) { bx = by = cx = tileSize; } else { ax = ay = cy = tileSize; }
      while ((id >>= 1) > 1) {
        const mx = (ax + bx) >> 1;
        const my = (ay + by) >> 1;
        if (id & 1) { bx = ax; by = ay; ax = cx; ay = cy; } else { ax = bx; ay = by; bx = cx; by = cy; }
        cx = mx; cy = my;
      }
      const k = i * 4;
      this.coords[k] = ax; this.coords[k + 1] = ay; this.coords[k + 2] = bx; this.coords[k + 3] = by;
    }
  }

  /** Error per post: how far the surface is from the mesh if that post is dropped. */
  errors(terrain: Float32Array, forced?: (x: number, y: number) => boolean): Float32Array {
    const size = this.gridSize;
    const errors = new Float32Array(size * size);
    if (forced) {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (forced(x, y)) errors[y * size + x] = Infinity;
    }
    const { coords, numTriangles, numParentTriangles } = this;
    for (let i = numTriangles - 1; i >= 0; i--) {
      const k = i * 4;
      const ax = coords[k], ay = coords[k + 1], bx = coords[k + 2], by = coords[k + 3];
      const mx = (ax + bx) >> 1, my = (ay + by) >> 1;
      const cx = mx + my - ay, cy = my + ax - mx;
      const interpolated = (terrain[ay * size + ax] + terrain[by * size + bx]) / 2;
      const middle = my * size + mx;
      const e = Math.abs(interpolated - terrain[middle]);
      if (e > errors[middle]) errors[middle] = e;
      if (i < numParentTriangles) {
        const left = ((ay + cy) >> 1) * size + ((ax + cx) >> 1);
        const right = ((by + cy) >> 1) * size + ((bx + cx) >> 1);
        const m = Math.max(errors[left], errors[right]);
        if (m > errors[middle]) errors[middle] = m;
      }
    }
    return errors;
  }

  /** Mesh as grid coordinates (x, y per vertex) and triangle indices. */
  mesh(errors: Float32Array, maxError: number, drop?: (cx: number, cy: number) => boolean) {
    const size = this.gridSize;
    const max = size - 1;
    const indices = new Uint32Array(size * size);
    let numVertices = 0;
    let numTriangles = 0;
    const keep = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
      !drop || !drop((ax + bx + cx) / 3, (ay + by + cy) / 3);
    const count = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
      const mx = (ax + bx) >> 1, my = (ay + by) >> 1;
      if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && errors[my * size + mx] > maxError) {
        count(cx, cy, ax, ay, mx, my);
        count(bx, by, cx, cy, mx, my);
      } else if (keep(ax, ay, bx, by, cx, cy)) {
        if (!indices[ay * size + ax]) indices[ay * size + ax] = ++numVertices;
        if (!indices[by * size + bx]) indices[by * size + bx] = ++numVertices;
        if (!indices[cy * size + cx]) indices[cy * size + cx] = ++numVertices;
        numTriangles++;
      }
    };
    count(0, 0, max, max, max, 0);
    count(max, max, 0, 0, 0, max);
    const vertices = new Uint16Array(numVertices * 2);
    const triangles = new Uint32Array(numTriangles * 3);
    let t = 0;
    const emit = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
      const mx = (ax + bx) >> 1, my = (ay + by) >> 1;
      if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && errors[my * size + mx] > maxError) {
        emit(cx, cy, ax, ay, mx, my);
        emit(bx, by, cx, cy, mx, my);
      } else if (keep(ax, ay, bx, by, cx, cy)) {
        const a = indices[ay * size + ax] - 1, b = indices[by * size + bx] - 1, c = indices[cy * size + cx] - 1;
        vertices[2 * a] = ax; vertices[2 * a + 1] = ay;
        vertices[2 * b] = bx; vertices[2 * b + 1] = by;
        vertices[2 * c] = cx; vertices[2 * c + 1] = cy;
        triangles[t++] = a; triangles[t++] = b; triangles[t++] = c;
      }
    };
    emit(0, 0, max, max, max, 0);
    emit(max, max, 0, 0, 0, max);
    return { vertices, triangles };
  }
}
