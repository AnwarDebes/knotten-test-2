# Knotten — Sjøutsikt i Rødberg · 3D and data package

Site: the Knotten knoll at Rødberg, Vigeland, Lindesnes (Agder), by the Audna outlet into
Snigsfjorden. Reference point **58.068057 N, 7.278401 E** = local origin (0, 0).

Everything in this package is derived from measured data. Where something is a
placeholder it is labelled `provisional` in the data and listed under *Assumptions* below.

```
knotten/
  site/              THE WEBSITE + PORTAL (Next.js) — see site/README.md; `cd site && npm run dev`
  specs/             the full platform specification — start at specs/00-overview.md
  web/models/        GLB assets for three.js (see manifest.json)
  web/textures/      aerial JPEGs used by the GLBs (also usable directly)
  data/              plots.json, road.json, trees.json, clearing.json, schemas/
  renders/           before/after stills, photo match, top-down plan, fly-in animation (anim/ + mp4)
  blender/           knotten_master.blend (the heavy source-of-truth scene)
  pipeline/          every script that produced this, re-runnable
  source/            raw inputs (LiDAR rasters, DEMs, OSM, imagery)
```

## Renders

| File | Camera | State |
|---|---|---|
| `site_before.png` / `site_after.png` | oblique over the field from the south | today / built |
| `drone_before.png` / `drone_after.png` | high from the west ridge | today / built |
| `knoll_view_after.png` | knoll top, first-floor height, down the sea corridor | built |
| `grillbu_photo_match.png` | neighbour's grillbu, bearing 150° | today (compare with Sigve's photo) |
| `farms_after.png` | low over Raudberg | built |
| `plan_topdown_before.png` / `plan_topdown_after.png` | orthographic, 520 m square | for the plot map |
| `anim/fly_0001..0072.png` + `knotten_flyin_720p.mp4` | fly-in over the fjord to the field | built |

Known cosmetic issue: row roads follow the raw 1 m contour, so their edges are jagged; smooth the
polylines (or use the real plan) before final renders. Trees are cones; heights/positions are measured.

## Coordinate systems

| Frame | Definition |
|---|---|
| **local** (all JSON) | metres; `x` = east, `y` = north, `z` = height above sea level; origin at the reference point |
| **glTF / three.js** | Y-up: `three.x = local.x`, `three.y = local.z`, `three.z = -local.y` |
| **WGS84** | `lat = 58.068057 + y / 111132`, `lon = 7.278401 + x / 58927.4` (given per record) |
| **EPSG:25832** | UTM 32N, given per plot; grid convergence here is 1.461° |

Sea level is `y = 0` in three.js. The knoll top is at 87.4 m, the reference point at 51.6 m.

