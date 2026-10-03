"use client";
import { forwardRef, use, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { DETAIL_MODELS, MODELS, shadowCone } from "./treeModels";
import { closeFoliageTextures, foliageTextures } from "./foliageTextures";
import { bakeAtlas, cardGeometry, cardMaterial, createAtlas } from "./impostor";
import { season as seasonFor, type Season } from "./season";
import { TREE_AERIAL_GLSL, treeAerial, twinUniforms } from "./materials";
import { markShadowsDirty } from "./shadowState";
import { loadTwin, TWIN_BASE } from "./twinData";

type Grid = { half: number; cell: number; n: number; starts: number[] };
type Trees = {
  n: number; kept: number;
  x: Float32Array; y: Float32Array; z: Float32Array;     // three.js axes: x east, y ground height, z south
  h: Float32Array; crown: Float32Array; rot: Float32Array; tint: Float32Array;
  sp: Uint8Array; cleared: Uint8Array; grid: Grid;
};

let cached: Promise<Trees> | null = null;
function loadTrees(): Promise<Trees> {
  if (!cached) cached = (async () => {
    const [meta, buf] = await Promise.all([
      fetch(TWIN_BASE + "trees.json").then((r) => r.json()),
      fetch(TWIN_BASE + "trees.bin").then((r) => r.arrayBuffer()),
    ]);
    const n = buf.byteLength / 10;
    const dv = new DataView(buf);
    const t: Trees = {
      n, kept: meta.kept, grid: meta.grid,
      x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
      h: new Float32Array(n), crown: new Float32Array(n), rot: new Float32Array(n), tint: new Float32Array(n),
      sp: new Uint8Array(n), cleared: new Uint8Array(n),
    };
    for (let i = 0, o = 0; i < n; i++, o += 10) {
      t.x[i] = dv.getInt16(o, true) / 20;
      t.z[i] = -dv.getInt16(o + 2, true) / 20;
      t.y[i] = dv.getUint16(o + 4, true) / 100;
      t.h[i] = dv.getUint8(o + 6) * 0.15;
      t.crown[i] = dv.getUint8(o + 7) * 0.04;
      const code = dv.getUint8(o + 8);
      t.sp[i] = code & 3;
      t.cleared[i] = (code >> 2) & 1;
      t.tint[i] = (code >> 3) / 31;
      t.rot[i] = (dv.getUint8(o + 9) / 256) * Math.PI * 2;
    }
    return t;
  })().catch((e) => { cached = null; throw e; });
  return cached;
}

/** Leaf colour, twig colour and leaf density for each species on a day of the year. */
export function foliage(s: Season) {
  const c = (hex: string) => new THREE.Color(hex);
  const conifer = 1 - 0.12 * s.winter;
  // a bare broadleaf crown reads as a purple-grey haze of fine twigs: drawn with the leaf cards,
  // thinned and in twig colour, so a winter wood looks like the owner's photo and not like sticks
  const twigBirch = c("#58504f"), twigOak = c("#514945");
  const birchLeaf = c("#5f8238").lerp(c("#cfa63a"), s.birch.turn);
  const oakLeaf = c("#4a672b").lerp(c("#9c6b2c"), s.oak.turn);
  const bl = s.birch.leaf, ol = s.oak.leaf;
  const birch = twigBirch.clone().lerp(birchLeaf, Math.min(1, bl * 1.6));
  // oaks keep a few dry brown leaves into the winter; a mature oak crown is still mostly bare twigs
  const oak = c("#5e5250").lerp(oakLeaf, Math.min(1, Math.max(0, ol - 0.08) * 1.8));
  return {
    leaf: [c("#25372a").multiplyScalar(conifer), c("#33492c").multiplyScalar(conifer), birch, oak],
    twig: [c("#4a3b30"), c("#4a3b30"), twigBirch, twigOak],
    density: [1, 1, 0.36 + 0.64 * bl, 0.34 + 0.66 * ol],
    // up close the real thing: bare twigs in winter, a few dry leaves left on the oaks
    closeDensity: [1, 1, bl, Math.max(ol, 0.08)],
  };
}

/**
 * Foliage cards: the leaf colour of the aerial photo at the tree (or the season's, for bare and
 * turning broadleaf crowns) on the painted shading, leaves dropped one by one as density falls.
 */
export function foliageMaterial(map: THREE.Texture, key: string, species: number) {
  // plain alpha test: alpha-to-coverage let the background through as bright speckles on some GPUs (ANGLE/D3D11)
  const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, side: THREE.DoubleSide, alphaTest: 0.45, roughness: 1, envMapIntensity: 0.8 });
  const u = { uLeafColor: { value: new THREE.Color() }, uTwigColor: { value: new THREE.Color() }, uDensity: { value: 1 }, uSpecies: { value: species } };
  m.userData.foliage = u;
  // every leaf material compiles to the same program (species, colours and textures are uniforms): one key, one
  // compile instead of eight; each material keeps its own uniforms (`key` stays for the callers' names)
  void key;
  withWind(m, "leaf");
  const wind = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    wind.call(m, shader, r);
    Object.assign(shader.uniforms, u, treeAerial);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${TREE_AERIAL_GLSL}\nuniform float uSpecies;\nvarying vec3 vAerial;\nvarying float vAerialW;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 aerialRaw = twinAerialAt(vec2(instanceMatrix[3].x, -instanceMatrix[3].z)) * uAerialGain;
