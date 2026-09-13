# Knotten Digital Platform — Specification set

**Project:** Knotten · Sjøutsikt i Rødberg · Lindesnes, Agder
**Owner:** Sigve Simonsen AS
**Ambition (from the brief):** Norway's most energy-efficient, robust and attractive housing field —
technology, infrastructure, regulation and market/profile developed together from the start.
**These specs cover:** the complete digital platform Sigve asked for — public website, 3D simulation,
investor material, resident portal, energy dashboard, digital twin, AI optimisation, community energy
sharing, smart-home readiness, project workspace, municipality reporting, UiA research space,
success metrics — written so it can be built in full.

## How to read this set

| # | Document | What it decides |
|---|---|---|
| 00 | this file | vision, the one idea, principles, glossary |
| 01 | [Experience design](01-experience-design.md) | the visitor journey and the signature experience *Stå på Knotten* |
| 02 | [Information architecture](02-information-architecture.md) | sitemap, roles, navigation, languages |
| 03 | [3D integration](03-3d-integration.md) | how the simulation lives in the website — layers, time, truth, performance |
| 04 | [Data model](04-data-model.md) | the spine `field → plot → building → system → meter → reading`, schemas, provenance |
| 05 | [Modules](modules/) | one spec per product module, all releases |
| 06 | [Existing buildings](06-existing-buildings.md) | office + house as measured proof |
| 07 | [Investor section](07-investor-section.md) | what investors ask, how the platform answers |
| 08 | [Future releases](08-future-releases.md) | Release 2 and 3 at a higher level, and what Release 1 does to be ready |
| 09 | [Success criteria](09-success-criteria.md) | technical and business KPIs, measurement plan |
| 10 | [Architecture & stack](10-architecture-and-stack.md) | technical architecture, integrations, security, hosting |
| 11 | [Brand & content](11-brand-and-content.md) | identity from the logo, tone, content inventory, photo/drone plan |
| 12 | [Roadmap & backlog](12-roadmap-and-backlog.md) | build order, epics, definition of done |
| 13 | [Open questions](13-open-questions.md) | what needs Sigve / the energy group / the municipality |

Companion material already produced: `../web/` (GLB assets), `../data/` (plots, trees, road, schemas),
`../renders/` (stills + fly-in), `../blender/` (master scene), `../pipeline/` (reproducible scripts).

## The one idea

> **Knotten is the first housing field you can stand on before it exists — true to the centimetre,
> true to the sun, true to the minute.**

Everything the platform does follows from that sentence:

- **True to the centimetre** — the hill is Kartverket's 1 m LiDAR, the trees are the measured canopy,
  the roofs of the existing buildings are the measured surface model. Not an artist's impression.
- **True to the sun** — the sun in the 3D view is the real sun for Knotten on the date and time the
  visitor chooses. Sun hours per plot on 21 December are computed, not promised.
- **True to the minute** — the same 3D model becomes the digital twin: live weather now, live energy
  when the houses exist. The website is the first screen of the twin, not a brochure that gets thrown away.

Nobody in Norwegian residential marketing does all three on one model. That is the differentiator,
and it is also exactly what the energy ambition needs (real terrain shading, real horizon, real meters).

## Principles

1. **Measured beats rendered.** Every number on the site has a source and a date (provenance chip).
   Where something is provisional it is labelled provisional.
2. **One model, many surfaces.** Blender master → web GLB → digital twin. Same IDs everywhere.
3. **Emotion first, evidence one click away.** The hero is cinematic; the proof is a tap deeper.
4. **Winter honesty.** Show 21 December, not only midsummer. At 58° N that is what buyers fear and
   what the energy concept must survive. Honesty converts.
5. **Mobile is the investor meeting.** The interactive 3D must run on a mid-range phone.
6. **Built for Release 3 from day one.** IDs, time-series schema, roles and the asset pipeline are
   designed so the resident portal and the twin are additions, not rewrites.
7. **Norwegian first.** Bokmål primary, English toggle for international investors.

## Glossary

| Term | Meaning |
|---|---|
| Field (*feltet*) | the whole Knotten development |
| Plot (*tomt*) | one house site, `plot-NN` |
| Building / unit | the house on a plot; a block may hold several units |
| System | PV, battery, heat pump, EV charger, hub, storage — `plot-07/a/pv-1` |
| Meter / reading | a metering point (Elhub or local) and its time series |
| Twin | the 3D model bound to live data |
| Before / After | today (LiDAR reality) vs built (plan) on the same model |
| Sun passport | the per-plot card of measured sun and view facts |
