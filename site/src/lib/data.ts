import { promises as fs } from "fs";
import path from "path";
import type { PlotsFile, Plot } from "./types";
import { readStore } from "./store";

const PUBLIC = path.join(process.cwd(), "public");

let plotsCache: PlotsFile | null = null;

export async function loadPlots(): Promise<PlotsFile> {
  if (plotsCache) return plotsCache;
  const raw = await fs.readFile(path.join(PUBLIC, "data", "plots.json"), "utf-8");
  plotsCache = JSON.parse(raw) as PlotsFile;
  return plotsCache;
}

export async function loadPlot(id: string): Promise<Plot | undefined> {
  const { plots } = await loadPlots();
  return plots.find((p) => p.id === id);
}

/** Plot status/price overlay. In production this is the `plot` table; here a small JSON. */
export type PlotCommercial = { id: string; status: "available" | "reserved" | "sold" | "unreleased"; price_nok?: number; note?: string; house_type: string };

/** Status, price and note per plot, as the administrator set them; unreleased until then. */
export async function loadCommercial(): Promise<Record<string, PlotCommercial>> {
  const { plots } = await loadPlots();
  const store = await readStore();
  const out: Record<string, PlotCommercial> = {};
  for (const p of plots) {
    const s = store.plots[p.id];
    out[p.id] = { id: p.id, status: s?.status ?? "unreleased", price_nok: s?.price_nok, note: s?.note, house_type: p.zone === "flat" ? "Modell: 1 etasje, flaten" : (p.house.storeys ?? 1) > 1 ? "Modell: 1,5 etasje" : "Modell: 1 etasje" };
  }
  return out;
}

/** Published news, newest first. */
export async function loadNews() {
  const store = await readStore();
  return store.news.filter((n) => n.published).sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadSettings() {
  return (await readStore()).settings;
}

export { fmtHours, sunLabel } from "./format";
