/**
 * Materials for the inside of the visited house, and the light in it.
 *
 * A room is lit by what it sees through its windows, not by the open sky: each vertex carries the
 * share of its view that is window (the sky component of the daylight factor, worked out in
 * lighting.ts with the exact form factor of every opening), the light bounced round the room, the
 * light of the lamps and a contact shadow. The shader scales the sky's light by these, so the floor by
 * the glass is bright and the back of the room is dim, as in a real house.
 *
 * Sunlight comes in only through the windows: for every point, the ray towards the sun is followed
 * through the house's own geometry (which outer wall it leaves by, whether that is inside an opening
 * at both faces of the wall, under the eaves or the terrace, past the inner walls) and through the
 * glass. The plot's measured horizon decides whether the sun is up at all. So a sunlit patch falls on
 * the floor exactly where the window throws it, and no light leaks through a wall.
 */
import * as THREE from "three";
import { HOUSE, PARTITIONS, OPENINGS, keep, levelZ, holeRect } from "@/lib/house/plan";
import { twinUniforms } from "../twin/materials";

export const MAX_WIN = 24;
export const MAX_PART = 16;

export const interiorUniforms = {
  uHouse: { value: new THREE.Vector4(0, 0, 1, 0) },      // origin x, origin z (scene), cos, sin of the facing
  uHouseM: { value: new THREE.Vector2(1, 0) },           // mirror (1 or -1), the main floor's height
  uSunUp: { value: 1 },                                  // the sun clears the plot's horizon (0..1)
  uSkyGain: { value: 3.2 },
  uLampGain: { value: 1.0 },
  uLampsOn: { value: 0 },
  uSensorOn: { value: 1 },                              // lights on a motion sensor (windowless rooms) while visited
  uLampColor: { value: new THREE.Color(1.0, 0.82, 0.62) },
  uNWin: { value: 0 },
  uWin: { value: Array.from({ length: MAX_WIN }, () => new THREE.Vector4()) },        // s0, s1, z0, z1
  uWinSide: { value: new Float32Array(MAX_WIN) },                                     // 0 front, 1 back, 2 left, 3 right
  uNPart: { value: 0 },
  uPart: { value: Array.from({ length: MAX_PART }, () => new THREE.Vector4()) },      // u0, u1, v0, v1
  uPartZ: { value: Array.from({ length: MAX_PART }, () => new THREE.Vector2()) },     // z0, z1
  uLowerOn: { value: 0 },
};

/** Fill the uniforms for one house: its frame, its openings and its inner walls. */
export function setInteriorHouse(x: number, y: number, floorZ: number, facingDeg: number, mirror: boolean, lower: boolean) {
  const f = (facingDeg * Math.PI) / 180;
  interiorUniforms.uHouse.value.set(x, -y, Math.cos(f), Math.sin(f));
  interiorUniforms.uHouseM.value.set(mirror ? -1 : 1, floorZ);
  interiorUniforms.uLowerOn.value = lower ? 1 : 0;
  const sideIndex = { front: 0, back: 1, left: 2, right: 3 } as const;
  const wins = OPENINGS.filter((o) => keep(o, lower));
  interiorUniforms.uNWin.value = Math.min(MAX_WIN, wins.length);
  wins.slice(0, MAX_WIN).forEach((o, i) => {
    const h = holeRect(o);
    interiorUniforms.uWin.value[i].set(h.s0, h.s1, h.z0, h.z1);
    interiorUniforms.uWinSide.value[i] = sideIndex[o.side];
  });
  const parts = PARTITIONS.filter((p) => keep(p, lower));
  interiorUniforms.uNPart.value = Math.min(MAX_PART, parts.length);
  parts.slice(0, MAX_PART).forEach((p, i) => {
    interiorUniforms.uPart.value[i].set(p.rect.u0, p.rect.u1, p.rect.v0, p.rect.v1);
    const z0 = levelZ(p.level);
    interiorUniforms.uPartZ.value[i].set(z0, p.level === "lower" ? HOUSE.lowerCeiling : 5.2);
  });
}

