/*
 * The landing page's fly-in (site/public/renders/knotten_flyin_720p.mp4), recorded from the live 3D
 * model: over the Audna from the south-east, over the field's terraces, and round to the view south
 * over the river mouth to the sea. 12 s at 24 frames a second, the built field, 21 June at 15:00.
 *
 * How to record it again:
 *   1. Run the site (npm run dev) and open http://localhost:3000/no/tomter?twindebug
 *   2. When the model is in, paste this file into the browser console. It defines flyAt(sec) and
 *      flyBatch(i0, i1), which returns frames i0..i1-1 as JPEG data URLs (JSON).
 *   3. Save the frames as f0000.jpg .. f0287.jpg (for example with Playwright's evaluate and a file),
 *      then encode at the same size as before:
 *        ffmpeg -framerate 24 -i f%04d.jpg -c:v libx264 -preset slow -b:v 7300k -pass 1 -an -f mp4 NUL
 *        ffmpeg -framerate 24 -i f%04d.jpg -c:v libx264 -preset slow -b:v 7300k -maxrate 11000k -bufsize 14000k \
 *               -pass 2 -pix_fmt yuv420p -movflags +faststart knotten_flyin_720p.mp4
 * The poster (renders/site_after.png, the stage's first frame) is the "fjord" camera:
 *   __twin.date(6, 15, 0.25); __twin.view([293.75, 150, 1500.96], [33.75, 74.44, 0.96], 48);
 *   __twin.still({ w: 1920, h: 1080, state: "built" })
 */
(() => {
  const t = window.__twin;
  // key frames: seconds, camera and target as local metres (x east, y north, height above sea level)
  const K = [
    { s: 0.0, p: [760, -1350, 560], q: [34, 0, 64] },
    { s: 3.5, p: [470, -760, 340], q: [34, 0, 64] },
    { s: 6.5, p: [265, -330, 235], q: [30, 0, 66] },
    { s: 8.6, p: [135, -150, 178], q: [24, 10, 70] },
    { s: 10.4, p: [70, 40, 150], q: [60, -200, 50] },
    { s: 12.0, p: [10, 84, 128], q: [40, -380, 25] },
  ];
  const ease = (u) => u * u * (3 - 2 * u);
  const cr = (a, b, c, d, u) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  const flyAt = (sec) => {
    const T = ease(sec / 12) * 12;
    let i = 0;
    while (i < K.length - 2 && T > K[i + 1].s) i++;
    const u = Math.min(1, Math.max(0, (T - K[i].s) / (K[i + 1].s - K[i].s)));
    const g = (k) => K[Math.max(0, Math.min(K.length - 1, k))];
    const P = [0, 1, 2].map((j) => cr(g(i - 1).p[j], g(i).p[j], g(i + 1).p[j], g(i + 2).p[j], u));
    const Q = [0, 1, 2].map((j) => cr(g(i - 1).q[j], g(i).q[j], g(i + 1).q[j], g(i + 2).q[j], u));
    return { pos: [P[0], P[2], -P[1]], tgt: [Q[0], Q[2], -Q[1]] };   // three.js axes
  };
  // the shared animation clock: pinned per frame, so clouds and wind move at real speed in the film
  let terrain = null;
  t.scene.traverse((o) => { if (!terrain && o.isMesh && o.name === "terrain-r1") terrain = o.material; });
  const clock = t.gl.properties.get(terrain).uniforms.uTime;
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  const toJpeg = (url) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d").drawImage(im, 0, 0); res(c.toDataURL("image/jpeg", 0.94)); };
    im.src = url;
  });
  t.date(6, 15, 0.25);
  // the plots page draws the selected plot's sea-view band on the horizon: not part of the film
  t.scene.traverse((o) => { if (o.renderOrder === 999 && o.type === "Group") o.visible = false; });
  window.flyAt = flyAt;
  window.flyBatch = async (i0, i1) => {
    const out = {};
    for (let i = i0; i < i1; i++) {
      const v = flyAt(i / 24);
      t.view(v.pos, v.tgt, 48);
      await raf(); await raf(); await raf();   // let the near trees follow the camera
      clock.value = 1000 + i / 24;
      out["f" + String(i).padStart(4, "0")] = await toJpeg(t.still({ w: 1280, h: 720, state: "built" }));
    }
    return JSON.stringify(out);
  };
})();