vAerialW = twinAerialWeight(uSpecies) * twinAerialTrust(aerialRaw);
vAerial = twinAerialFit(aerialRaw, uSpecies);
#else
vAerial = vec3(0.0);
vAerialW = 0.0;
#endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uLeafColor;\nuniform vec3 uTwigColor;\nuniform float uDensity;\nvarying vec3 vAerial;\nvarying float vAerialW;")
      .replace("#include <map_fragment>", `
vec4 fol = texture2D(map, vMapUv);
float twig = 1.0 - step(0.03, fol.b);
if (twig < 0.5 && fol.b > uDensity + 0.001) fol.a = 0.0;
vec3 leafC = mix(uLeafColor, vAerial, vAerialW);
diffuseColor.rgb = mix(leafC, uTwigColor, twig) * (0.35 + 0.75 * fol.r);
diffuseColor.a = fol.a;`)
      .replace("#include <normal_fragment_begin>", THREE.ShaderChunk.normal_fragment_begin.replace("normal *= faceDirection;", ""))
      // a card stands for many needles or leaves at all angles: no mirror-like sheen at grazing angles
      // (seen from behind, its normal points away and the Fresnel term would reflect the whole sky)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.indirectSpecular *= 0.12;\nreflectedLight.directSpecular *= 0.3;");
  };
  return m;
}

/** A little wind in the crowns: the higher on the tree, the more it moves. */
function withWind(m: THREE.MeshStandardMaterial, key: string) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = twinUniforms.uTime;
    shader.uniforms.uWind = twinUniforms.uWind;
    shader.uniforms.uClear = twinUniforms.uClear;
    shader.uniforms.uClearOn = twinUniforms.uClearOn;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWind;\nuniform vec4 uClear;\nuniform float uClearOn;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
// trees standing where a scenario builds (the shared plant) are taken away
vec2 treeAt = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
if (uClearOn > 0.5 && treeAt.x > uClear.x && treeAt.x < uClear.z && treeAt.y > uClear.y && treeAt.y < uClear.w) transformed = vec3(0.0, -1e4, 0.0);
float swayH = max(0.0, position.y - 0.25);
vec2 ph = vec2(instanceMatrix[3].x, instanceMatrix[3].z) * 0.07;
float gust = clamp(uWind / 8.0, 0.1, 1.5);
float sw = (sin(uTime * 1.25 + ph.x + ph.y) * 0.016 + sin(uTime * 2.9 + ph.x * 1.7) * 0.006) * gust;
transformed.xz += vec2(sw, sw * 0.55) * swayH * swayH;
#endif`);
  };
  m.customProgramCacheKey = () => `twin-tree-${key}`;
  return m;
}

const near0 = new THREE.Vector3(1e9, 1e9, 1e9);

/**
 * How far out the detailed trees reach, as a share of the usual 70 m, and the 3D trees, as a share of
 * the usual 260 m, beyond which painted cards stand in (the walk lowers both: indoors the forest is seen
 * only through the windows).
 */
export const forestDetail = { scale: 1, near: 1 };

/**
 * The 3D trees drawn are the ones the camera can see (see TwinForest). A render with another camera or another
 * shape of picture (the debug stills) asks for the trees of that view first with `run`, and for the live view's
 * again afterwards with `dirty`.
 */
