/**
 * Far trees are drawn as two crossed cards (one upright, one lying flat for views from above),
 * painted from the same meshes the near trees use. The painting (an "impostor atlas") is made on
 * the GPU when the scene opens and again when the season changes: 4 species x 2 views, colour with
 * leaf density in alpha, and the surface normals, so the cards are lit by the real sun like the
 * 3D trees next to them.
 */
import * as THREE from "three";
import { TREE_AERIAL_GLSL, treeAerial } from "./materials";

export const CELL = 192;   // pixels per atlas cell

const bakeVert = /* glsl */ `
attribute vec3 color;
varying vec3 vColor;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vColor = color;
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Bake shaders: the same colour logic as the trees' own materials (TwinForest.foliageMaterial). */
function bakeMaterial(kind: "albedo" | "normal", leaf: boolean) {
  const leafLogic = `
    vec4 fol = texture2D(map, vUv);
    float twig = 1.0 - step(0.03, fol.b);
    if (twig < 0.5 && fol.b > uDensity + 0.001) discard;
    if (fol.a < 0.45) discard;`;
  const albedo = leaf
    ? "gl_FragColor = vec4(mix(uLeafColor, uTwigColor, twig) * (0.35 + 0.75 * fol.r) * vColor, 1.0);"
    : "gl_FragColor = vec4(vColor, 1.0);";
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, uLeafColor: { value: new THREE.Color() }, uTwigColor: { value: new THREE.Color() }, uDensity: { value: 1 } },
    vertexShader: bakeVert,
    fragmentShader: `uniform sampler2D map; uniform vec3 uLeafColor; uniform vec3 uTwigColor; uniform float uDensity;
      varying vec3 vColor; varying vec3 vN; varying vec2 vUv;
      void main() {
        ${leaf ? leafLogic : ""}
        ${kind === "albedo" ? albedo : `vec3 n = normalize(vN); gl_FragColor = vec4(n * 0.5 + 0.5, ${leaf ? "twig > 0.5 ? 0.0 : clamp((0.35 + 0.75 * fol.r) * vColor.r, 0.02, 1.0)" : "0.0"});`}
      }`,
    side: leaf ? THREE.DoubleSide : THREE.FrontSide,
    blending: THREE.NoBlending,
  });
}

export type Atlas = { albedo: THREE.WebGLRenderTarget; normal: THREE.WebGLRenderTarget };

// the bake's four materials live as long as the page: a change of month bakes again with the programs already built
let bakeMats: { albedo: THREE.ShaderMaterial[]; normal: THREE.ShaderMaterial[] } | null = null;

/** The atlas's two render targets (colour and normals), empty until bakeAtlas paints them. */
export function createAtlas(): Atlas {
  const make = () => {
    const rt = new THREE.WebGLRenderTarget(CELL * 4, CELL * 2, { type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    rt.texture.colorSpace = THREE.NoColorSpace;
    return rt;
  };
  return { albedo: make(), normal: make() };
}

/** Paint the atlas with each species' foliage cards, leaf colour, twig colour and leaf density. */
export function bakeAtlas(gl: THREE.WebGLRenderer, geoms: THREE.BufferGeometry[], maps: THREE.Texture[], fol: { leaf: THREE.Color[]; twig: THREE.Color[]; density: number[] }, atlas: Atlas) {
  const scene = new THREE.Scene();
  bakeMats ??= {
    albedo: [bakeMaterial("albedo", false), bakeMaterial("albedo", true)],
    normal: [bakeMaterial("normal", false), bakeMaterial("normal", true)],
  };
  const mats = bakeMats;
  const mesh = new THREE.Mesh(geoms[0], mats.albedo);
  scene.add(mesh);
  const side = new THREE.OrthographicCamera(-1.02, 1.02, 1.02, -0.02, 0.1, 10);
  side.position.set(0, 0, 4);
  side.lookAt(0, 0, 0);
  const top = new THREE.OrthographicCamera(-1.02, 1.02, 1.02, -1.02, 0.1, 10);
  top.position.set(0, 4, 0);
  top.up.set(0, 0, -1);
  top.lookAt(0, 0, 0);

  const prev = { target: gl.getRenderTarget(), clear: gl.getClearColor(new THREE.Color()), alpha: gl.getClearAlpha(), autoClear: gl.autoClear, scissor: gl.getScissorTest() };
  gl.autoClear = false;
  for (const kind of ["albedo", "normal"] as const) {
    const rt = atlas[kind];
    rt.viewport.set(0, 0, rt.width, rt.height);
    rt.scissorTest = false;
    gl.setRenderTarget(rt);
    // transparent, but with a crown-like colour so mip levels do not darken the edges
    gl.setClearColor(kind === "albedo" ? 0x0e140c : 0x8080ff, 0);
    gl.clear(true, true, true);
    for (let k = 0; k < geoms.length; k++) {
      mesh.geometry = geoms[k];
      mesh.material = mats[kind];
      const u = mats[kind][1].uniforms;
      u.map.value = maps[k];
      (u.uLeafColor.value as THREE.Color).copy(fol.leaf[k]);
      (u.uTwigColor.value as THREE.Color).copy(fol.twig[k]);
      u.uDensity.value = fol.density[k];
      for (let v = 0; v < 2; v++) {
        // each cell through the target's own viewport and scissor, in the target's pixels: the renderer's
        // setViewport and setScissor multiply by the screen's pixel ratio, which on a screen scaled above 100 %
        // drew the cells shifted and too large, over each other and partly outside the atlas
        rt.viewport.set(k * CELL, v * CELL, CELL, CELL);
        rt.scissor.set(k * CELL, v * CELL, CELL, CELL);
        rt.scissorTest = true;
        gl.setRenderTarget(rt);
        gl.clearDepth();
        gl.render(scene, v === 0 ? side : top);
      }
    }
    rt.viewport.set(0, 0, rt.width, rt.height);
    rt.scissor.set(0, 0, rt.width, rt.height);
    rt.scissorTest = false;
  }
  gl.setScissorTest(prev.scissor);
  gl.setRenderTarget(prev.target);
  gl.setClearColor(prev.clear, prev.alpha);
  gl.autoClear = prev.autoClear;
  const size = gl.getSize(new THREE.Vector2());
  gl.setViewport(0, 0, size.x, size.y);
}

/** The card mesh: two quads per tree (upright, flat), positioned in the vertex shader. */
export function cardGeometry(count: number, pos: Float32Array, dim: Float32Array, info: Float32Array) {
  const g = new THREE.InstancedBufferGeometry();
  // corner x, corner y, which card (0 upright, 1 flat)
  const corner = new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1]);
  g.setAttribute("position", new THREE.BufferAttribute(corner, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  g.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute("iDim", new THREE.InstancedBufferAttribute(dim, 2));
  g.setAttribute("iInfo", new THREE.InstancedBufferAttribute(info, 4));
  g.instanceCount = count;
  return g;
}

/** Lit, fogged, shadowed cards: a standard material whose vertices and normals come from the atlas. */
export function cardMaterial(atlas: Atlas, uniforms: { uNear: { value: number }; uTime: { value: number }; uClear?: { value: THREE.Vector4 }; uClearOn?: { value: number } }) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, envMapIntensity: 0.6 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, treeAerial);
    shader.uniforms.uAlbedo = { value: atlas.albedo.texture };
    shader.uniforms.uNormalAtlas = { value: atlas.normal.texture };
    shader.uniforms.uNear = uniforms.uNear;
    shader.uniforms.uClear = uniforms.uClear ?? { value: new THREE.Vector4() };
    shader.uniforms.uClearOn = uniforms.uClearOn ?? { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
attribute vec3 iPos; attribute vec2 iDim; attribute vec4 iInfo;
uniform float uNear;
uniform vec4 uClear;
uniform float uClearOn;
varying vec2 vCardUv; varying float vCardFade; varying vec4 vCardInfo; varying float vCardKind;
varying vec3 vCardR; varying vec3 vCardU; varying vec3 vCardF;
varying vec3 vCardAerial; varying float vCardAerialW;
${TREE_AERIAL_GLSL}`)
      .replace("#include <beginnormal_vertex>", `
vec3 cBase = iPos; float cH = iDim.x; float cR = iDim.y;
vec3 cMid = cBase + vec3(0.0, cH * 0.6, 0.0);
vec3 toCam = cameraPosition - cMid;
float cDist = length(toCam);
float elev = clamp(toCam.y / max(cDist, 0.001), 0.0, 1.0);
float topW = smoothstep(0.42, 0.86, elev);
vec3 fwd = normalize(vec3(toCam.x, 0.0, toCam.z) + vec3(1e-5, 0.0, 0.0));
vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
float flip = iInfo.z > 3.14159 ? -1.0 : 1.0;   // mirror half of the trees: no two look alike
vec3 objectNormal;
vec3 cardPos;
if (position.z < 0.5) {
  cardPos = cBase + right * (position.x * cR * 1.04) + vec3(0.0, position.y * cH * 1.02 - 0.02 * cH, 0.0);
  vCardUv = vec2(position.x * flip * 0.5 + 0.5, position.y);
  vCardFade = 1.0 - topW;
  vCardR = right * flip; vCardU = vec3(0.0, 1.0, 0.0); vCardF = fwd;
} else {
  float c = cos(iInfo.z), s = sin(iInfo.z);
  vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * cR * 1.04;
  cardPos = cBase + vec3(q.x, cH * 0.82, -q.y);
  vCardUv = vec2(position.x * 0.5 + 0.5, position.y * 0.5 + 0.5);
  vCardFade = topW;
  vCardR = vec3(c, 0.0, -s); vCardU = vec3(-s, 0.0, -c); vCardF = vec3(0.0, 1.0, 0.0);
}
vCardFade *= smoothstep(uNear - 45.0, uNear, cDist);
if (uClearOn > 0.5 && cBase.x > uClear.x && cBase.x < uClear.z && cBase.z > uClear.y && cBase.z < uClear.w) vCardFade = 0.0;
if (vCardFade < 0.004) cardPos = vec3(0.0, -9999.0, 0.0);
vCardInfo = iInfo; vCardKind = position.z;
// a folded card (the other one of the pair is the one seen from here, or the tree is near enough to be 3D) has
// no area and draws nothing: its photo colour is not looked up (two texture reads for half the cards)
if (vCardFade >= 0.004) {
  vec3 cardAerialRaw = twinAerialAt(vec2(cBase.x, -cBase.z)) * uAerialGain;
  vCardAerialW = twinAerialWeight(iInfo.x) * twinAerialTrust(cardAerialRaw);
  vCardAerial = twinAerialFit(cardAerialRaw, iInfo.x);
} else {
  vCardAerialW = 0.0;
  vCardAerial = vec3(0.0);
}
objectNormal = vCardF;`)
      .replace("#include <begin_vertex>", "vec3 transformed = cardPos;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform sampler2D uAlbedo; uniform sampler2D uNormalAtlas;
varying vec2 vCardUv; varying float vCardFade; varying vec4 vCardInfo; varying float vCardKind;
varying vec3 vCardR; varying vec3 vCardU; varying vec3 vCardF;
varying vec3 vCardAerial; varying float vCardAerialW;
vec2 cardAtlasUv() { return (vec2(vCardInfo.x, vCardKind) + clamp(vCardUv, 0.004, 0.996)) / vec2(4.0, 2.0); }`)
      .replace("#include <map_fragment>", `
vec4 cardAlb = texture2D(uAlbedo, cardAtlasUv());
float cardA = cardAlb.a * vCardFade;
float cardHash = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
if (cardA < max(cardHash, 0.06)) discard;
float tint = vCardInfo.y;
// leaves: the photo's colour at the tree on the painted shading (kept in the normal atlas's alpha)
float cardShade = texture2D(uNormalAtlas, cardAtlasUv()).a;
vec3 cardCol = cardAlb.rgb;
float cardW = cardShade > 0.02 ? vCardAerialW : 0.0;
cardCol = mix(cardCol, vCardAerial * cardShade, cardW);
diffuseColor.rgb = cardCol * mix(mix(vec3(0.82, 0.86, 0.9), vec3(1.14, 1.12, 1.02), tint), vec3(1.0), 0.6 * cardW);`)
      .replace("#include <normal_fragment_maps>", `
vec3 cardN = texture2D(uNormalAtlas, cardAtlasUv()).xyz * 2.0 - 1.0;
vec3 cardNW = normalize(vCardR * cardN.x + vCardU * cardN.y + vCardF * max(cardN.z, 0.05));
normal = normalize((viewMatrix * vec4(cardNW, 0.0)).xyz);`)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.indirectSpecular *= 0.15;\nreflectedLight.directSpecular *= 0.35;");
  };
  m.customProgramCacheKey = () => "twin-cards-v3";
  return m;
}
