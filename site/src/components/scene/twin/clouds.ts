/**
 * A cloud deck over Knotten: one layer at about 1.4 km on a curved earth (so it closes in toward
 * the horizon the way real cloud does), drawn behind everything like the sky itself. Cover follows
 * the weather (the share of a clear sky's light that did not reach the ground); the clouds drift
 * with the wind, are lit by the sun from above, have darker bases where they are thick and a bright
 * rim toward the sun. Under full cover they close into a grey stratus deck, as on the owner's
 * winter photo, instead of the washed-out white of a clear-sky model with haze turned up.
 */
import * as THREE from "three";
import { twinUniforms } from "./materials";

export const cloudUniforms = {
  uCover: { value: 0.25 },                        // 0 clear .. 1 overcast
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },     // sunlight above the clouds (linear)
  uSkyCol: { value: new THREE.Color(0.5, 0.6, 0.75) }, // light from the sky dome
  uHaze: { value: new THREE.Color(0.75, 0.8, 0.86) },  // the horizon haze (fog colour)
  uDay: { value: 1 },
  uTime: twinUniforms.uTime,
  uWind: twinUniforms.uWind,
};

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w;   // on the far plane, like the sky
}`;

const fragment = /* glsl */ `
uniform float uCover;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform vec3 uHaze;
uniform float uDay;
uniform float uTime;
uniform float uWind;
varying vec3 vDir;

float h2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p, int oct) {
  float a = 0.5, s = 0.0;
  mat2 R = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * vnoise(p); p = R * p; a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  if (d.y <= 0.0) discard;
  // the deck on a curved earth: where the ray meets a shell 1400 m up
  const float R = 6371000.0, H = 1400.0;
  vec3 o = vec3(0.0, R + max(cameraPosition.y, 0.0), 0.0);
  float b = dot(o, d), c = dot(o, o) - (R + H) * (R + H);
  float t = -b + sqrt(max(b * b - c, 0.0));
  vec2 p = cameraPosition.xz + d.xz * t;
  // drift with the wind at cloud height (about twice the 10 m wind), toward the north-east
  vec2 drift = vec2(0.8, -0.6) * uTime * max(uWind, 1.0) * 2.0;
  // heavy cover: the clouds close into a stratus deck with a soft texture
  float deck = smoothstep(0.45, 0.85, uCover);
  // fair-weather cumulus are big separate heaps; a deck is rolls a few hundred metres across
  vec2 q = (p + drift) / mix(2600.0, 1300.0, deck);
  int oct = t > 40000.0 ? 4 : 6;                    // far away the fine detail is below a pixel anyway
  vec2 warp = vec2(fbm(q * 0.7 + 3.1, 3), fbm(q * 0.7 + 8.7, 3));
  float n = fbm(q + warp * 0.9, oct);
  float th = mix(0.74, 0.20, uCover);
  float dens = smoothstep(th, th + 0.2, n);
  dens = mix(dens, 1.0, deck);
  // light: thinner toward the sun means brighter; thick cloud has a darker base
  vec2 toSun = normalize(uSunDir.xz + vec2(1e-4)) * 0.35;
  float n2 = fbm(q + warp * 0.9 + toSun, oct - 1);
  float lit = 1.0 - 0.75 * smoothstep(th - 0.05, th + 0.35, n2);
  // seen from below, cloud is lit by the sky around it: a neutral, slightly cool grey; sunlight
  // colours only thin cloud and the edges of broken cloud, never a closed deck
  float sunAmount = (1.0 - deck) * (1.0 - 0.6 * dens);
  vec3 col = uSkyCol * 1.05 * mix(1.0, 0.78, dens * (1.0 - lit)) + uSunCol * lit * 2.0 * sunAmount;
  col *= mix(1.0, 0.52, uCover * uCover);
  // a closed deck is not flat: rolls of thicker, darker cloud with lighter seams between them
  col *= mix(1.0, mix(1.32, 0.66, smoothstep(0.3, 0.7, n)), deck);
  // the bright rim of thin cloud toward the sun
  float mu = max(dot(d, uSunDir), 0.0);
  col += uSunCol * pow(mu, 12.0) * (1.0 - dens) * 1.6 * (1.0 - deck);
  // toward the horizon the deck fades into the haze, as the fog does on the ground
  float far = smoothstep(0.22, 0.0, d.y);
  col = mix(col, uHaze, far * 0.75);
  float alpha = dens * mix(smoothstep(0.0, 0.035, d.y), 1.0, deck);   // a closed deck reaches the horizon
  gl_FragColor = vec4(col * max(uDay, 0.04), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function cloudMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    toneMapped: true,
  });
}

/** The cloud dome: a sphere around the camera (the shader puts it on the far plane). */
export function cloudDome() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), cloudMaterial());
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}
