# Knotten — the digital platform (site)

Next.js 16 · React 19 · three.js / react-three-fiber · Tailwind 4 · TypeScript.
Implements `../specs/` for the public site, and the project portal behind a real login: data room, resident portal, energy dashboard with smart control and energy sharing, project room, documents, municipality and research rooms, and the administration with the key figures the project owner asked for.

## Run

```bash
npm install
npm run dev        # http://localhost:3000  (Klassisk; Moderne at /no)
npm run build && npm run start
```

## Two designs, one site

Sigve liked both designs, so the site carries both and the visitor chooses with the strip above the header ("Utseende: Klassisk | Moderne").

| | Klassisk (default) | Moderne |
|---|---|---|
| Addresses | `/`, `/tomtene`, `/prosjektet`, ... (Norwegian only) | `/no/...`, `/en/...` |
| Code | `src/app/(klassisk)`, `src/components/klassisk`, `src/lib/klassisk`, `public/img` | `src/app/(moderne)`, `src/components/ui`, `scene`, `charts`, `portal` |
| Styles | `src/app/(klassisk)/globals.css`, plain CSS | `src/app/(moderne)/globals.css`, Tailwind 4 |

- Each design is its own root layout (a route group), so their stylesheets never meet: switching is a full page load. Moderne's root layout is `src/app/(moderne)/[locale]/layout.tsx`, once per language, so `<html lang>` is `nb` or `en`.
- Moderne is in Norwegian and English throughout: the pages, the portal, page titles and link previews (`src/lib/meta.ts`), the figure cards, the emails people receive and the weekly summary (its language is a setting). The header's NO | EN switch keeps the page. A new Moderne page needs `export const generateMetadata = pageMeta(...)` and the line `if (!isLocale(l)) notFound();` after it reads its locale.
- `src/lib/design.ts` maps every page to its twin in the other design; pages that exist in only one design open the closest match. Add a new page there too.
- The switch (`src/components/DesignSwitch.tsx`) remembers the choice in the `knotten_design` cookie for a year; `src/proxy.ts` sends a visitor who chose Moderne from `/` to `/no`, and a visitor without a login from the portal to the login page. Links to a specific page always open that page.
- Shared by both: the interest form (`/api/leads`, the source says which design), the visitor statistics (`/api/collect`), the login (`/logg-inn` and `/no/login` post to the same actions) and the project portal, which has one look (Moderne) for both. `src/app/global-not-found.tsx` is the 404 for unknown addresses (Klassisk look, with its own small stylesheet: every route carries this page, so anything it imports, such as Klassisk's fonts, would otherwise be preloaded on the Moderne pages too); `src/app/(moderne)/[locale]/not-found.tsx` covers missing Moderne pages in the visitor's language.
- If one design is chosen later: remove `DesignSwitch`, `design.ts`, `proxy.ts` and the other design's pages and components. The leads API, `src/lib` (store, auth) and the portal stay either way. Dropping Klassisk also means moving the front page back to `/` (or redirecting `/` to `/no`) and replacing `global-not-found.tsx`.

## What is where

| Route | What |
|---|---|
| `/no`, `/en` | landing: hero → *Stå på Knotten* stage (wipe · stand on plot · living field) → measured numbers → proof slider → best passports → energy → the basis → CTA |
| `/no/tomter`, `/no/tomter/plot-NN` | plot list (sortable), plot page with 3D viewpoint, sun passport, horizon chart; OG image per plot |
| `/no/utsikt` | the view: corridor panorama, photo-vs-model slider |
| `/no/energi`, `/no/energi/eksisterende` | energy concept with the living field; the office and the house with measured history once the owner loads and publishes it in the portal |
| `/no/omradet`, `/no/prosjektet`, `/no/investor`, `/no/nyheter`, `/no/kontakt`, `/no/interesse`, `/no/personvern` | content pages; interest registration posts to `/api/leads` |
| `/no/login`, `/logg-inn` | login, first-time setup, invitation and new-password links (`/no/login/passord?token=`) |
| `/no/portal/...` | the project portal, see below |

## The project portal

One login for everyone who works with the project. Three roles, as the project owner asked: **user**, **administrator** and **super administrator**. A user opens only the areas given to them; administrators open everything and run the administration; super administrators also manage administrators and see the security log.

| Area (`/no/portal/...`) | What |
|---|---|
| (overview) | greeting, readiness checklist for the owner, the person's areas, new documents, milestones or news, open questions |
| `investor` | data room: saving, running costs, scalability, innovation and ESG from the energy budget; scenario explorer; documents; questions and answers |
| `resident` | "Mitt hjem": the resident's plot, energy now, documents for the home, consents, requests |
| `energy` | live NO2 power price (hvakosterstrommen.no) and MET weather at the plot, solar forecast, the year in balance, the borehole field |
| `energy/optimering` | smart control: the cheapest plan for battery, hot water and car on today's and tomorrow's real prices (exact optimisation in the browser) |
| `energy/deling` | energy sharing between the 30 homes, the office building, a shared battery and the shared solar plant, as a yearly estimate |
| `energy/eksisterende` | meter import (Elhub or supplier CSV), upgrades with before and after, publish to the public pages |
| `energy/smarthjem`, `twin` | the equipment and its interfaces (placeholder until there are homes); the 3D twin with `/api/energy/frame` |
| `project` | task board, decision log, milestones (a reached milestone is published to the news page with one click), documents, discussion |
| `dokumenter` | every document shared with the person; uploads, versions, download log; the checklist of the working documents the public document bank refers to (`src/lib/docRegister.ts`), uploaded under their titles |
| `municipality` | printable regulation basis (`municipality/rapport`), GeoJSON in EPSG:25832 or WGS84 (`/api/geo`), road grades, questions and remarks |
| `research` | the datasets with fields, licence and citation, counted downloads (`/api/datasett/...`) |
| `admin` | key figures (registrations, conversion, investor interest, website engagement, stakeholder participation, reply time) with targets; leads; website visits and Knotten AI questions; plots and prices; news; users and access; settings, service status, the weekly summary and the backup download; features and status (the owner's six feedback points, with live state) |
| `konto` | profile, password, log out everywhere |

How it is built:

- Accounts and sessions: `src/lib/server/accounts.ts`, `src/lib/auth.ts`. Passwords are scrypt hashes; the session cookie is httpOnly and signed (HMAC); a changed password or "log out everywhere" ends all older sessions; five wrong passwords lock an address for 15 minutes. Invitations last 7 days and password links 24 hours; only their hashes are stored.
- Every portal page checks access itself (`src/lib/server/portal.ts`), and every server action checks the acting person (`actor()` in `src/lib/auth.ts`). The sidebar is not a lock.
- Records: `src/lib/store.ts` (leads, plots, news, settings), `src/lib/server/records.ts` (documents, questions, workspace, consents, meters), all through `src/lib/server/kv.ts`.
- Files: `src/lib/server/files.ts`; downloads go only through `/api/files/[id]`, which checks access and logs.
- Visitor statistics: `src/components/Track.tsx` and `/api/collect`, counted in `src/lib/server/stats.ts` without cookies or stored addresses; logged-in people, robots and Do Not Track are not counted.
- "Se som" (view as): an administrator sees the portal as an investor, the municipality, a researcher, the project group or a resident. A cookie narrows the administrator's own session (`getSession` in `src/lib/auth.ts`); it can never widen anyone's access, and changes are switched off while it is on.
- Knotten AI (the chat on the Moderne pages): `/api/ask` and `src/lib/server/assistant.ts` answer from the project's own data, including the NO2 power price and MET weather right now. With `ANTHROPIC_API_KEY` set, questions the data does not cover go to Claude with the same facts. Topics are counted and unanswered questions kept (without emails or numbers) for the owner under Website visits.
- Weekly summary: `src/lib/server/digest.ts`, sent by Vercel Cron (`vercel.json`, Mondays 06:00 UTC) through `/api/cron/digest` when switched on in Settings. Settings shows a preview and can send a test.
- Backup: `/api/backup` gives administrators everything stored as one JSON file (accounts without passwords; document files are listed, not included).
- The public document bank (both designs) links its internal documents to `/no/portal/dokumenter?dok=key`, through the login.

## Where data is kept

| Mode | When | Records | Files |
|---|---|---|---|
| file | running on a computer or a normal server | `data/crm.json` (leads, plots, news, settings) and `data/private/*.json` | `data/private/files/` |
| kv | `KV_REST_API_URL` and `KV_REST_API_TOKEN` set (Vercel's Redis/Upstash integration) | Redis, keys `knotten:*` | Vercel Blob, private (`BLOB_READ_WRITE_TOKEN`) |
| temp | on Vercel without KV | `/tmp`, forgotten when the server sleeps: for a demonstration only | none |

`data/private/` holds password hashes, the session secret, uploaded files and statistics. It is in `.gitignore` and must never be committed.

## Deploying (Vercel)

1. Import the repository in Vercel with `site` as the root directory.
2. Storage: add a Redis database (Upstash) from the Vercel marketplace and a Blob store, and connect both to the project. Their variables are set automatically.
3. Environment variables:

| Variable | Needed | What |
|---|---|---|
| `AUTH_SECRET` | yes | at least 32 random characters; signs the sessions (`openssl rand -base64 48`) |
| `SITE_URL` | yes | the public address, e.g. `https://knotten.no`; used in invitation links, robots.txt and the sitemap |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | yes | set by the Redis integration (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) |
| `BLOB_READ_WRITE_TOKEN` | for documents | set by the Blob integration; without it uploads are switched off |
| `RESEND_API_KEY`, `MAIL_FROM` | recommended | email for invitations, password links and alerts about new leads and questions, e.g. `Knotten <post@knotten.no>` (the domain must be verified in Resend); without them the portal shows the links to copy |
| `CRON_SECRET` | for the weekly summary | a long random text; Vercel Cron sends it with each call, so nobody else can trigger the email |
| `ANTHROPIC_API_KEY` | optional | lets Knotten AI answer questions the data does not cover with Claude (`ANTHROPIC_MODEL` to choose the model; Haiku 4.5 by default). Without it the assistant answers from the data only |
| `KNOTTEN_SETUP_CODE` | optional | a code of your own for the first-time setup; otherwise one is made and written to the server log |

4. Deploy, open `/no/login` and complete the first-time setup with the setup code. The first account is the super administrator (the project owner's email is suggested). Everyone else is invited from Users and access.
5. Settings in the portal shows which services are in place. Vercel takes at most 4.5 MB per upload; larger documents need a normal server.

On a normal server: `npm run build && npm run start`, set the same variables except KV and Blob, and keep `data/` on persistent disk with a backup.

## The 3D model (`src/components/Stage.tsx`, `src/components/scene/*`, data in `public/twin`)

A digital twin of Knotten and its surroundings, built from measured data (`../pipeline/twin_*.py`, see the README one level up):

- **Terrain:** Kartverket's terrain model (NHM, 1 m near the field) in five nested rings out to 105 km (`ring_r0..r4`: heights in PNG, the aerial photo in WebP, masks in lossless WebP), meshed in a Web Worker without seams. Beyond 1.3 km the rings are laid out by true distance and direction and bend down with the earth's curvature (less refraction), so far ridges, the inland mountains and the sea's horizon stand where they do; the open sea runs on to 220 km. Beyond the 3D trees the woods are the canopy of Kartverket's surface model. Water is drawn by the terrain shader where the mask says water, so there is no second surface to flicker against (the old blinking sea); over the sea the nautical chart's depths (`ring_r2_d`, `ring_r3_d`) let the bottom show through the shallows as the aerial photo has it, and the Audna's brown water spreads at its mouth. For the built states the plan's pads, roads and gardens are graded into the inner ring (`ring_r0b_*`).
- **Buildings:** every building within 1.3 km with a surveyed outline, its roof shape and height fitted to the laser data (`buildings.glb`), and every other registered building out to 5.1 km that the laser data shows (`buildings_far.glb`, from Kartverket's building register: Vigeland, Snig, Lonestrand, the farms and cabins, Valle kirke with its tower; 16-bit positions to keep the file small).
- **Roads:** Statens vegvesen's road database (NVDB): every road out to 5.3 km painted into the ground at its recorded width, with its surface and the markings NVDB records (`ring_r*_r.png`, signed distance per texel, so the edges stay sharp), the bridges as 3D decks with railings (`roads.glb`), the guardrails of each recorded type, the guard stones and the street lights, lit at night (`road_objects.json`).
- **The 30 homes, outside** (`scene/house/exterior.ts`, drawn by `twin/TwinHouses.tsx`): the model's example house (`src/lib/house/plan.ts`, an illustration: the project has no house design yet) in the box `plots.json` gives every plot (11 x 8.5 m, eaves 3.2 m, ridge 5.6 m), fitted to its ground by `houses.json`: board-on-board cladding on a 0.35 m wall, real window openings with reveals, frames, sashes and sills, the front door with a canopy and a lamp, standing-seam steel roof with gutters, downpipes, snow guards, the ventilation hood and the solar modules on rails, the terrace on posts with a glass railing and a stair, and where the ground falls far enough a lower floor opening onto a patio on a dry-stone wall. One draw call per material for all 30 houses; behind the other houses' windows a room is drawn in the glass shader, lit at night.
- **Inside a house, on foot** (`scene/house/interior.ts`, `furniture.ts`, `lighting.ts`, `interiorMaterials.ts`, `HouseInterior.tsx`, `walk.ts`, `WalkRig.tsx`; the page's side in `src/components/walk`): every house can be walked into from the plots pages ("Gå inn i huset") and the journey's last stop. The rooms are built when the visitor comes to a house: entrance hall with the stair down, open kitchen and living room under a vaulted ceiling with a glulam ridge beam, bathroom, bedroom, the plant room with the ground-source heat pump and its hot water tank, the balanced ventilation unit and its ducts, the 14 kWh battery and the inverter, the fuse box with the meter's HAN reader and the floor heating manifold, and on the lower floor a family room, two bedrooms, a second bathroom and storage. Dimensions follow TEK17 (rooms 2.4 m, doors 0.86 m free width, stairs 2R+G = 0.62 m, railings 1.0 m). The light is worked out per vertex: the exact form factor of each window, the light bounced round the room, the lamps and contact shadows; the sun comes in only through the openings (followed through the reveals, past the eaves, the terrace and the inner walls, and over the plot's measured horizon). The screens in the house (energy screen, heat pump, inverter, meter) and the battery's charge bar show that house's own figures from the energy simulation at the dial's hour. Walking: WASD or arrows and drag to look on a computer, a stick and drag on a phone, a click or tap on a floor to walk there (A* over a 20 cm grid through doors and down stairs; a click on a wall walks to its foot, and a long way is walked briskly); doors open as the visitor comes; walking up to another house makes it the visited one. Hotspots on the installations explain each measure with the energy track's verdict and its source. For the frame rate on a laptop or a phone: indoors the rooms are drawn before the landscape and the forest outside the windows is lighter (detailed trees to about 25 m, 3D trees to about 140 m), the rooms' shaders are compiled while the camera flies in, the way-finding grid is filled a few milliseconds per frame, and the screens are redrawn only when their figures change.
- **Trees:** 101 900 treetops measured in the laser data within 1.28 km (`trees.bin`), species from NIBIO SR16 and AR5 and the aerial photo, leaf colour from the aerial photo at each tree. Detailed models within 70 m of the camera, simpler ones to 260 m, painted cards beyond. The seasons follow the coast of Agder: leaf out in May, autumn colour, bare birch and oak in winter (oaks keep a few dry leaves), and the summer photo's fields and broadleaf woods turned to winter straw and bare twigs (the masks' blue channel holds the broadleaf share of the trees).
- **Sky and light:** the real sun (NOAA, `src/lib/solar.ts`), a clear-sky model, a cloud deck that follows the weather (it closes into grey stratus on an overcast day and then lights the scene), haze, and a camera's longer exposure on a grey day and around sunset.
- **Names and lines:** place names from Kartverket's register (`names.json`; the wide views add the settlements, fjords, larger lakes and highest hills within 5 km, Spangereid, Lenefjorden, Mandal and Lindesnes fyr; a name the ground hides from the camera is not shown), and NVE's overhead power lines with every mast at its recorded point and height (`power.json`: wooden poles for 22 and 24 kV, H-frames for 110 kV).
- **Energy:** the living field and the energy simulator show each hour of the simulation in `src/lib/sim` (below): panels lit by their own production, the hub, the sharing and the batteries.
- **Checked against a photograph:** the landing page's photo slider puts Sigve's winter photo beside the model seen from the same spot. The spot was found by fitting the photo's skyline and the five Raudberg buildings in it to the terrain model (camera 1.9 m above the ground at local (52.6, -67.3), towards 176 degrees, field of view 59.4 degrees; buildings within about 11 px of 1440, skyline within about 3 px of 360).
- **Debug:** `?twindebug` in the address exposes `window.__twin` (`date(month, hour, clouds)`, `view(pos, target, fov)`, `still({ w, h, state })`, `walk(plotId, "door" | "terrace" | "living")` and `walkState`), used for the stills, the photo match and the fly-in (`../pipeline/twin_flyin.js`).
- If the GPU drops the WebGL context, the stage offers lite mode (fewer trees, no shadows, no guardrail posts or guard stones).

## The energy simulation (`src/lib/sim`)

Hour by hour through a typical year at Knotten (EU PVGIS, sun from satellite, temperature and wind from ERA5): each home's panels on its real roof pitch and direction with its terrain horizon (Perez sky, Martin and Ruiz reflection, Faiman module temperature, the Huld model PVGIS uses, 14 % losses, calibrated to PVGIS's own yield for the spot), household use in the rhythm of real NO2 homes (Elhub 2025), heat pumps on the borehole field (SCOP 3.6), batteries that keep 30 % for outages, sharing in the field, the budget's prices or NO2 spot prices for 2025, and an outage drill. It runs in a Web Worker on the page (`useSim.ts`) and on the server for the portal's figures and `/api/energy/frame` (`src/lib/energy.ts`). With the energy budget's own assumptions it lands close to the budget (self-sufficiency 51.4 % against 52.5 %).

## Data and assumptions

- `public/data/plots.json`, `trees.json`, `road.json`, `clearing.json` come from `../data` (pipeline outputs). Re-copy after re-running the pipeline.
- `src/lib/facts/` is the single source of the project's facts, shared by both designs and the portal: `sources.ts` (the quotes behind every "Kilde" chip), `figures.ts` (the key numbers in `FACT`, the assumptions with source, date and `provisional` flag, and the Klassisk figures table), `energy.ts` (energy budget, EED borehole field, the measures with their verdicts, and the owner's direction), `project.ts` (contact details, the internship, the work plan and the document register) and `core.ts` (number formatting). Pages keep their own markup and wording but take every shared number, date and contact detail from `@/lib/facts`, so one change there reaches both designs. Facts were checked against `knotten-source-informations` on 27 September 2026. Production: the `assumption` table (specs/04).
- Registrations land in the CRM records (see "Where data is kept"); the old `data/leads.json` from the first form is taken over once if it exists.

## Images Sigve gave us

Put the originals in `public/assets/incoming/` with the names in `README.txt` there. The proof slider, the "basis" grid and the project page pick them up; sections hide themselves while a file is missing.

## Before launch

1. Replace the Esri imagery in `public/twin` (each terrain ring's aerial photo, which also gives the trees their colour) with Norge i bilder or a drone orthophoto (licence): `../pipeline/twin_fetch.py`, then `twin_terrain.py` and the steps after it.
2. Confirm the terms of NIBIO's AR5 map service (the twin's water and forest masks) or move to open data, and credit the twin's sources where the site names the model's data (see the table in the README one level up).
3. Georeferenced site plan → `../pipeline/plan_layout.py` → copy `../data/*.json` here.
4. Storage, email and the environment variables above; first-time setup; invite the project group.
5. Read the privacy statement (`/personvern`, `/no/personvern`) with the project owner; it is marked as a draft.
6. Set the targets for the key figures after two months of real traffic, as the website plan says.
7. Later, when there are homes: meters and the equipment interfaces (Energy, Smart home), BankID for residents if wanted.
