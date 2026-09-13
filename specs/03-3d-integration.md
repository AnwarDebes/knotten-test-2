# 03 · 3D integration

## Principle
One model. Blender master (heavy, source of truth) → web build (light, same geometry within tolerance)
→ digital twin (same build, live data). The web build is in `../web/models/`, described by `manifest.json`.

## Layers

| Layer | File | Extent / resolution | Role |
|---|---|---|---|
| Site terrain | `site_terrain.glb` | ±350 m, 2 m grid, LiDAR | where everything happens |
| Context | `context_terrain.glb` | ±500 m, 5 m, hole under site | Raudberg, road, river banks |
| Surroundings | `surround_terrain.glb` | ±4 km, 50 m | valley sides |
| Horizon | `horizon_terrain.glb` | ±15 km, 250 m | the sea corridor's far hills |
| Sea | `sea.glb` | 30 km sheet at 0 m | Snigsfjorden and open sea |
| River | `river.glb` | LiDAR no-return cells | the Audna |
| Existing buildings | `existing_buildings.glb` | 71 footprints, LiDAR roof profiles | truth anchors |
| Power lines | `powerlines.glb` | OSM | detail |
| Trees | `tree_*.glb` + `data/trees.json` | 31 823 instances, measured heights | forest, before/after |
| Proposed houses | `houses_proposed.glb` | `plot-NN`, `plot-NN-roof` | the plan (provisional) |
| Proposed roads | `roads_proposed.glb` | rows + ramps | the plan (provisional) |

Total ≈ 3.2 MB of GLB (Draco) + 4.9 MB `trees.json` (gzip → ~1 MB). Textures are embedded JPEG.

## Coordinate contract
Local metres, origin 58.068057 N 7.278401 E, sea level = 0. glTF is Y-up:
`three.x = east`, `three.y = height`, `three.z = -north`. Every JSON record carries local, WGS84 and UTM32.

## Scene graph in the app

```
<Canvas>
  <Sky date time lat lon />              real sun position (NOAA, same as pipeline)
  <Terrain layers=[site, context, surround, horizon] />
  <Water sea river />
  <Forest instances=trees.json cleared={state !== 'today'} />
  <Existing buildings powerlines />
  <Proposal visible={state in ['built','lived']} houses roads />
  <EnergyOverlay visible={state === 'lived'} data={energyFrame} />
  <Cameras hero drone knoll grillbu plots[] />
</Canvas>
```

State machine: `today | cleared | built | lived`. The wipe is implemented as a stencil/clip plane in
screen space between two render passes of the same scene with different state flags — not two scenes.

## The sun
`Sky` takes date+time and computes the sun vector with the same NOAA routine used offline, so the
website's shadows agree with `plots.json`. Default 21 Dec 12:00 CET. Dial UI: ring for time of day,
inner ring for day of year, with the plot's first/last-sun ticks. Shadows: cascaded shadow maps on
terrain + houses; trees cast via instanced shadow pass (cap to trees within 300 m of camera).

## Stand-on-plot cameras
For `plot-NN`: position = `local(x, y, z_floor + 1.6)`, look direction = `facing_deg`. Provide a
constrained orbit (±60° yaw, ±20° pitch), so the visitor can look around but not leave the room.
The **view corridor** arc is drawn on a far sphere at bearings where `water_bearings` says water is
visible; brighter where open sea is visible.

## The proof slider
`renders/grillbu_photo_match.png` vs the photograph (to be supplied by Sigve, same orientation).
Implemented as an image comparison with the model frame extended by a live 3D view at that camera so
the slider can continue into the built state.

## Energy overlay (the living field)
Inputs: a frame `{plot_id: {pv_kw, load_kw, soc, sharing_to: [{plot_id, kw}]}}` at a timestamp.
Rendering: roof emissive ∝ pv_kw; window emissive ∝ load_kw; flow particles along a precomputed
graph (field grid = roads polyline + spurs to each house) ∝ sharing kW; hub sphere ∝ SOC.
Data sources by release: R1 — energy group's model output or labelled mock; R3 — live meters via API.
The outage switch sets grid import to zero and animates SOC drawdown using the contract's
`islanding_hours_at_winter_load`.

## Performance budget
- First paint: hero video, no 3D → < 2 s on 4G.
- 3D ready: < 8 MB transferred, < 4 s on a mid-range Android; 60 fps target, 30 fps floor.
- Draw calls: terrains 4, water 2, buildings 1–2 (merged), trees 3 (instanced), houses 1 (merged, per-plot
  IDs via vertex attribute for picking), overlay 3.
- LOD: trees beyond 600 m as impostors or culled; horizon tiers static.
- Fallback: WebGL unavailable → stills + passport tables; everything still works.

## Asset pipeline (repeatable)
`pipeline/build_final.py` in Blender regenerates GLBs, `trees.json`, renders. Re-run when: the real plan
arrives, the parcel arrives, better imagery arrives (Norge i bilder / drone), or house types change.
Version every export in `manifest.json` (`built_at`, `pipeline_git_sha`, `assumptions_version`).

## What to replace before public launch
1. Esri imagery → Norge i bilder (Geonorge login) or drone orthophoto (licence + resolution).
2. Provisional layout → georeferenced plan (`plan_layout.py` regenerates all numbers).
3. Tree cones → optional: better crown geometry from the raw LAS; heights/positions are already measured.
