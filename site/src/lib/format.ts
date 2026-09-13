/** Client-safe formatting helpers (no Node imports). */
export function fmtHours(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}:${mm.toString().padStart(2, "0")}`;
}

export function sunLabel(v: number | null) {
  if (v === null) return "";
  return fmtHours(v);
}