const H = HOUSE;
const SUN_GLSL = /* glsl */ `
uniform vec4 uHouse;
uniform vec2 uHouseM;
uniform float uSunUp;
uniform vec3 uSunWorld;
uniform int uNWin;
uniform vec4 uWin[${MAX_WIN}];
uniform float uWinSide[${MAX_WIN}];
uniform int uNPart;
uniform vec4 uPart[${MAX_PART}];
uniform vec2 uPartZ[${MAX_PART}];
uniform float uLowerOn;
const float HW = ${H.hw.toFixed(3)};
const float HD = ${H.hd.toFixed(3)};
const float IW = ${H.iw.toFixed(3)};
const float ID = ${H.id.toFixed(3)};
const float OV = ${H.overhang.toFixed(3)};
const float EAVE = ${H.eave.toFixed(3)};
const float RIDGE = ${H.ridge.toFixed(3)};

// scene direction to the house's own frame (u, v, z)
vec3 hDir(vec3 d) {
  float dx = d.x, dn = -d.z;
  return vec3((dx * uHouse.z - dn * uHouse.w) * uHouseM.x, dx * uHouse.w + dn * uHouse.z, d.y);
}
float roofUnder(float v) { return EAVE + (HD - abs(v)) * ((RIDGE - EAVE) / HD) - 0.3; }

// is (s, z) inside an opening on this side?
float inOpening(float side, float s, float z) {
  float hit = 0.0;
  for (int i = 0; i < ${MAX_WIN}; i++) {
    if (i >= uNWin) break;
    if (abs(uWinSide[i] - side) > 0.5) continue;
    vec4 w = uWin[i];
    hit = max(hit, step(w.x + 0.06, s) * step(s, w.y - 0.06) * step(w.z + 0.06, z) * step(z, w.w - 0.06));
  }
  return hit;
}

// the share of direct sun reaching point p (house frame) along s (house frame, unit, pointing to the sun)
float sunThrough(vec3 p, vec3 s) {
  if (s.z <= 0.01 || uSunUp <= 0.0) return 0.0;
  float big = 1e6;
  float tF = s.y > 1e-4 ? (HD - p.y) / s.y : big;
  float tB = s.y < -1e-4 ? (-HD - p.y) / s.y : big;
  float tL = s.x < -1e-4 ? (-HW - p.x) / s.x : big;
  float tR = s.x > 1e-4 ? (HW - p.x) / s.x : big;
  float t = min(min(tF, tB), min(tL, tR));
  float side; float tIn;
  if (t == tF) { side = 0.0; tIn = (ID - p.y) / s.y; }
  else if (t == tB) { side = 1.0; tIn = (-ID - p.y) / s.y; }
  else if (t == tL) { side = 2.0; tIn = (-IW - p.x) / s.x; }
  else { side = 3.0; tIn = (IW - p.x) / s.x; }
  vec3 e = p + s * t, ei = p + s * max(tIn, 0.0);
  float se = side < 1.5 ? e.x : e.y, si = side < 1.5 ? ei.x : ei.y;
  // through the opening at both faces of the wall (the reveal shades a low sun)
  float through = inOpening(side, se, e.z) * inOpening(side, si, ei.z);
  if (through < 0.5) return 0.0;
  // a point on the lower floor cannot see past the main floor's slab
  if (p.z < -0.35 && e.z > -0.32) return 0.0;
  // the eaves over the long walls, the verges over the gables
  if (side < 1.5) {
    float tO = side < 0.5 ? (HD + OV - p.y) / s.y : (-HD - OV - p.y) / s.y;
    float zo = p.z + s.z * tO;
    if (zo > EAVE - OV * ((RIDGE - EAVE) / HD) - 0.3 && zo < RIDGE + 0.5) return 0.0;
    // under the terrace (from the lower floor, the deck 3 m deep above the patio)
    if (side < 0.5 && p.z < -0.35) {
      float tT = (HD + ${H.terraceDepth.toFixed(2)} - p.y) / s.y;
      if (p.z + s.z * tT > -0.78) return 0.0;
    }
  } else {
    float tO = side < 2.5 ? (-HW - OV - p.x) / s.x : (HW + OV - p.x) / s.x;
    vec3 o = p + s * tO;
    if (o.z > roofUnder(o.y) && abs(o.y) < HD + OV) return 0.0;
  }
  // the inner walls between the point and the window
  for (int i = 0; i < ${MAX_PART}; i++) {
    if (i >= uNPart) break;
    vec4 r = uPart[i];
    // slab test of the ray in plan against the wall's rectangle
    vec2 inv = 1.0 / vec2(abs(s.x) > 1e-5 ? s.x : 1e-5, abs(s.y) > 1e-5 ? s.y : 1e-5);
    vec2 t0 = (vec2(r.x, r.z) - p.xy) * inv, t1 = (vec2(r.y, r.w) - p.xy) * inv;
    vec2 tmin = min(t0, t1), tmax = max(t0, t1);
    float a = max(tmin.x, tmin.y), b = min(tmax.x, tmax.y);
    if (b > max(a, 0.02) && a < t) {
      float za = p.z + s.z * max(a, 0.0);
      if (za > uPartZ[i].x && za < uPartZ[i].y) return 0.0;
    }
  }
  // triple glazing lets through about 60 % of the sun's light
  return 0.6 * uSunUp;
}
`;

