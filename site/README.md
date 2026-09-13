# Knotten — the digital platform (site)

Next.js 16 · React 19 · three.js / react-three-fiber · Tailwind 4 · TypeScript.
Implements `../specs/` Release 1 in full, with the portal surfaces of Releases 2–3 as working demos on model data.

## Run

```bash
npm install
npm run dev        # http://localhost:3000  (redirects to /no)
npm run build && npm run start
```

## What is where

| Route | What |
|---|---|
| `/no`, `/en` | landing: hero → *Stå på Knotten* stage (wipe · stand on plot · living field) → measured numbers → proof slider → best passports → energy → the basis → CTA |
| `/no/tomter`, `/no/tomter/plot-NN` | plot list (sortable), plot page with 3D viewpoint, sun passport, horizon chart; OG image per plot |
| `/no/utsikt` | the view: corridor panorama, photo-vs-model slider |
| `/no/energi`, `/no/energi/eksisterende` | energy concept with the living field; office + house measured-proof page (sample charts until meters are wired) |
| `/no/omradet`, `/no/prosjektet`, `/no/investor`, `/no/nyheter`, `/no/kontakt`, `/no/interesse`, `/no/personvern` | content pages; interest registration posts to `/api/leads` |
| `/no/portal` | demo login (role cookie) → investor data room + scenario explorer, resident, energy dashboard, twin, project workspace, municipality packs (road grades from `road.json`), research datasets, admin (leads, assumptions) |

## The 3D stage (`src/components/Stage.tsx`, `src/components/scene/*`)

- Loads the GLBs from `public/models` (Draco) and `public/data/trees.json` (31 823 measured trees, instanced per species; trees beyond 520 m of the site are dropped on the web tier).
- One render loop (`StateRenderer`) sets visibility per state (`today · cleared · built · lived`) and draws the frame twice with a scissor split when the wipe is active. Shadows update once per frame.
- The sun is the real sun (`src/lib/solar.ts`, the NOAA routine the pipeline used) for the date dial's month/hour; default 21 December 12:00.
- Stand-on-plot puts the camera on the terrace of `plot-NN` at eye height and draws the sea-view corridor arc from `plots.json`.
- The living field lights roofs (PV), windows (load), flows (sharing) and the hub (SOC) from `src/lib/energy.ts` — a transparent model that Release 3 swaps for live frames of the same shape.
- If the GPU drops the WebGL context, the stage offers *lite mode* (fewer trees, no shadows).

## Data and assumptions

- `public/data/plots.json`, `trees.json`, `road.json`, `clearing.json` come from `../data` (pipeline outputs). Re-copy after re-running the pipeline.
- `src/lib/assumptions.ts` holds every figure shown on the site with source, date and `provisional` flag. Nothing is hard-coded in components. Production: the `assumption` table (specs/04).
- `data/leads.json` (git-ignored) receives registrations in dev. Production: Supabase `lead` table.

## Images Sigve gave us

Put the originals in `public/assets/incoming/` with the names in `README.txt` there. The proof slider, the "basis" grid and the project page pick them up; sections hide themselves while a file is missing.

## Before launch

1. Replace Esri imagery textures in the GLBs with Norge i bilder or a drone orthophoto (licence) — re-run `../pipeline/build_final.py`.
2. Georeferenced site plan → `../pipeline/plan_layout.py` → copy `../data/*.json` here.
3. Supabase project + env vars; swap the JSON adapters in `src/lib/data.ts` and `src/app/api/leads/route.ts`.
4. Real auth (Supabase Auth; BankID for residents) replaces the demo role cookie.
5. Analytics (Plausible/Umami) + the event taxonomy from specs/09.
