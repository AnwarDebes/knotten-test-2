/**
 * Materials for the outside of the houses. Patterns are drawn in the shaders from UVs in metres, so
 * boards, seams and slabs have their real sizes: board-on-board cladding (148 mm boards under 48 mm
 * battens), standing seams every 0.6 m, deck boards 145 mm wide, paving slabs 0.6 x 0.4 m.
 *
 * The windows: the house being visited has clear glass (its real rooms are drawn behind it); every
 * other house shows a room behind each pane (floor, walls, ceiling and a picture, seen in perspective
 * through the glass), lit warm at night, so the whole field reads as lived in.
 */
import * as THREE from "three";
import { twinUniforms } from "../twin/materials";

export const MAX_HOUSES = 48;

export const houseUniforms = {
  uPV: { value: new Float32Array(MAX_HOUSES) },     // 0..1 production, lights the panels
  uLoad: { value: new Float32Array(MAX_HOUSES) },   // 0..1 use, lights the windows at dusk
  uOff: { value: new Float32Array(MAX_HOUSES) },    // 1 when the house is dark (outage, empty battery)
  uEnergy: { value: 0 },                            // 1 in the living field (energy shown)
  uVisit: { value: -1 },                            // the house being visited: clear glass, moving doors drawn apart
  uDaylight: { value: 1 },                          // 0 night .. 1 full day, for the rooms behind the glass
};

const HOUSE_GLSL = /* glsl */ `
#define MAX_HOUSES ${MAX_HOUSES}
uniform float uPV[MAX_HOUSES];
uniform float uLoad[MAX_HOUSES];
uniform float uOff[MAX_HOUSES];
uniform float uEnergy;
uniform float uVisit;
uniform float uDaylight;
uniform float uNight;
varying float vHouse;
varying float vMove;
float hHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
// a horizontal direction along the surface, in view space (for the drawn relief)
vec3 hAlong(vec3 n) { vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); vec3 t = cross(n, up); return length(t) > 1e-3 ? normalize(t) : vec3(1.0, 0.0, 0.0); }
`;

/** Adds the house index and the "moves" flag to a material; parts that move are hidden on the visited house. */
function houseAware(m: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial, key: string, extra?: (s: THREE.WebGLProgramParametersWithUniforms) => void) {
  const prev = m.onBeforeCompile;
  // the patterns read the UVs (metres) in the fragment shader
  m.defines = { ...(m.defines ?? {}), USE_UV: "" };
  m.onBeforeCompile = (s, r) => {
    prev?.call(m, s, r);
    Object.assign(s.uniforms, houseUniforms, { uNight: twinUniforms.uNight });
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aHouse;\nattribute float aMove;\nvarying float vHouse;\nvarying float vMove;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHouse = aHouse;\nvMove = aMove;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\n${HOUSE_GLSL}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
int hIndex = int(vHouse + 0.5);
bool hVisited = abs(vHouse - uVisit) < 0.5;
if (hVisited && vMove > 0.5) discard;`);
    extra?.(s);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

/** Board-on-board cladding: battens proud of the boards, a shadow line beside each, a little grain. */
export function claddingMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, envMapIntensity: 0.55 });
  return houseAware(m, "house-clad-v2", (s) => {
    s.fragmentShader = s.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
float cb = fract(vUv.x / 0.196);
float batten = step(cb, 0.245);
float board = floor(vUv.x / 0.196);
// each board a shade of its own, fine vertical grain
diffuseColor.rgb *= 0.93 + 0.12 * hHash(board + vHouse * 7.0) + 0.05 * (hHash(floor(vUv.x * 160.0)) - 0.5);
// the board lies in the batten's shadow just beside it
diffuseColor.rgb *= mix(1.0, 0.74, (1.0 - smoothstep(0.245, 0.3, cb)) * (1.0 - batten));
diffuseColor.rgb *= mix(1.0, 1.04, batten);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
// the batten's two edges turn towards the light
float tilt = (1.0 - smoothstep(0.0, 0.012, cb)) - (smoothstep(0.233, 0.245, cb) - smoothstep(0.245, 0.246, cb));
normal = normalize(normal + tilt * 0.6 * hAlong(normal));`);
  });
}