/**
 * The interior lighting on a standard material: sky light scaled by the window factor, lamps, contact
 * shadow, and the sun only through the windows. `pattern` adds a surface drawn from the UVs.
 */
function lit<T extends THREE.MeshStandardMaterial>(m: T, key: string, pattern = "", fragPre = "") {
  m.defines = { ...(m.defines ?? {}), USE_UV: "" };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, interiorUniforms, { uSunWorld: twinUniforms.uSunWorld });
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>
attribute float aSky;
attribute float aLamp;
attribute float aLampS;
attribute float aAO;
uniform vec4 uHouse;
uniform vec2 uHouseM;
varying float vSky;
varying float vLamp;
varying float vLampS;
varying float vAO;
varying vec3 vHouseP;`)
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vSky = aSky; vLamp = aLamp; vLampS = aLampS; vAO = aAO;
{
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  float dx = wp.x - uHouse.x, dn = -(wp.z - uHouse.y);
  vHouseP = vec3((dx * uHouse.z - dn * uHouse.w) * uHouseM.x, dx * uHouse.w + dn * uHouse.z, wp.y - uHouseM.y);
}`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uSkyGain;
uniform float uLampGain;
uniform float uLampsOn;
uniform float uSensorOn;
uniform vec3 uLampColor;
varying float vSky;
varying float vLamp;
varying float vLampS;
varying float vAO;
varying vec3 vHouseP;
float iHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
${SUN_GLSL}
${fragPre}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
${pattern}`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
{
  float ao = clamp(vAO, 0.0, 1.0);
  float sky = vSky * uSkyGain;
  // daylight inside has bounced off oak, white walls and the terrace: warmer and less blue than the sky
  vec3 warm = vec3(1.07, 1.0, 0.9);
  vec3 ind = reflectedLight.indirectDiffuse;
  reflectedLight.indirectDiffuse = mix(ind, vec3(dot(ind, vec3(0.2126, 0.7152, 0.0722))), 0.55) * warm * sky * ao;
  // what glossy surfaces mirror indoors is mostly the room, not the sky
  vec3 spec = reflectedLight.indirectSpecular;
  reflectedLight.indirectSpecular = mix(spec, vec3(dot(spec, vec3(0.2126, 0.7152, 0.0722))) * warm, 0.75) * mix(0.1, 1.0, clamp(vSky * 2.5, 0.0, 1.0)) * ao;
  float sun = sunThrough(vHouseP, normalize(hDir(uSunWorld)));
  reflectedLight.directDiffuse *= sun;
  reflectedLight.directSpecular *= sun;
  reflectedLight.indirectDiffuse += BRDF_Lambert(material.diffuseColor) * (vLamp * uLampsOn + vLampS * uSensorOn) * uLampGain * uLampColor * mix(0.55, 1.0, ao);
}`);
  };
  // the plain surfaces (no pattern of their own) share one program: their differences are uniforms, or settings
  // three keys on anyway (transparency, sides)
  m.customProgramCacheKey = () => (pattern || fragPre ? `interior-${key}-v1` : "interior-plain-v1");
  return m;
}

