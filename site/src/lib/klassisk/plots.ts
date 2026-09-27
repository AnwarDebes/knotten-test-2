/**
 * 30 plots in four rows, drawn from the owner's site plan sketch.
 * Numbering and row letters are working labels until the zoning plan exists.
 * Every plot is planned with a sea view toward Sniksfjorden (project owner's stated plan).
 */
export type Plot = {
  n: number;
  row: "A" | "B" | "C" | "D";
  x: number;
  y: number;
  terrain: string;
};

const ROWS: { id: Plot["row"]; y: number; x0: number; x1: number; n: number; terrain: string }[] = [
  { id: "A", y: 100, x0: 190, x1: 640, n: 9, terrain: "Øverst i skråningen" },
  { id: "B", y: 205, x0: 180, x1: 640, n: 10, terrain: "Midt i skråningen" },
  { id: "C", y: 312, x0: 200, x1: 600, n: 7, terrain: "Nedre del av skråningen" },
  { id: "D", y: 416, x0: 290, x1: 560, n: 4, terrain: "Nederst i feltet" },
];

export const PLOTS: Plot[] = (() => {
  const out: Plot[] = [];
  let k = 1;
  for (const r of ROWS) {
    for (let i = 0; i < r.n; i++) {
      const x = r.n > 1 ? r.x0 + ((r.x1 - r.x0) * i) / (r.n - 1) : r.x0;
      out.push({ n: k++, row: r.id, x, y: r.y, terrain: r.terrain });
    }
  }
  return out;
})();

export const ROW_INFO: Record<Plot["row"], { count: number; x: number; y: number }> = {
  A: { count: 9, x: 70, y: 100 },
  B: { count: 10, x: 60, y: 205 },
  C: { count: 7, x: 80, y: 312 },
  D: { count: 4, x: 170, y: 416 },
};
