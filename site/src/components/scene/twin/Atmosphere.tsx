"use client";
/* eslint-disable react-hooks/immutability -- react-three-fiber's own pattern: lights, fog and the environment are three.js objects, changed in effects outside React's render */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { solarPosition } from "@/lib/solar";
import { markShadowsDirty, setSunLight } from "./shadowState";
import { twinUniforms } from "./materials";
import { cloudDome, cloudUniforms } from "./clouds";
import { houseUniforms } from "../house/materials";

export type Weather = { clouds: number; wind: number };

/** Direction to the sun in three.js axes for a moment at Knotten. */
export function sunDirection(date: Date) {
  const { elevation, azimuth } = solarPosition(date);
  const el = (elevation * Math.PI) / 180, az = (azimuth * Math.PI) / 180;
  return { dir: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)), elevation, azimuth };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Dims the clear-sky model behind a closed cloud deck (its glow round a low sun must not leak). */
const skyDim = { value: 1 };

/**
 * The clear-sky model (Preetham). Its own cloud layer is switched off: the clouds are the deck in
 * clouds.ts, which follows the weather and lights the scene.
 */
function makeSky(scale: number) {
  const s = new Sky();
  s.scale.setScalar(scale);
  const m = s.material;
  if (m.uniforms.cloudCoverage) m.uniforms.cloudCoverage.value = 0;
  const out = "gl_FragColor = vec4( texColor, 1.0 );";
  if (m.fragmentShader.includes(out)) {
    m.uniforms.skyDim = skyDim;
    m.fragmentShader = `uniform float skyDim;\n${m.fragmentShader.replace(out, "gl_FragColor = vec4( texColor * skyDim, 1.0 );")}`;
  }
  return s;
}

/** Colour of the haze at the horizon, by sun height and cloud cover (a fit to the sky model). */
function hazeColour(elev: number, clouds: number) {
  const day = new THREE.Color(0.76, 0.83, 0.9);
  const low = new THREE.Color(0.86, 0.8, 0.74);
  const dusk = new THREE.Color(0.36, 0.37, 0.46);
  const night = new THREE.Color(0.018, 0.026, 0.05);
  const grey = new THREE.Color(0.74, 0.76, 0.79);
  const c = new THREE.Color();
  if (elev >= 12) c.copy(day);
  else if (elev >= 2) c.copy(low).lerp(day, smooth(2, 12, elev));
  else if (elev >= -6) c.copy(dusk).lerp(low, smooth(-6, 2, elev));
  else c.copy(night).lerp(dusk, smooth(-14, -6, elev));
  const light = smooth(-8, 10, elev);
  c.lerp(grey.clone().multiplyScalar(0.03 + 0.97 * light), clouds * 0.8);
  return c;
}

/**
 * Sky, sun and air for a moment at Knotten: the sun where it really is (NOAA position, same as
 * the sun passports), a physical sky that follows it, the sky as the environment light for every
 * material (so water and glass reflect it), and haze that thickens with distance and cloud.
 */
