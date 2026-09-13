# 08 · Future releases — and what Release 1 does to be ready

Sigve's brief: describe Releases 2 and 3 at a higher level to show the architecture is prepared.
This document does that — and, since everything is to be built, it also states the concrete preparation
that lands in Release 1 so R2/R3 are additions.

## Release 1 — Public platform (build now, full quality)
Landing with the five moves, plots and passports, energy story with living-field overlay on modelled data,
existing-buildings proof, investor page + data room, interest registration, analytics, CMS, i18n,
project workspace (internal), municipality reporting v1 (exports), research space v1 (datasets).

**Readiness work included in R1**
- ID spine and Postgres schema incl. `reading` hypertable (empty is fine)
- Auth with the full role list; only `investor`, `energy_team`, `admin`, `contractor` active
- Energy contract validation endpoint
- Overlay component reads a `frame` API — R1 serves model/mock frames
- Twin viewer route exists behind `admin`
- Assumptions versioning + provenance chips
- Event taxonomy for KPIs (09)

## Release 2 — Private platform
- **Resident portal**: my home, documents, warranty, support tickets, community board
- **Energy dashboard**: own meters (Elhub/HAN), field aggregate, comparisons to modelled expectation
- **Document sharing / stakeholder collaboration**: extended workspace with external partner roles
- **Municipality reporting**: scheduled packs (energy performance, occupancy, plan compliance)
- **UiA research collaboration**: anonymised datasets, API keys, publication log
Prepared by: roles, tables, APIs from R1. New: meter integrations, notification service, e-sign.

## Release 3 — Intelligent platform
- **Digital twin live**: the living field on real meters; history scrub; outage replay
- **AI-based optimisation**: day-ahead scheduling of batteries/EVs/heat pumps against spot price and
  weather; recommendations first, control later — with resident consent and an override
- **Community energy sharing tools**: allocation rules, settlement statements, fairness dashboard
- **Smart-home integration**: Home Assistant / Matter bridge per home; the twin shows device states
- **Digital twin for operations**: fault detection (a PV string under-performing vs its neighbours), maintenance
Prepared by: time-series schema, system IDs, the overlay's frame contract, the recommendation API stub.

## Digitalisation beyond the website (Sigve's §5)
Yes — and cheaply, because the spine already exists:
- Internal project management: workspace module (R1) — tasks, decisions, meeting notes tied to plots/systems
- Document sharing: `document` with role visibility and versions (R1)
- Stakeholder collaboration: partner roles, comment threads on documents and plots (R2)
- Municipality reporting: report generator from the same data (R1 exports → R2 scheduled)
- Research with UiA: dataset registry, API keys, licence terms (R1 v1 → R2)
The long-term value: one database that outlives the marketing phase and becomes the field's operating record.