export const forestCull: { run: ((cam: THREE.Camera) => void) | null; dirty: () => void } = { run: null, dirty: () => {} };

/**
 * The forest: 3D trees near the camera, painted cards further out, and the trees the plan clears
 * in their own group (exposed through `ref`, so the renderer can show them only in "today").
 */
export const TwinForest = forwardRef<THREE.Group, { month: number; day?: number; quality?: "full" | "lite"; shadows: boolean }>(function TwinForest({ month, day = 21, quality = "full", shadows }, clearedRef) {
  const trees = use(loadTrees());
  const twin = use(loadTwin());
  const { gl, camera } = useThree();
  const nearR = quality === "full" ? 260 : 150;
  const closeR = quality === "full" ? 70 : 0;   // detailed trees this close to the camera
  const s = useMemo(() => seasonFor(month, day), [month, day]);
  const fol = useMemo(() => foliage(s), [s]);
  const tex = useMemo(() => foliageTextures(), []);

  const geoms = useMemo(() => MODELS.map((f, k) => f(7 + k * 13)), []);
  const wood = useMemo(() => withWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.5 }), "wood"), []);
  const leaves = useMemo(() => tex.map((t, k) => foliageMaterial(t, `leaf${k}`, k)), [tex]);
  // close trees have their own foliage: a pine shoot texture, and broadleaf crowns that are bare twigs
  // in winter (further away a few leaves stay on as a stand-in for the haze of twigs)
  const closeLeaves = useMemo(() => closeFoliageTextures(tex).map((t, k) => foliageMaterial(t, `leafc${k}`, k)), [tex]);

  // the aerial photos the trees take their leaf colour from (innermost ring, then the next)
  useEffect(() => {
    const [r0, r1] = twin.rings;
    treeAerial.uAerial0.value = r0.aerial;
    treeAerial.uAerial1.value = r1.aerial;
    treeAerial.uAerialHalf.value.set(r0.desc.tex_half, r1.desc.tex_half);
  }, [twin]);

  // season: leaf colour and density (a bare birch is its purple-brown twigs), and the ground
  useEffect(() => {
    // the photo is a summer picture: broadleaf crowns take its colour only while in full green leaf
    treeAerial.uAerialMix.value.set(1, 1, s.birch.leaf * (1 - s.birch.turn), s.oak.leaf * (1 - s.oak.turn));
    twinUniforms.uWinter.value = s.winter;
    twinUniforms.uAutumn.value = s.autumn;
    leaves.forEach((m, k) => {
      const u = m.userData.foliage;
      u.uLeafColor.value.copy(fol.leaf[k]);
      u.uTwigColor.value.copy(fol.twig[k]);
      u.uDensity.value = fol.density[k];
    });
    closeLeaves.forEach((m, k) => {
      const u = m.userData.foliage;
      u.uLeafColor.value.copy(fol.leaf[k]);
      u.uTwigColor.value.copy(fol.twig[k]);
      u.uDensity.value = fol.closeDensity[k];
    });
  }, [fol, leaves, closeLeaves, s]);

  // near trees: one instanced mesh per species, refilled when the camera moves
  const near = useMemo(() => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < trees.kept; i++) counts[trees.sp[i]]++;
    return geoms.map((g, k) => {
      const m = new THREE.InstancedMesh(g, [wood, leaves[k]], Math.max(1, Math.min(counts[k], 42000)));
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3), 3);
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = shadows;
      return m;
    });
  }, [trees, geoms, wood, leaves, shadows]);

  // close trees: the detailed models, two variants per species (index species * 2 + variant)
  const detail = useMemo(() => DETAIL_MODELS.flatMap((f, k) => [f(11 + k * 17), f(29 + k * 17)]), []);
  const close = useMemo(() => detail.map((g, j) => {
    const m = new THREE.InstancedMesh(g, [wood, closeLeaves[j >> 1]], 1200);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = shadows;
    return m;
  }), [detail, wood, closeLeaves, shadows]);

  // The near and the close trees are refilled as the camera moves (every 12 m): those are the trees within reach,
  // nearest first. Of those, only the trees the camera can see are drawn: a tree whose bounding sphere lies wholly
  // outside the view would draw nothing anyway, but its thousands of vertices (wind, the photo's colour) were still
  // worked out each frame, half or more of the forest's cost on the ground. The test is generous (a bigger sphere,
  // room for the wind), and is made again whenever the camera has turned 2 degrees or moved a metre, so a tree at
  // the edge of the picture is never left out. Trees cast no shadows here (the stand-ins below do), so nothing else
  // depends on the trees that are not drawn.
  const cand = useMemo(() => ({
    near: near.map((m) => ({ idx: new Int32Array(m.instanceMatrix.count), n: 0 })),
    close: close.map((m) => ({ idx: new Int32Array(m.instanceMatrix.count), n: 0 })),
  }), [near, close]);
  const bounds = useMemo(() => ({ near: geoms.map(boundsOf), close: detail.map(boundsOf) }), [geoms, detail]);
  const culled = useRef({ pos: new THREE.Vector3(1e9, 1e9, 1e9), quat: new THREE.Quaternion(), proj: new THREE.Matrix4(), dirty: true });
  const cullFor = useMemo(() => (cam: THREE.Camera) => {
    cam.updateMatrixWorld();
    _vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_vp);
    const eye = _eye.setFromMatrixPosition(cam.matrixWorld);
    fillVisible(near, cand.near, bounds.near, trees, eye);
    fillVisible(close, cand.close, bounds.close, trees, eye);
  }, [near, close, cand, bounds, trees]);
  useEffect(() => {
    forestCull.run = cullFor;
    forestCull.dirty = () => { culled.current.dirty = true; };
    return () => { forestCull.run = null; forestCull.dirty = () => {}; };
  }, [cullFor]);
  // after the camera has been moved this frame, before the frame is drawn (the render runs at priority 1)
  useFrame(() => {
    const c = culled.current;
    const turned = c.quat.angleTo(camera.quaternion) > CULL_TURN;
    const moved = c.pos.distanceToSquared(camera.position) > CULL_MOVE * CULL_MOVE;
    const reshaped = !c.proj.equals(camera.projectionMatrix);
    if (!c.dirty && !turned && !moved && !reshaped) return;
    c.dirty = false;
    c.pos.copy(camera.position);
    c.quat.copy(camera.quaternion);
    c.proj.copy(camera.projectionMatrix);
    cullFor(camera);
  }, 0.5);

  // the cleared trees: few, always 3D
  const cleared = useMemo(() => {
    const idx: number[][] = [[], [], [], []];
    for (let i = trees.kept; i < trees.n; i++) idx[trees.sp[i]].push(i);
    const meshes = geoms.map((g, k) => {
      const m = new THREE.InstancedMesh(g, [wood, leaves[k]], Math.max(1, idx[k].length));
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3), 3);
      idx[k].forEach((i, j) => writeTree(m, j, trees, i));
      m.count = idx[k].length;
      m.receiveShadow = shadows;
      m.computeBoundingSphere();
      return m;
    });
    const all = idx.flat();
    const proxy = new THREE.InstancedMesh(shadowCone(), new THREE.MeshBasicMaterial(), Math.max(1, all.length));
    all.forEach((i, j) => writeTree(proxy, j, trees, i));
    proxy.castShadow = true;
    proxy.layers.set(1);
    proxy.computeBoundingSphere();
    return { meshes, proxy };
  }, [trees, geoms, wood, leaves, shadows]);

  // shadow stand-ins for the kept trees near the field (the shadow camera covers +-1050 m)
  const proxies = useMemo(() => {
    const pick = (broad: boolean) => {
      const out: number[] = [];
      for (let i = 0; i < trees.kept; i++) {
        if ((trees.sp[i] >= 2) !== broad) continue;
        if (Math.abs(trees.x[i] - 60) < 1100 && Math.abs(trees.z[i]) < 1100) out.push(i);
      }
      const m = new THREE.InstancedMesh(shadowCone(), new THREE.MeshBasicMaterial(), Math.max(1, out.length));
      out.forEach((i, j) => writeTree(m, j, trees, i));
      m.count = out.length;
      m.castShadow = true;
      m.layers.set(1);
      m.computeBoundingSphere();
      return m;
    };
    return { conifer: pick(false), broad: pick(true) };
  }, [trees]);
  useEffect(() => {
    proxies.broad.visible = fol.density[2] > 0.5;
    markShadowsDirty();
  }, [fol, proxies]);

  // far trees: painted cards, re-painted when the season changes (painting is a side effect, so it
  // happens in an effect: in development React runs memos twice and keeps only one result)
  const atlas = useMemo(() => createAtlas(), []);
  const cardU = useMemo(() => ({ uNear: { value: nearR }, uTime: twinUniforms.uTime, uClear: twinUniforms.uClear, uClearOn: twinUniforms.uClearOn }), [nearR]);
  const cards = useMemo(() => {
    const k = trees.kept;
    const pos = new Float32Array(k * 3), dim = new Float32Array(k * 2), info = new Float32Array(k * 4);
    for (let i = 0; i < k; i++) {
      pos[3 * i] = trees.x[i]; pos[3 * i + 1] = trees.y[i]; pos[3 * i + 2] = trees.z[i];
      dim[2 * i] = trees.h[i]; dim[2 * i + 1] = trees.crown[i];
      info[4 * i] = trees.sp[i]; info[4 * i + 1] = trees.tint[i]; info[4 * i + 2] = trees.rot[i];
    }
    return cardGeometry(k, pos, dim, info);
  }, [trees]);
  const cardMat = useMemo(() => cardMaterial(atlas, cardU), [atlas, cardU]);
  useLayoutEffect(() => {
    bakeAtlas(gl, geoms, tex, fol, atlas);
  }, [gl, geoms, tex, fol, atlas]);
  useEffect(() => () => { atlas.albedo.dispose(); atlas.normal.dispose(); }, [atlas]);

  // refill the near trees when the camera has moved 12 m
  const last = useRef(near0.clone());
  const lastScale = useRef("1|1");
  useEffect(() => { last.current.copy(near0); }, [near, close]);   // new meshes start empty: fill them on the next frame
  useFrame(() => {
    const c = camera.position;
    // on foot the detailed trees come closer in (indoors they are seen only through the windows)
    const k = forestDetail.scale, kn = forestDetail.near;
    if (`${k}|${kn}` !== lastScale.current) { lastScale.current = `${k}|${kn}`; last.current.copy(near0); }
    if (c.distanceToSquared(last.current) < 144) return;
    last.current.copy(c);
    cardU.uNear.value = nearR * kn;
    fillNear(cand.near, cand.close, trees, c, nearR * kn, closeR * k);
    culled.current.dirty = true;
  });

  return (
    <group>
      {near.map((m, k) => <primitive key={`n${k}`} object={m} />)}
      {close.map((m, k) => <primitive key={`d${k}`} object={m} />)}
      <mesh geometry={cards} material={cardMat} frustumCulled={false} receiveShadow={shadows} />
      <primitive object={proxies.conifer} />
      <primitive object={proxies.broad} />
      <group ref={clearedRef}>
        {cleared.meshes.map((m, k) => <primitive key={`c${k}`} object={m} />)}
        <primitive object={cleared.proxy} />
      </group>
    </group>
  );
});