// ---------------------------------------------------------------- surface patterns (UVs in metres)
const OAK = `
// oak boards 180 mm wide, 1.8 to 2.4 m long, staggered; grain along the board
{
  vec2 q = vUv / vec2(2.1, 0.18);
  float row = floor(q.y);
  q.x += iHash(vec2(row, 1.0)) * 3.0;
  float plank = floor(q.x);
  vec2 f = fract(q);
  float seam = 1.0 - smoothstep(0.0, 0.012, min(min(f.x, 1.0 - f.x) * 2.1, min(f.y, 1.0 - f.y) * 0.18) / 0.004);
  float tone = iHash(vec2(plank, row));
  float grain = 0.5 + 0.5 * sin((vUv.y * 140.0 + sin(vUv.x * 3.0 + tone * 6.0) * 2.5 + tone * 10.0));
  // natural oiled oak (linear colour), each board a shade of its own
  diffuseColor.rgb *= vec3(0.6, 0.39, 0.21) * (0.8 + 0.34 * tone) * (0.93 + 0.1 * grain) * (1.0 - 0.45 * seam);
}`;
const TILE_FLOOR = `
{
  vec2 f = fract(vUv / 0.6);
  float joint = 1.0 - smoothstep(0.0, 0.004, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 0.6);
  diffuseColor.rgb *= (0.92 + 0.12 * iHash(floor(vUv / 0.6))) * (1.0 - 0.35 * joint);
}`;
const STONE_FLOOR = `
{
  vec2 g = vUv / vec2(0.6, 0.3);
  g.x += 0.5 * mod(floor(g.y), 2.0);
  vec2 f = fract(g);
  float joint = 1.0 - smoothstep(0.0, 0.004, min(min(f.x, 1.0 - f.x) * 0.6, min(f.y, 1.0 - f.y) * 0.3));
  float slate = 0.88 + 0.18 * iHash(floor(g)) + 0.06 * sin(vUv.x * 37.0 + vUv.y * 13.0);
  diffuseColor.rgb *= slate * (1.0 - 0.4 * joint);
}`;
const TILE_WALL = `
{
  vec2 g = vUv / vec2(0.6, 0.3);
  vec2 f = fract(g);
  float joint = 1.0 - smoothstep(0.0, 0.003, min(min(f.x, 1.0 - f.x) * 0.6, min(f.y, 1.0 - f.y) * 0.3));
  diffuseColor.rgb *= (0.95 + 0.06 * iHash(floor(g))) * (1.0 - 0.18 * joint);
}`;
const GRAIN = `
{
  float t = iHash(floor(vUv * 0.5));
  float grain = 0.5 + 0.5 * sin(vUv.y * 90.0 + sin(vUv.x * 7.0 + t * 5.0) * 1.8);
  diffuseColor.rgb *= 0.93 + 0.09 * grain;
}`;
const WEAVE = `
{
  float w = 0.5 + 0.5 * sin(vUv.x * 900.0) * sin(vUv.y * 900.0);
  diffuseColor.rgb *= 0.92 + 0.1 * w + 0.04 * (iHash(floor(vUv * 300.0)) - 0.5);
}`;

