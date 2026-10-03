/** Client-safe formatting helpers (no Node imports). */
export function fmtHours(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}:${mm.toString().padStart(2, "0")}`;
}

/**
 * A sun time as the clock on the wall shows it. The data's times are standard time (CET); from the end of March to
 * the end of October the clock is an hour ahead (summer time), so the June times are shown an hour later.
 */
export function sunLabel(v: number | null, summer = false) {
  if (v === null) return "";
  return fmtHours(summer ? v + 1 : v);
}

/** "plot-07" -> "7": the plot number both designs show. */
export function plotNo(id: string) {
  return String(Number(id.replace("plot-", "")));
}

/** "plot-07" -> "Tomt 7" / "Plot 7". */
export function plotName(id: string, no: boolean) {
  return `${no ? "Tomt" : "Plot"} ${plotNo(id)}`;
}

/** The row a plot belongs to, A to D (older files carry only the row number). */
export function rowLabel(p: { row: number; row_label?: string }) {
  return p.row_label ?? String(p.row);
}
