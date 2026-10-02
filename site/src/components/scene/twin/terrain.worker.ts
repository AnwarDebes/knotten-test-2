/// <reference lib="webworker" />
/**
 * Builds the terrain rings off the page's main thread: fetch each height map, decode the posts,
 * mesh them and send the arrays back (transferred, not copied).
 */
import { buildRing, decodeHeights, type RingDesc } from "./rings";

type Job = { base: string; rings: RingDesc[]; offset: number; outermost: string };

self.onmessage = async (e: MessageEvent<Job>) => {
  const { base, rings, offset, outermost } = e.data;
  try {
    await Promise.all(rings.map(async (r) => {
      const blob = await (await fetch(base + r.files.height)).blob();
      const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      const cv = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = cv.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(bmp, 0, 0);
      const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
      bmp.close();
      const mesh = buildRing(r, decodeHeights(px, r.n, offset, r.step), r.name === outermost);
      (self as unknown as Worker).postMessage({ type: "ring", mesh }, [mesh.position.buffer, mesh.normal.buffer, mesh.uv.buffer, mesh.index.buffer, mesh.heights.buffer]);
    }));
    (self as unknown as Worker).postMessage({ type: "done" });
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: "error", message: String(err) });
  }
};