const _m = new THREE.Matrix4();
const _c = new THREE.Color();
function writeTree(mesh: THREE.InstancedMesh, slot: number, t: Trees, i: number) {
  const c = Math.cos(t.rot[i]), s = Math.sin(t.rot[i]);
  const sx = t.crown[i], sy = t.h[i];
  _m.set(c * sx, 0, s * sx, t.x[i], 0, sy, 0, t.y[i], -s * sx, 0, c * sx, t.z[i], 0, 0, 0, 1);
  mesh.setMatrixAt(slot, _m);
  if (mesh.instanceColor) {
    const v = t.tint[i];
    _c.setRGB(0.82 + 0.3 * v, 0.84 + 0.28 * v, 0.84 + 0.22 * v);
    mesh.setColorAt(slot, _c);
  }
}

// scratch for the cells around the camera, nearest first (reused: a refill allocates nothing)
let cellKey = new Float64Array(4096), cellIdx = new Int32Array(4096), cellOrder = new Uint32Array(4096);

type Cand = { idx: Int32Array; n: number };

/** The trees within reach of the camera for each mesh, nearest cells first (the candidates the view picks from). */
function fillNear(meshes: Cand[], close: Cand[], t: Trees, cam: THREE.Vector3, R: number, closeR: number) {
  const span = Math.ceil((2 * R) / t.grid.cell) + 2;
  if (span * span > cellKey.length) { cellKey = new Float64Array(span * span); cellIdx = new Int32Array(span * span); cellOrder = new Uint32Array(span * span); }
  const counts = [0, 0, 0, 0];
  const cap = meshes.map((m) => m.idx.length);
  const ccounts = close.map(() => 0);
  const ccap = close.map((m) => m.idx.length);
  const C2 = closeR * closeR;
  const { half, cell, n, starts } = t.grid;
  const R2 = R * R;
  const i0 = Math.max(0, Math.floor((cam.x - R + half) / cell)), i1 = Math.min(n - 1, Math.floor((cam.x + R + half) / cell));
  const j0 = Math.max(0, Math.floor((cam.z - R + half) / cell)), j1 = Math.min(n - 1, Math.floor((cam.z + R + half) / cell));
  // the cells nearest the camera first: the trees are drawn front to back, so the GPU skips the leaves behind leaves
  // it has already drawn (the same trees are chosen, there are fewer than the meshes hold; only their order changes)
  let m = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const dx = (i + 0.5) * cell - half - cam.x, dz = (j + 0.5) * cell - half - cam.z;
      cellKey[m] = dx * dx + dz * dz;
      cellIdx[m++] = j * n + i;
    }
  }
  const order = cellOrder.subarray(0, m);
  for (let q = 0; q < m; q++) order[q] = q;
  order.sort((a, b) => cellKey[a] - cellKey[b]);
  for (let q = 0; q < m; q++) {
    const c = cellIdx[order[q]];
    const a = starts[c], b = starts[c + 1];
    for (let k = a; k < b; k++) {
      const dx = t.x[k] - cam.x, dy = t.y[k] + t.h[k] * 0.6 - cam.y, dz = t.z[k] - cam.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > R2) continue;
      const sp = t.sp[k];
      const j = sp * 2 + (k & 1);
      if (d2 < C2 && ccounts[j] < ccap[j]) { close[j].idx[ccounts[j]++] = k; continue; }
      if (counts[sp] >= cap[sp]) continue;
      meshes[sp].idx[counts[sp]++] = k;
    }
  }
  meshes.forEach((m, k) => { m.n = counts[k]; });
  close.forEach((m, k) => { m.n = ccounts[k]; });
}

