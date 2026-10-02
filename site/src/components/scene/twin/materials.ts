/**
 * Shared shader pieces for the twin.
 *
 * Water is drawn by the terrain's own material where the mask says water: Kartverket's model is
 * flat at the water surface, so there is no second sheet to fight with (the cause of the old
 * flicker). Waves are a handful of travelling swells whose slope fades out before they get
 * smaller than a pixel, so far water stays calm instead of sparkling.
 *
 * The aerial photos are summer pictures. `uWinter` turns greens to winter: fields and grass to
 * pale straw, broadleaf woods (the mask's blue channel: their share of the trees) to bare twigs
 * and litter, and leaves conifer woods nearly as they are.
 */
import * as THREE from "three";

export const twinUniforms = {
  uTime: { value: 0 },
  uWinter: { value: 0 },      // 0 summer .. 1 deep winter
  uAutumn: { value: 0 },      // 0 .. 1 in October
  uWind: { value: 3 },        // m/s at 10 m, from the weather when known
  uPixelAngle: { value: 0.0008 }, // radians per pixel, set from the camera each frame
  uNight: { value: 0 },       // 0 day .. 1 night: lit windows
  uSunWorld: { value: new THREE.Vector3(0, 1, 0) },  // direction to the sun (scene axes), for the light through the windows
  uClipHouse: { value: new THREE.Vector4(0, 0, 1, 0) },  // the visited house: x, z (scene), cos and sin of its facing
  uClipOn: { value: 0 },      // 1 while a house is visited: no ground inside its walls (its own floors are there)
  uExposureBoost: { value: 1 },  // the eye adapting indoors (the walk raises it inside a house)
  uClear: { value: new THREE.Vector4(0, 0, 0, 0) },  // x0, z0, x1, z1 (three.js axes): trees cleared for a scenario (the shared plant)
  uClearOn: { value: 0 },
};

/**
 * Trees take their leaf colour from the aerial photo where they stand: a spruce stand is as dark as
 * it is from the air, a birch grove as light, each tree its own shade. The colour is read in the
 * vertex shader at the trunk, a few metres across (a mip level of the photo), from the innermost
 * ring's photo where it covers the tree and the next ring's further out. `uAerialMix` says per
 * species how much of the leaf colour comes from the photo (bare and turning broadleaf crowns take
 * their colour from the season instead); a photo pixel that is not green (a roof, a road next to
 * the tree) is not used.
 */
export const treeAerial = {
  uAerial0: { value: null as THREE.Texture | null },
  uAerial1: { value: null as THREE.Texture | null },
  uAerialHalf: { value: new THREE.Vector2(330, 1290) },
  uAerialMix: { value: new THREE.Vector4(1, 1, 1, 1) },   // spruce, pine, birch, oak
  uAerialGain: { value: 1.25 },                           // the photo's canopy includes its own shadows
};

export const TREE_AERIAL_GLSL = /* glsl */ `
uniform sampler2D uAerial0;
uniform sampler2D uAerial1;
uniform vec2 uAerialHalf;
uniform vec4 uAerialMix;
uniform float uAerialGain;
// linear colour of the aerial photo at a point (x east, y north), averaged over a few metres
vec3 twinAerialAt(vec2 p) {
  vec3 inner = textureLod(uAerial0, clamp((p + uAerialHalf.x) / (2.0 * uAerialHalf.x), 0.0, 1.0), 3.0).rgb;
  vec3 outer = textureLod(uAerial1, clamp((p + uAerialHalf.y) / (2.0 * uAerialHalf.y), 0.0, 1.0), 1.0).rgb;
  float useInner = step(abs(p.x), uAerialHalf.x - 3.0) * step(abs(p.y), uAerialHalf.x - 3.0);
  return mix(outer, inner, useInner);
}
// how much to trust it as a tree's colour: vegetation is green before anything else
float twinAerialTrust(vec3 c) {
  return smoothstep(0.0, 0.12, (c.g - max(c.r, c.b)) / max(c.g, 0.003));
}
float twinAerialWeight(float species) {
  return species < 0.5 ? uAerialMix.x : species < 1.5 ? uAerialMix.y : species < 2.5 ? uAerialMix.z : uAerialMix.w;
}
// no lighter than the species can be (a pine is never grass-green): spruce, pine, birch, oak
vec3 twinAerialFit(vec3 c, float species) {
  float top = species < 0.5 ? 0.045 : species < 1.5 ? 0.065 : species < 2.5 ? 0.16 : 0.12;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c * min(1.0, top / max(l, 1e-4));
}
`;