export function Atmosphere({ date, weather, shadows, quality = "full" }: { date: Date; weather?: Weather; shadows: boolean; quality?: "full" | "lite" }) {
  const { gl, scene, camera } = useThree();
  const clouds = Math.min(1, Math.max(0, weather?.clouds ?? 0.25));
  const sun = useMemo(() => sunDirection(date), [date]);
  const light = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  // the light aims at the middle of the field; the target must be in the scene to update its matrix
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(60, 40, 0); return o; }, []);

  // drawn after the solid ground and buildings (it writes no depth and sits on the far plane): its sky model is then
  // worked out only where the sky is seen, not first under everything that covers it
  const sky = useMemo(() => { const s = makeSky(450000); s.renderOrder = 10; return s; }, []);
  const dome = useMemo(() => cloudDome(), []);
  // the camera's exposure: the sky's own (set below with the sun) times the eye's adaptation indoors
  const baseExposure = useRef(0.92);
  useFrame(() => {
    dome.position.copy(camera.position);
    gl.toneMappingExposure = baseExposure.current * twinUniforms.uExposureBoost.value;
  });
  const env = useMemo(() => {
    const s = makeSky(1000);
    const sc = new THREE.Scene();
    sc.add(s);
    sc.add(cloudDome());   // the clouds light the scene too: an overcast day is grey and soft
    return { sky: s, scene: sc, pmrem: new THREE.PMREMGenerator(gl), rt: null as THREE.WebGLRenderTarget | null, key: "" };
  }, [gl]);

  // sky parameters: clear and blue at noon, warm and low at dusk, white and flat when overcast
  useEffect(() => {
    const up = Math.max(sun.elevation, -12);
    const sunPos = sun.dir.clone().setY(Math.sin((up * Math.PI) / 180));
    for (const s of [sky, env.sky]) {
      const u = s.material.uniforms;
      // the clouds themselves are the cloud deck (clouds.ts); the clear sky between them stays blue
      u.turbidity.value = lerp(2.6, 4, clouds);
      u.rayleigh.value = lerp(lerp(1.15, 2.2, 1 - smooth(-2, 25, up)), 1.3, clouds);
      u.mieCoefficient.value = lerp(0.0045, 0.006, clouds);
      u.mieDirectionalG.value = lerp(0.8, 0.6, clouds);
      u.sunPosition.value.copy(sunPos);
    }
    const daylight = smooth(-7, 8, sun.elevation);
    // the cloud deck: lit from above by the full sun, grey from below when it closes
    const strength0 = smooth(-4, 30, sun.elevation);
    cloudUniforms.uCover.value = clouds;
    cloudUniforms.uSunDir.value.copy(sun.dir).normalize();
    cloudUniforms.uSunCol.value.setHSL(0.08, lerp(0.55, 0.12, strength0), 0.5).multiplyScalar(lerp(0.5, 2.4, strength0) * daylight);
    cloudUniforms.uSkyCol.value.setRGB(0.5, 0.6, 0.78).lerp(new THREE.Color(0.6, 0.63, 0.7), clouds).multiplyScalar(lerp(0.03, 1, daylight));
    cloudUniforms.uDay.value = smooth(-9, 2, sun.elevation);
    skyDim.value = lerp(1, 0.3, smooth(0.45, 0.85, clouds));
    // the sun's disc in the sky light (part of the day's ambient light) goes behind a closing deck
    env.sky.material.uniforms.showSunDisc.value = Math.pow(1 - smooth(0.45, 0.85, clouds), 3);
    dome.visible = sun.elevation > -10;
    // after dusk the sky model goes black; the night sky is a deep blue glow instead (the clear colour)
    sky.visible = sun.elevation > -5;
    twinUniforms.uNight.value = 1 - smooth(-6, 3, sun.elevation);
    twinUniforms.uSunWorld.value.copy(sun.dir).normalize();
    // how bright a room behind a window looks from outside by day (the houses' glass)
    houseUniforms.uDaylight.value = smooth(-4, 20, sun.elevation) * lerp(1, 0.55, clouds);
    // the clear-sky model is HDR and bright: as ambient light it is scaled down to sit beside the
    // sun. Under a closed deck the sky is the only light, and the drawn clouds are the light that
    // reaches the ground: the scene is lit by them as they are (the ground then comes out about a
    // sixth as bright as the cloud above, as under a real overcast sky), with a camera's longer exposure
    const deck = smooth(0.45, 0.85, clouds);
    scene.environmentIntensity = lerp(0.02, lerp(0.14 * lerp(1, 2.2, clouds), 0.95, deck), daylight);
    // a camera's exposure: longer on a grey day, and much longer in the hour round sunrise and sunset,
    // when the light falls a hundredfold and the eye still sees the land (the night look is unchanged)
    // (under a closed deck the light does not follow the sun's height until it is near the horizon;
    // in December the sun at Knotten never climbs above 8.6 degrees)
    const clearTwilight = smooth(-7, -1, sun.elevation) * (1 - smooth(3, 14, sun.elevation));
    const deckTwilight = smooth(-7, -1, sun.elevation) * (1 - smooth(-2, 6, sun.elevation));
    const twilight = lerp(clearTwilight, deckTwilight, deck);
    baseExposure.current = 0.92 * lerp(1, lerp(1, 1.45, deck), daylight) * (1 + 1.6 * twilight);
    const haze = hazeColour(sun.elevation, clouds);
    cloudUniforms.uHaze.value.copy(haze);
    if (scene.fog instanceof THREE.FogExp2) { scene.fog.color.copy(haze); scene.fog.density = lerp(2.4e-5, 6.5e-5, clouds); }
    else scene.fog = new THREE.FogExp2(haze, lerp(2.4e-5, 6.5e-5, clouds));
    gl.setClearColor(haze);
    // the environment map (after the clouds and haze above are set: it is a picture of them) is
    // rebuilt only when the sky has visibly changed
    // (coarse key: during playback the sun moves every step; the sky light needs a new map only every degree or so)
    const key = `${Math.round(sun.elevation * 1.5)}|${Math.round(sun.azimuth / 4)}|${Math.round(clouds * 10)}`;
    if (key !== env.key) {
      env.key = key;
      const rt = env.pmrem.fromScene(env.scene, 0, 0.1, 2000);
      env.rt?.dispose();
      env.rt = rt;
      scene.environment = rt.texture;
    }

    const L = light.current;
    if (L) {
      const above = sun.elevation > -0.5;
      const strength = smooth(-0.5, 25, sun.elevation);
      // direct sun through broken cloud falls off faster than the cover grows; under a closed deck
      // (the same closing as the drawn clouds) the sun is hidden, and so are its glints on the water
      const beam = lerp(1, 0.2, clouds) * (1 - deck) * (1 - deck);
      L.intensity = above ? lerp(1.0, 3.1, strength) * beam : 0;
      L.color.setHSL(0.09, lerp(0.3, 0.08, strength), lerp(0.72, 0.95, strength));
      L.position.copy(sun.dir).multiplyScalar(8000).add(L.target.position);
      L.castShadow = shadows && above && beam > 0.12;
      L.shadow.camera.layers.enable(1);   // tree shadow stand-ins live on layer 1 (shadows only)
      L.shadow.radius = lerp(1.5, 6, clouds);
    }
    const H = hemi.current;
    if (H) {
      // under a deck: soft fill from the whole bright sky (diffuse only, so reflections stay true to
      // the clouds), as the eye and a camera's tone curve lift a grey day's shadows
      H.intensity = lerp(0.09, lerp(0.3 * lerp(1, 1.8, clouds), 2.2, deck), daylight);
      H.color.copy(haze).lerp(new THREE.Color(0.7, 0.78, 0.88), 0.35 * (1 - clouds)).lerp(new THREE.Color(0.74, 0.77, 0.82), deck);
      H.groundColor.setRGB(0.18, 0.2, 0.16).multiplyScalar(0.3 + 0.7 * daylight);
    }
    markShadowsDirty();
  }, [sun, clouds, sky, env, scene, gl, shadows, dome]);

  useEffect(() => () => { env.rt?.dispose(); env.pmrem.dispose(); scene.environment = null; scene.fog = null; }, [env, scene]);
  // the renderer keeps a shadow map per side of the wipe, on this light
  useEffect(() => { setSunLight(light.current); return () => setSunLight(null); }, []);

  const size = quality === "full" ? 4096 : 2048;
  return (
    <group>
      <primitive object={sky} />
      <primitive object={dome} />
      <hemisphereLight ref={hemi} args={["#cfd9e0", "#3a4a3f", 0.8]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={3}
        shadow-mapSize={[size, size]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.9}
        shadow-camera-near={100}
        shadow-camera-far={16000}
        shadow-camera-left={-1050}
        shadow-camera-right={1050}
        shadow-camera-top={1050}
        shadow-camera-bottom={-1050}
      />
    </group>
  );
}