## Loading in three.js

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader().setDecoderPath('/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);

for (const f of ['site_terrain', 'context_terrain', 'surround_terrain', 'horizon_terrain',
                 'sea', 'river', 'existing_buildings', 'powerlines',
                 'houses_proposed', 'roads_proposed']) {
  loader.load(`/models/${f}.glb`, g => scene.add(g.scene));
}

// trees: one InstancedMesh per species, instance data from data/trees.json
const { trees } = await (await fetch('/data/trees.json')).json();
for (const species of ['spruce', 'pine', 'birch']) {
  const tpl = (await loader.loadAsync(`/models/tree_${species}.glb`)).scene.children[0];
  const list = trees.filter(t => t.species === species);
  const inst = new THREE.InstancedMesh(tpl.geometry, tpl.material, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  list.forEach((t, i) => {
    q.setFromAxisAngle(up, t.rot);
    m.compose(new THREE.Vector3(t.x, t.z, -t.y), q, new THREE.Vector3(t.crown, t.h, t.crown));
    inst.setMatrixAt(i, m);
  });
  scene.add(inst);
}
```

**Before / after:** hide instances with `cleared: true` and show `houses_proposed` + `roads_proposed`.
Both states share terrain, sun and horizon, so a wipe lines up exactly.

**Per-plot cards:** `data/plots.json` — click `plot-NN` in `houses_proposed.glb`, look up the same id.

## What is measured

| Layer | Source | Resolution |
|---|---|---|
| Site + context terrain | Kartverket NHM DTM (national LiDAR), hoydedata.no | 1 m (web mesh 2 m / 5 m) |
| Existing roofs | Kartverket NHM DOM, profile swept per footprint | 1 m |
| Trees: position, height | canopy height model DOM − DTM, treetop detection | 1 m, 31 823 trees |
| 8 km / 30 km horizon | AWS terrain tiles (terrarium) | 20 m / 80 m |
| Ground colour | Esri World Imagery mosaic | 0.32 m/px |
| Footprints, roads, power lines | OpenStreetMap | — |
| Sun | NOAA solar position for the site | — |

## Per-plot evidence (`data/plots.json`)

For every plot: ground and floor level, slope/aspect, level-pad cut/fill, **sun hours on 21 Dec / 21 Mar / 21 Jun**
(terrain-shaded, first and last sun in CET), **sea view** (degrees of bearing with water visible, whether
open sea beyond 7 km is visible), and a 360° terrain horizon profile — the input the energy group needs
for PV irradiance with real ridge shading.

Headline from the provisional layout (v6, 30 September 2026): 30 plots in rows A to D (9, 10, 7 and 4),
all 30 with water and open sea in view with the neighbouring houses standing; winter-solstice sun 2.3–4.4 h.

## Assumptions (replace when the real inputs arrive)

1. **House layout is provisional.** Layout v6 (`pipeline/plan_layout_v6.py`): the four rows of the plan,
   A (plots 1–9), B (10–19), C (20–26) and D (27–30), numbered as in the Klassisk site plan and laid along
   the measured terrain inside parcel 355/10: A along the rim under Løkkeheia, B across the slope and on
   the east shoulder, C above the steep band, D on the south face of the Knotten knoll. 11 × 8.5 m
   1.5-storey houses at least 14 m apart and 10.5 m inside the boundary. Replace with the regulation plan
   when it exists and re-run; every number regenerates.
2. **The road is drawn on today's ground.** One road from the yard by Rødbergsveien behind every row,
   with hairpins at alternating ends as in the sketch. `road.json` states, per link, how far it goes up
   and down and the length a 6 % road needs; the regulation plan sets the real loops and earthworks.
3. **Clearing extent** = 14 m around each house, 6.5 m along the road, 2.5 m along the footpath, and the
   trees standing in each living room's line of sight to the water it sees (84 trees in v6).
4. **Sun hours** are terrain shading only — no shading between houses, no trees (field cleared).
5. **Tree crowns are modelled** (cones); heights and positions are measured.
6. **Site boundary** is the legal parcel 355/10 (and the yard, 355/368) from the Matrikkel, `data/parcels.json`.
7. **Imagery licence:** Esri World Imagery is fine for study; for the public website use Norge i bilder
   (needs a Geonorge login) or the project's own drone orthophoto, and rebuild `web/textures`.

## Data licences
Kartverket height data: CC BY 4.0 (© Kartverket). OpenStreetMap: ODbL (© OpenStreetMap contributors).
AWS Terrain Tiles: public. Esri World Imagery: Esri terms of use — see assumption 7.

## Re-running
`pipeline/` in order: `fetch_area.py` → `prep_scene.py` → `prep_scatter.py` → `fetch_surround.py` →
`fetch_horizon.py` → `fetch_kartverket.py` → `prep_kartverket.py` → `plan_layout.py` → then in Blender
`build_final.py` (which runs `build_gjedeland_kv.py`). Host scripts need Python 3 + Pillow; Blender 5.2 with a
GPU for the renders.

The current layout: `plan_layout_v6.py` (writes `data/plots.json`, `road.json`, `clearing.json`, `trees.json`
and the copies in `site/public/data`) → `build_klassisk_plan.py` (the Klassisk site plan,
`site/src/lib/klassisk/siteplan.ts`) → in Blender `relayout_v2.py` (stills and fly-in frames) →
`optimise_images.py` → ffmpeg for `site/public/renders/knotten_flyin_720p.mp4`.