/** Plain painted or coated surfaces: trim, frames, metal. */
export function paintMaterial(roughness: number, metalness = 0, key = "paint") {
  return houseAware(new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness, envMapIntensity: 0.7 }), `house-${key}-v1`);
}

/** Standing-seam steel: a raised seam every 0.6 m down the slope. */
export function roofMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.55, envMapIntensity: 0.85 });
  return houseAware(m, "house-roof-v1", (s) => {
    s.fragmentShader = s.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
float sx = fract(vUv.x / 0.6);
float seam = 1.0 - smoothstep(0.0, 0.03, min(sx, 1.0 - sx));
diffuseColor.rgb *= mix(1.0, 1.25, seam);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
float sd = (sx < 0.5 ? 1.0 : -1.0) * (1.0 - smoothstep(0.0, 0.03, min(sx, 1.0 - sx)));
normal = normalize(normal + sd * 0.5 * hAlong(normal));`);
  });
}

/** Terrace decking: 145 mm boards along the terrace with 6 mm gaps, each board its own shade. */
export function deckMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, envMapIntensity: 0.5 });
  return houseAware(m, "house-deck-v1", (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
float db = vUv.y / 0.151;
float gap = smoothstep(0.955, 0.97, fract(db));
float boardId = floor(db);
float seg = floor(vUv.x / 3.6 + hHash(boardId) * 3.0);
diffuseColor.rgb *= (0.86 + 0.22 * hHash(boardId * 3.1 + seg * 7.7)) * (0.97 + 0.06 * hHash(floor(vUv.x * 40.0) + boardId));
diffuseColor.rgb *= 1.0 - 0.75 * gap;`);
  });
}

/** Concrete paving slabs 0.6 x 0.4 m with joints. */
export function pavingMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, envMapIntensity: 0.5 });
  return houseAware(m, "house-paving-v1", (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
vec2 pc = vUv / vec2(0.6, 0.4);
pc.x += 0.5 * step(0.5, fract(floor(pc.y) * 0.5));
vec2 pf = fract(pc);
float joint = 1.0 - smoothstep(0.0, 0.012, min(min(pf.x, 1.0 - pf.x) * 0.6, min(pf.y, 1.0 - pf.y) * 0.4));
diffuseColor.rgb *= (0.9 + 0.14 * hHash(dot(floor(pc), vec2(17.0, 31.0)))) * (1.0 - 0.45 * joint);`);
  });
}

/** Plinths and steps: cast concrete with a little mottling. */
export function concreteMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, envMapIntensity: 0.45 });
  return houseAware(m, "house-concrete-v1", (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
diffuseColor.rgb *= 0.94 + 0.08 * hHash(floor(vUv.x * 9.0) + floor(vUv.y * 9.0) * 13.0);`);
  });
}

/**
 * Natural-stone retaining walls (the usual answer to a drop in a Norwegian garden): granite blocks
 * in uneven courses, dark joints, each block bulging a little.
 */
export function stoneMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, envMapIntensity: 0.45 });
  return houseAware(m, "house-stone-v1", (s) => {
    s.fragmentShader = s.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
float course = floor(vUv.y / 0.32);
float cy = fract(vUv.y / 0.32);
float off = hHash(course * 1.7) * 0.6;
float bw = 0.45 + 0.35 * hHash(course * 3.3);
float sxs = (vUv.x + off) / bw;
float block = floor(sxs);
float cx = fract(sxs);
float joint = 1.0 - smoothstep(0.0, 0.05, min(min(cx, 1.0 - cx) * bw, min(cy, 1.0 - cy) * 0.32) / 0.025);
float tone = hHash(block * 7.1 + course * 13.3);
diffuseColor.rgb *= mix(vec3(0.82, 0.8, 0.77), vec3(1.08, 1.04, 0.98), tone) * (1.0 - 0.6 * joint);
vec2 stoneUV = vec2(cx - 0.5, cy - 0.5);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
// each block bulges: its normal turns outwards towards its edges
normal = normalize(normal + 0.45 * (stoneUV.x * hAlong(normal) + stoneUV.y * normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));`);
  });
}

/** Railing glass: clear, a faint green edge tint, reflecting the sky. */
export function railGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: "#d7e6e2", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false });
}

/** Outdoor lamps: glow at night. */
export function lampMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#f3ead8", roughness: 0.4 });
  return houseAware(m, "house-lamp-v1", (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * uNight * (1.0 - uOff[hIndex]) * 4.0;`);
  });
}