export const WAVES_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform float uPixelAngle;
// a calm fjord: swells of 0.5 to 9 m, steeper with wind
vec3 twinWaveNormal(vec2 p, float dist) {
  vec2 g = vec2(0.0);
  float wind = clamp(uWind / 6.0, 0.15, 1.6);
  float px = dist * uPixelAngle;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float ang = 0.35 + fi * 2.39996;                 // golden angle: no two swells line up
    vec2 d = vec2(cos(ang), sin(ang));
    float L = 9.0 * pow(0.68, fi);                   // wavelength, metres
    float k = 6.2831853 / L;
    float w = sqrt(9.81 * k);                        // deep-water dispersion
    float slope = 0.055 * wind * pow(0.92, fi);
    float fade = clamp(1.0 - px / (0.35 * L), 0.0, 1.0);
    g += d * slope * fade * cos(k * dot(d, p) - w * uTime * 0.6 + fi * 1.7);
  }
  return normalize(vec3(-g.x, 1.0, -g.y));
}
`;

export const SEASON_GLSL = /* glsl */ `
uniform float uWinter;
uniform float uAutumn;
vec3 twinSeason(vec3 c, float forest, float broad) {
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  // greenness relative to the pixel's own brightness (colours here are linear, so greens are dark)
  float green = clamp((c.g - max(c.r, c.b)) / max(c.g, 0.002) * 2.6, 0.0, 1.0);
  float bright = smoothstep(0.04, 0.14, luma);
  // winter: grass and fields to pale olive straw (lighter than summer's deep green), broadleaf
  // canopy to the bare brown-grey of twigs and fallen leaves, conifers stay dark green
  vec3 straw = max(vec3(luma) * 1.45, vec3(0.085)) * vec3(1.12, 1.07, 0.78);
  vec3 bare = vec3(luma) * vec3(0.98, 0.9, 0.9) * 0.92;   // twigs and leaf litter: grey with a purple cast
  c = mix(c, straw, uWinter * green * 0.86 * (1.0 - forest));
  // (broad: the share of birch and oak among the trees here, from the twin's own trees)
  c = mix(c, bare, uWinter * green * mix(0.12, 0.95, broad) * mix(0.55, 1.0, bright) * forest);
  // autumn: a touch of yellow and rust on the bright greens
  vec3 rust = vec3(luma) * vec3(1.35, 1.0, 0.55);
  c = mix(c, rust, uAutumn * green * bright * 0.55 * forest * broad);
  // bare rock and heath look sun-bleached in the summer photo; in winter light they are greyer and darker
  float pale = smoothstep(0.32, 0.55, luma) * (1.0 - green);
  c = mix(c, vec3(luma) * vec3(0.86, 0.85, 0.84), uWinter * pale * 0.55);
  return c;
}
`;

/**
 * The roads from Statens vegvesen's road database, painted into the ground (pipeline/twin_roads.py):
 * per texel the signed distance to the nearest centreline and that road's half width, so the edges
 * are sharp at any distance however coarse the texel; the surface (asphalt, gravel, paving), the
 * markings NVDB records, pedestrian crossings, and the bridges (their decks are 3D, nothing is painted
 * on the water under them). A private road without a recorded surface is left to the aerial photo.
 */
const ROADS_GLSL = /* glsl */ `
{
  vec4 rd = texture2D(uRoads, vMapUv);
  ivec2 tsz = textureSize(uRoads, 0);
  vec4 rn = texelFetch(uRoads, ivec2(clamp(vMapUv, 0.0, 0.99999) * vec2(tsz)), 0);
  int fl = int(rn.b * 255.0 + 0.5);
  int surf = fl & 3;
  if (surf > 0 && rn.g > 0.0 && (fl & 32) == 0) {
    float sd = (rd.r * 255.0 - 128.0) / 8.0;
    float hw = rn.g * 255.0 / 16.0;
    float aa = max(fwidth(sd), 0.015);
    float on = (1.0 - smoothstep(hw - aa, hw + aa, abs(sd))) * (1.0 - twinWater);
    float n1 = twinVNoise(vTwinWorld.xz * 1.9), n2 = twinVNoise(vTwinWorld.xz * 0.23 + 7.0);
    // colours as the aerial photo has them along the roads NVDB records the surface of (median, linear):
    // sunlit asphalt is light grey from the air, gravel darker and greener (grass, shade)
    vec3 asphalt = vec3(0.33, 0.345, 0.28) * (0.9 + 0.12 * n1 + 0.08 * n2);
    vec3 gravel = vec3(0.17, 0.185, 0.13) * (0.85 + 0.2 * n1 + 0.1 * n2);
    vec3 paving = vec3(0.3, 0.3, 0.28) * (0.92 + 0.12 * n1);
    vec3 rc = surf == 1 ? asphalt : (surf == 2 ? gravel : paving);
    // the photo's own wear and shade still show through; the edges of a gravel road blend into the verge
    on *= surf == 2 ? 0.6 * (1.0 - 0.5 * smoothstep(hw - 0.6, hw, abs(sd))) : 0.75;
    if ((fl & 4) != 0) rc = mix(rc, vec3(0.62, 0.42, 0.03), 1.0 - smoothstep(0.06, 0.06 + aa, abs(sd)));
    if ((fl & 8) != 0) rc = mix(rc, vec3(0.78, 0.78, 0.76), 1.0 - smoothstep(0.06, 0.06 + aa, abs(abs(sd) - (hw - 0.35))));
    if ((fl & 16) != 0) rc = mix(rc, vec3(0.8, 0.8, 0.78), smoothstep(0.45, 0.55, rd.a) * step(abs(sd), hw - 0.1));
    diffuseColor.rgb = mix(diffuseColor.rgb, rc, on);
    twinAsphalt = max(twinAsphalt, on * (surf == 1 ? 1.0 : 0.6));
  }
}`;

/**
 * The terrain material: aerial photo, winter grading, and water where the mask says so. With
 * `built` (the graded inner ring), the plan's roads, gardens and fresh slopes are painted over the
 * photo: R asphalt, G garden and verge, B newly graded slope. With `roads`, today's roads (NVDB).
 * With `depth`, the sea's depth from the nautical chart (pipeline/twin_sjokart.py): over shallows the
 * bottom shows through as the aerial photo has it, fading over the first few metres of water (light
 * coming back from the bottom crosses the water twice), and deep water keeps the dark default that
 * lakes and rivers have too. Where a river meets the sea, its brown water spread over the estuary
 * takes the photo's colour as well.
 */
export function terrainMaterial(aerial: THREE.Texture, mask: THREE.Texture, built?: THREE.Texture, roads?: THREE.Texture, depth?: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ map: aerial, roughness: 0.96, metalness: 0, envMapIntensity: 0.55 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uMask = { value: mask };
    if (built) shader.uniforms.uBuilt = { value: built };
    if (roads) shader.uniforms.uRoads = { value: roads };
    if (depth) shader.uniforms.uDepth = { value: depth };
    Object.assign(shader.uniforms, twinUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTwinWorld;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvTwinWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform sampler2D uMask;   // R water, G forest, B broadleaf share of the trees
uniform vec4 uClipHouse;
uniform float uClipOn;
${built ? "uniform sampler2D uBuilt;" : ""}
${roads ? "uniform sampler2D uRoads;" : ""}
${depth ? "uniform sampler2D uDepth;   // R: 250 m * R^2 below the chart datum (1 where the chart has none); G: river water at the mouths" : ""}
varying vec3 vTwinWorld;
${WAVES_GLSL}
${SEASON_GLSL}
float twinWater;
float twinAsphalt;
float twinNoise(vec2 p) { return fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453); }
float twinVNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(twinNoise(i), twinNoise(i + vec2(1.0, 0.0)), u.x), mix(twinNoise(i + vec2(0.0, 1.0)), twinNoise(i + vec2(1.0, 1.0)), u.x), u.y);
}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
// inside the visited house's walls the house's own floors stand in for the ground
if (uClipOn > 0.5) {
  vec2 cd = vec2(vTwinWorld.x - uClipHouse.x, -(vTwinWorld.z - uClipHouse.y));
  float cu = cd.x * uClipHouse.z - cd.y * uClipHouse.w, cv = cd.x * uClipHouse.w + cd.y * uClipHouse.z;
  if (abs(cu) < 5.48 && abs(cv) < 4.23) discard;
}
vec3 twinMask = texture2D(uMask, vMapUv).rgb;
twinWater = smoothstep(0.35, 0.65, twinMask.r);
vec3 twinPhoto = diffuseColor.rgb;   // the water's own colour in the photo: no winter for the sea bed
diffuseColor.rgb = twinSeason(diffuseColor.rgb, twinMask.g, twinMask.b);
// near the camera the aerial photo (30 cm a pixel) is soft: a little ground texture (tufts, stones,
// litter) breaks it up; it fades out before it could be seen as a pattern
float twinNear = 1.0 - smoothstep(25.0, 140.0, length(vTwinWorld - cameraPosition));
if (twinNear > 0.001) {
  vec2 gp = vTwinWorld.xz;
  float grain = 0.55 * twinVNoise(gp * 2.7) + 0.3 * twinVNoise(gp * 8.3 + 13.0) + 0.15 * twinVNoise(gp * 0.8 + 41.0);
  diffuseColor.rgb *= mix(1.0, 0.74 + 0.52 * grain, twinNear * (1.0 - twinWater));
}
// humic river and fjord water: dark, with a little of the photo's own colour
vec3 waterBase = mix(vec3(0.020, 0.045, 0.055), twinPhoto * 0.55, 0.22);
${depth ? `{
  vec2 dp = texture2D(uDepth, vMapUv).rg;
  float dm = 250.0 * dp.r * dp.r;
  // the bottom through the water, as the photo shows it, gone by about 5 m; at a river mouth the
  // river's brown water on the sea (dp.g)
  waterBase = mix(waterBase, twinPhoto, 0.9 * max(exp(-dm / 1.8), dp.g));
}` : ""}
diffuseColor.rgb = mix(diffuseColor.rgb, waterBase, twinWater);
twinAsphalt = 0.0;
${roads ? ROADS_GLSL : ""}
${built ? `
vec3 bm = texture2D(uBuilt, vMapUv).rgb;
float grain = twinNoise(vTwinWorld.xz * 2.0) * 0.5 + twinNoise(vTwinWorld.xz * 0.5) * 0.5;
vec3 soil = mix(vec3(0.13, 0.12, 0.1), mix(vec3(0.07, 0.1, 0.04), vec3(0.16, 0.14, 0.09), uWinter), 0.5) * (0.8 + 0.4 * grain);
vec3 lawn = mix(vec3(0.075, 0.13, 0.04), vec3(0.2, 0.17, 0.09), uWinter) * (0.85 + 0.3 * grain);
vec3 asphalt = vec3(0.028, 0.029, 0.032) * (0.9 + 0.2 * grain);
diffuseColor.rgb = mix(diffuseColor.rgb, soil, bm.b * 0.55);
diffuseColor.rgb = mix(diffuseColor.rgb, lawn, bm.g * 0.92);
diffuseColor.rgb = mix(diffuseColor.rgb, asphalt, bm.r);
twinAsphalt = bm.r;` : ""}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
float twinDist = length(vTwinWorld - cameraPosition);
roughnessFactor = mix(roughnessFactor, mix(0.035, 0.16, smoothstep(400.0, 6000.0, twinDist)), twinWater);
roughnessFactor = mix(roughnessFactor, ${roads ? "0.9" : "0.72"}, twinAsphalt);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
if (twinWater > 0.01) {
  vec3 wn = twinWaveNormal(vTwinWorld.xz, twinDist);
  vec3 wv = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  normal = normalize(mix(normal, wv, twinWater));
}`);
  };
  m.customProgramCacheKey = () => `twin-terrain-v2${built ? "-built" : ""}${roads ? "-roads" : ""}${depth ? "-depth" : ""}`;
  return m;
}

/** Open sea beyond the outermost ring: water only. */
export function oceanMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.02, 0.045, 0.055), roughness: 0.08, metalness: 0, envMapIntensity: 1 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, twinUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTwinWorld;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvTwinWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vTwinWorld;\n${WAVES_GLSL}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
float twinDist = length(vTwinWorld - cameraPosition);
roughnessFactor = mix(0.04, 0.2, smoothstep(2000.0, 30000.0, twinDist));`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
normal = normalize((viewMatrix * vec4(twinWaveNormal(vTwinWorld.xz, twinDist), 0.0)).xyz);`);
  };
  m.customProgramCacheKey = () => "twin-ocean-v1";
  return m;
}
