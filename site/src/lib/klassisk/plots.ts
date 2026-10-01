import { SITEPLAN } from "./siteplan";

/**
 * 30 plots in four rows, A to D, as the model lays them out on the measured terrain (layout v6, the same
 * plots.json the Moderne design reads), placed in the site plan's SVG frame. Plot numbers and row letters
 * are working labels until the zoning plan exists; both designs use the same ones.
 * Every plot is planned with a sea view toward Sniksfjorden (project owner's stated plan).
 */
export type Plot = {
  n: number;
  row: "A" | "B" | "C" | "D";
  x: number;
  y: number;
  rot: number;
  terrain: string;
};

export const PLOTS: Plot[] = SITEPLAN.plots.map((p) => ({ n: p.n, row: p.row, x: p.x, y: p.y, rot: p.rot, terrain: p.terrain }));

export const ROW_INFO: Record<Plot["row"], { count: number; x: number; y: number }> = SITEPLAN.rows;
