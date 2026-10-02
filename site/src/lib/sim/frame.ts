/**
 * One hour of a simulated year, as the 3D scene shows it (SimLayer): what each roof makes and each
 * home uses, the batteries, the sharing between homes and the exchange with the grid. With a power
 * cut, the cut's own result decides which homes are dark.
 */
import type { YearResult } from "./run";
import type { SimFrame } from "@/components/scene/twin/SimLayer";

export function frameAt(r: YearResult, h: number, cut?: { on: Uint8Array[]; soc: Float32Array[] } | null, cutHour = -1): SimFrame {
  const n = r.homes;
  const pick = (a: Float32Array[]) => Float32Array.from({ length: n }, (_, i) => a[i][h]);
  const inCut = !!cut && cutHour >= 0 && cutHour < cut.on.length;
  return {
    pv: pick(r.pv), kwp: r.scenario.pvPerHomeKwp, load: pick(r.load),
    soc: inCut ? cut!.soc[cutHour] : pick(r.soc),
    share: inCut ? new Float32Array(n) : pick(r.share),
    off: inCut ? Float32Array.from(cut!.on[cutHour], (v) => 1 - v) : undefined,
    grid: inCut ? 0 : r.field.imp[h] - r.field.exp[h],
    park: r.field.park[h], parkKwp: r.scenario.parkKwp,
    wind: r.field.wind[h], windKw: r.scenario.windKw, windSpeed: r.field.wind10[h] * 0.75,
  };
}

/** Cloud cover from how much of a clear sky's light reached the ground this hour (for the 3D sky). */
export function cloudsAt(ghi: number, elevation: number) {
  if (elevation <= 2) return 0.45;
  const s = Math.sin((elevation * Math.PI) / 180);
  const clear = 1098 * s * Math.exp(-0.057 / s);
  return Math.max(0, Math.min(1, 1 - ghi / Math.max(1, clear)));
}
