/** WebGL 2, which the model needs: switched off in some browsers, missing with some old graphics drivers. */
export function has3d() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}