// how far the camera may turn or move before the trees in view are picked again (the test below leaves room for it)
const CULL_TURN = (2 * Math.PI) / 180;
const CULL_MOVE = 1;
const _vp = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _eye = new THREE.Vector3();

/** A tree model's extent in its own units: the widest reach round the trunk, and the height span. */
function boundsOf(g: THREE.BufferGeometry) {
  const p = g.getAttribute("position");
  let rxz = 0, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    rxz = Math.max(rxz, Math.hypot(x, z));
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { rxz, ymid: (y0 + y1) / 2, yhalf: (y1 - y0) / 2 };
}

/**
 * Writes into each mesh the candidates the camera can see, in their order (nearest first). A tree is left out only
 * when its sphere, made 5 % bigger, plus half a metre for the wind, plus what a turn of 2 degrees or a step of a
 * metre can bring into view at its distance, lies wholly beyond one side of the picture. Near and far are not tested.
 */
function fillVisible(meshes: THREE.InstancedMesh[], cand: Cand[], bounds: { rxz: number; ymid: number; yhalf: number }[], t: Trees, eye: THREE.Vector3) {
  const planes = _frustum.planes;
  const turn = Math.sin(CULL_TURN);
  meshes.forEach((m, k) => {
    const c = cand[k], b = bounds[k];
    let n = 0;
    for (let q = 0; q < c.n; q++) {
      const i = c.idx[q];
      const sx = t.crown[i], sy = t.h[i];
      const cx = t.x[i], cy = t.y[i] + b.ymid * sy, cz = t.z[i];
      const dist = Math.hypot(cx - eye.x, cy - eye.y, cz - eye.z);
      const r = Math.hypot(b.rxz * sx, b.yhalf * sy) * 1.05 + 0.5 + dist * turn + CULL_MOVE;
      let inside = true;
      for (let pi = 0; pi < 4; pi++) {
        const pl = planes[pi];
        if (pl.normal.x * cx + pl.normal.y * cy + pl.normal.z * cz + pl.constant < -r) { inside = false; break; }
      }
      if (inside) writeTree(m, n++, t, i);
    }
    m.count = n;
    m.instanceMatrix.clearUpdateRanges();
    m.instanceMatrix.addUpdateRange(0, n * 16);
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) {
      m.instanceColor.clearUpdateRanges();
      m.instanceColor.addUpdateRange(0, n * 3);
      m.instanceColor.needsUpdate = true;
    }
  });
}