/** The battery's charge bar: lit up to the state of charge. */
export const socUniform = { value: 0.6 };

export function interiorMaterials(screen: THREE.Texture) {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  const glow = (color: string, key: string, strength: number) => {
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: true });
    m.onBeforeCompile = (s) => {
      s.uniforms.uLampsOn = interiorUniforms.uLampsOn;
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uLampsOn;")
        .replace("#include <opaque_fragment>", `gl_FragColor = vec4(outgoingLight * mix(0.35, ${strength.toFixed(2)}, uLampsOn), diffuseColor.a);\n#include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => `interior-glow-${key}`;
    return m;
  };
  const soc = new THREE.MeshBasicMaterial({ color: "#3ddc84" });
  soc.defines = { USE_UV: "" };
  soc.onBeforeCompile = (s) => {
    s.uniforms.uSoc = socUniform;
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uSoc;")
      .replace("#include <opaque_fragment>", "float lvl = step(vUv.y, 0.25 + 0.7 * uSoc);\ngl_FragColor = vec4(mix(vec3(0.05, 0.08, 0.07), outgoingLight * 2.2, lvl), 1.0);\n#include <opaque_fragment>");
  };
  soc.customProgramCacheKey = () => "interior-soc";
  const scr = new THREE.MeshBasicMaterial({ map: screen, toneMapped: false });
  return {
    wall: lit(std({ roughness: 0.92, envMapIntensity: 0.6 }), "wall"),
    tileWall: lit(std({ roughness: 0.32, envMapIntensity: 0.8 }), "tilewall", TILE_WALL),
    ceiling: lit(std({ roughness: 0.96, envMapIntensity: 0.5 }), "ceiling"),
    oak: lit(std({ roughness: 0.5, envMapIntensity: 0.8 }), "oak", OAK),
    tileFloor: lit(std({ roughness: 0.4, envMapIntensity: 0.8 }), "tilefloor", TILE_FLOOR),
    stoneFloor: lit(std({ roughness: 0.55, envMapIntensity: 0.7 }), "stonefloor", STONE_FLOOR),
    paintwood: lit(std({ roughness: 0.42, envMapIntensity: 0.75 }), "paintwood"),
    oakwood: lit(std({ roughness: 0.55, envMapIntensity: 0.7 }), "oakwood", GRAIN),
    matte: lit(std({ roughness: 0.82, envMapIntensity: 0.6 }), "matte"),
    gloss: lit(std({ roughness: 0.18, envMapIntensity: 1.0 }), "gloss"),
    chrome: lit(std({ roughness: 0.16, metalness: 1.0, envMapIntensity: 1.0 }), "chrome"),
    metal: lit(std({ roughness: 0.45, metalness: 0.6, envMapIntensity: 0.8 }), "metal"),
    black: lit(std({ roughness: 0.08, envMapIntensity: 1.0 }), "black"),
    fabric: lit(std({ roughness: 1.0, envMapIntensity: 0.4 }), "fabric", WEAVE),
    plant: lit(std({ roughness: 0.7, envMapIntensity: 0.5 }), "plant"),
    glass: lit(new THREE.MeshStandardMaterial({ color: "#dfe9ea", roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide }), "glass"),
    // a mirror shows the room behind the visitor: a soft light reflection rather than the open sky
    mirror: lit(new THREE.MeshStandardMaterial({ color: "#c9cdcc", roughness: 0.12, metalness: 0.85, envMapIntensity: 0.35, emissive: "#8d8f8c", emissiveIntensity: 0.35 }), "mirror"),
    emissive: glow("#fff1d8", "bulb", 2.6),
    led: glow("#42e08a", "led", 1.6),
    socbar: soc,
    screen: scr,
  };
}
export type InteriorMaterials = ReturnType<typeof interiorMaterials>;
