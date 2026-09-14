export type SunDay = { hours: number; possible_hours: number; first_sun_cet: number | null; last_sun_cet: number | null };

export type Plot = {
  id: string;
  row: number;
  zone?: "hill" | "flat";
  local: { x: number; y: number; z_ground: number; z_floor: number };
  lat: number; lon: number; utm32_east: number; utm32_north: number;
  house: { width_m: number; depth_m: number; facing_deg: number; eaves_m: number; ridge_m: number; storeys?: number; plinth_m?: number };
  terrain: { slope_deg: number; aspect_deg: number; level_pad_cutfill_m3: number; dist_to_boundary_m?: number; terrace_level_m?: number; cut_behind_m?: number };
  view: { water_visible_deg: number; water_bearings: [number, number] | null; open_sea_visible: boolean; open_sea_deg: number; farthest_water_m: number };
  sun: { dec21: SunDay; mar21: SunDay; jun21: SunDay };
  horizon_deg_by_bearing: number[];
  status: string;
};

export type PlotsFile = { crs_note: string; assumptions: Record<string, string>; plots: Plot[] };

export type Tree = { id: string; x: number; y: number; z: number; h: number; crown: number; species: "spruce" | "pine" | "birch"; rot: number; tint: number; cleared: boolean };
export type TreesFile = { count: number; cleared_count: number; trees: Tree[] };

export type SceneState = "today" | "cleared" | "built" | "lived";

export type EnergyFrame = {
  ts: string;
  plots: Record<string, { pv_kw: number; load_kw: number; soc: number; sharing_to: { plot: string; kw: number }[] }>;
  field: { import_kw: number; export_kw: number; soc: number; pv_kw: number; load_kw: number };
  source: "model" | "live";
};
