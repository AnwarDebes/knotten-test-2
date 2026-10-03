import type * as THREE from "three";

/**
 * Shadows are re-rendered only when something that casts them has changed (the sun, the state of
 * the field, the trees near the camera), not on every frame: the shadow pass is the most expensive
 * part of the frame on a laptop GPU.
 */
let dirty = 2;

export function markShadowsDirty(frames = 2) {
  dirty = Math.max(dirty, frames);
}

/** True when the shadow map should be rendered this frame. */
export function takeShadowsDirty() {
  if (dirty > 0) {
    dirty--;
    return true;
  }
  return false;
}

/** The sun, the one light that casts shadows (set by Atmosphere), so the renderer can keep a shadow map per side of the wipe. */
let sun: THREE.DirectionalLight | null = null;
export function setSunLight(l: THREE.DirectionalLight | null) {
  sun = l;
}
export function sunLight() {
  return sun;
}