/** The solar module texture: dark cells with thin silver lines, painted once in the browser. */
function moduleTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0d1420"; g.fillRect(0, 0, 64, 128);
  g.strokeStyle = "#2e3a4a"; g.lineWidth = 1;
  // 6 x 12 cells, each cut in half (half-cut cells), busbars faintly
  for (let x = 0; x <= 64; x += 64 / 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 0; y <= 128; y += 128 / 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  g.strokeStyle = "#1c2633";
  g.beginPath(); g.moveTo(0, 64); g.lineTo(64, 64); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The modules: glass over dark cells, lit amber in the energy view by what the roof makes. */
export function pvMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ map: moduleTexture(), roughness: 0.16, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.06, envMapIntensity: 1.2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  return houseAware(m, "house-pv-v2", (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
float shine = uEnergy * uPV[hIndex];
totalEmissiveRadiance += vec3(1.0, 0.62, 0.18) * shine * 0.9;`);
  });
}

/**
 * The windows. Glass reflects the sky (physically, through the environment map); behind it, for every
 * house but the one being visited, a room drawn in the shader: a ray from the eye through the pane
 * meets the room's floor, ceiling, back wall or side walls. By day the room is a fraction as bright
 * as outside, at night some rooms are lit warm (more when the energy layer says the house uses power).
 */
export function glassMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: "#0b1216", roughness: 0.035, metalness: 0, envMapIntensity: 1.25, transparent: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  return houseAware(m, "house-glass-v2", (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aWin;\nvarying vec4 vWin;\nvarying vec3 vGlassWorld;\nvarying vec3 vGlassNormal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWin = aWin;\nvGlassWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGlassNormal = normalize(mat3(modelMatrix) * objectNormal);");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec4 vWin;
varying vec3 vGlassWorld;
varying vec3 vGlassNormal;
vec3 roomColour;
float roomLit;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
roomColour = vec3(0.0);
roomLit = 0.0;
{
  vec3 N = normalize(vGlassNormal);
  vec3 r = normalize(vGlassWorld - cameraPosition);
  // the camera may be on either side of the pane: the room is always behind it, seen from outside
  if (dot(r, N) > 0.0) N = -N;
  float floorY = vWin.x;
  float seed = vWin.z;
  float depth = 4.0;
  float tBack = depth / max(1e-3, dot(r, -N));
  float tFloor = r.y < 0.0 ? (floorY - vGlassWorld.y) / r.y : 1e9;
  float tCeil = r.y > 0.0 ? (floorY + 2.6 - vGlassWorld.y) / r.y : 1e9;
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
  float s0 = dot(vGlassWorld, T);
  float cell = 3.2;
  float rT = dot(r, T);
  float wallS = rT > 0.0 ? (floor(s0 / cell) + 1.0) * cell : floor(s0 / cell) * cell;
  float tSide = abs(rT) > 1e-4 ? (wallS - s0) / rT : 1e9;
  float t = min(min(tBack, tSide), min(tFloor, tCeil));
  vec3 h = vGlassWorld + r * t;
  float hy = h.y - floorY;
  float k = hHash(seed * 31.0 + floor(s0 / cell) * 7.0 + vHouse * 3.0);
  vec3 wallC = mix(vec3(0.82, 0.8, 0.76), mix(vec3(0.72, 0.76, 0.72), vec3(0.8, 0.74, 0.68), step(0.5, k)), step(0.6, k));
  if (t == tFloor) {
    float plank = hHash(floor(dot(h.xz, vec2(T.x, T.z)) * 5.0));
    roomColour = vec3(0.45, 0.33, 0.22) * (0.85 + 0.25 * plank);
  } else if (t == tCeil) {
    roomColour = vec3(0.86);
  } else if (t == tSide) {
    roomColour = wallC * 0.82;
  } else {
    roomColour = wallC;
    // a picture or a doorway on the back wall, a sofa or a sideboard along it
    float bs = dot(h, T);
    float bx = fract(bs / cell);
    if (hy > 1.1 && hy < 1.75 && bx > 0.3 && bx < 0.62) roomColour = mix(vec3(0.3, 0.38, 0.45), vec3(0.62, 0.45, 0.3), k);
    if (hy < 0.75 && bx > 0.12 && bx < 0.78) roomColour = mix(vec3(0.33, 0.35, 0.36), vec3(0.5, 0.45, 0.38), hHash(k * 9.0)) * (hy < 0.42 ? 0.9 : 1.0);
  }
  // light falls off into the room; curtains at the sides of some panes
  roomColour *= exp(-0.12 * max(0.0, t - 0.5));
  float curtain = step(0.55, hHash(seed * 17.0 + vHouse)) * (1.0 - smoothstep(0.06, 0.13, min(vUv.x, 1.0 - vUv.x)));
  roomColour = mix(roomColour, vec3(0.86, 0.84, 0.8), curtain * 0.85);
  // lit at night in some rooms; with the energy layer, more where the house uses power
  float lit = (1.0 - uOff[int(vHouse + 0.5)]) * max(step(0.45, hHash(seed * 5.0 + vHouse * 1.7)), uEnergy * uLoad[int(vHouse + 0.5)]);
  roomLit = lit;
  if (vWin.y > 0.5) roomColour = vec3(0.78, 0.8, 0.8);   // frosted bathroom glass
}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{
  bool visited = abs(vHouse - uVisit) < 0.5;
  vec3 V = normalize(cameraPosition - vGlassWorld);
  float F = 0.04 + 0.96 * pow(1.0 - abs(dot(normalize(vGlassNormal), V)), 5.0);
  if (!visited) {
    float day = 0.03 + 0.2 * uDaylight;
    vec3 warm = vec3(1.0, 0.72, 0.42) * 0.9;
    totalEmissiveRadiance += roomColour * (1.0 - F) * (day + uNight * roomLit * 1.5 * warm);
  }
}`)
      .replace("#include <opaque_fragment>", `#include <opaque_fragment>
{
  bool visited = abs(vHouse - uVisit) < 0.5;
  vec3 V = normalize(cameraPosition - vGlassWorld);
  float F = 0.04 + 0.96 * pow(1.0 - abs(dot(normalize(vGlassNormal), V)), 5.0);
  // the visited house: clear glass, only its reflection (a hint of green at a grazing angle)
  gl_FragColor.a = visited ? mix(0.1, 0.85, F) : 1.0;
  if (vWin.y > 0.5 && visited) gl_FragColor = vec4(mix(gl_FragColor.rgb, vec3(0.8, 0.82, 0.82), 0.7), 0.92);
}`);
  });
}

export function houseMaterials() {
  return {
    clad: claddingMaterial(),
    paint: paintMaterial(0.62, 0, "paint"),
    frame: paintMaterial(0.42, 0.25, "frame"),
    metal: paintMaterial(0.38, 0.6, "metal"),
    roof: roofMaterial(),
    deck: deckMaterial(),
    paving: pavingMaterial(),
    concrete: concreteMaterial(),
    stone: stoneMaterial(),
    pv: pvMaterial(),
    glass: glassMaterial(),
    railglass: railGlassMaterial(),
    lamp: lampMaterial(),
  };
}
export type HouseMaterials = ReturnType<typeof houseMaterials>;

let shared: HouseMaterials | null = null;
/** One set for the whole page: the houses outside and the moving parts of the visited house share it. */
export function sharedHouseMaterials() {
  if (!shared) shared = houseMaterials();
  return shared;
}
