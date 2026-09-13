# 12 · Roadmap and backlog

No deadline was set; quality is the constraint. Order is by dependency, not by date.

## Phase A — Foundation (repo, data, design)
1. Repos, environments, CI; Supabase project (EU); CMS project
2. Schema + migrations from 04; seed `plot` from `plots.json`; `assumption` seeded with provisional values
3. Design system from 11 (tokens, type, components); Storybook
4. Asset pipeline CI: validate + publish `web/` and `data/` with version

## Phase B — The five moves (public landing)
5. Hero scrub (frames) + video fallback + reduced motion
6. 3D scene: layers, sky/sun, forest instancing, state machine, wipe pass
7. Stand-on-plot cameras, date dial, view corridor, passport component + share card generator
8. Proof slider (needs Sigve's photograph)
9. Living-field overlay on model/mock frames; outage switch
10. Landing copy, i18n, SEO, analytics events

## Phase C — Pages and conversion
11. Plots list/pages, area, project, news, contact, interest registration + email
12. Existing buildings page with history charts (needs meter export)
13. Investor public page

## Phase D — Portal (Release 1 scope)
14. Auth + roles; admin: users, assumptions versioning, KPI dashboard
15. Data room + NDA e-sign; scenario explorer
16. Project workspace; document sharing; municipality report exports; research datasets v1
17. Twin viewer (admin-only) on model frames

## Phase E — Release 2
18. Meter integrations (Elhub/HAN/inverters); resident portal; energy dashboard
19. Scheduled municipality packs; stakeholder comments; UiA API keys

## Phase F — Release 3
20. Live twin; optimisation recommendations; community sharing settlement; smart-home bridge

## Definition of done (every feature)
Works on mobile; NO + EN; numbers bound to assumptions with provenance; events emitted; accessible
equivalent; reviewed by Sigve for claims; performance budget met.

## Inputs that unblock quality (see 13)
Georeferenced plan → re-run pipeline; gnr/bnr → parcel; Norge i bilder or drone ortho → textures;
grillbu photo → proof; meter data → existing buildings; energy contract v1 → living field and investor numbers.
