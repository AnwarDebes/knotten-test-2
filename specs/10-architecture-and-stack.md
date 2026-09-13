# 10 · Architecture and stack

## Overview
```
[Browser]  Next.js app (SSR/ISR) + react-three-fiber scene + CMS content
    │           │                          │
    │      /api routes ──────────► Postgres + PostGIS + Timescale (Supabase, EU region)
    │                                   ▲            ▲
    │  Storage (GLB, textures, renders, docs, datasets) ── CDN
    │                                   │
[Integrations] Elhub / HAN readers / inverter APIs / MET Norway / spot price / e-sign / email
[Jobs]        nightly: energy frames, reports, KPI rollups, backups; on-demand: passport cards
[Pipeline]    Blender + Python (this repo) → assets + data → uploaded with a version
```

## Choices
| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | SSR for SEO on public pages, API routes, one codebase for portal |
| 3D | three.js via react-three-fiber + drei; Draco + KTX2 loaders | instancing, custom passes (wipe, overlay), large ecosystem |
| Data | Supabase: Postgres + PostGIS + Auth + Storage + Realtime; Timescale extension for `reading` | roles, row-level security, EU hosting, grows to R3 |
| Content | Sanity (or Payload) with NO/EN locales | editors (students, Sigve) without deploys |
| Hosting | Vercel (EU) + Supabase (EU) + CDN for assets | simple, fast, cheap |
| Analytics | Plausible/Umami (EU) + first-party events | GDPR without banners |
| Email | Resend/Postmark | leads, digests |
| E-sign | Signicat/Scrive (BankID) | NDA, reservations |
| Weather | MET Norway Locationforecast | live sky in the twin |
| Prices | Nord Pool via Hvakosterstrømmen / Tibber API | scenario explorer, optimisation |
| Meters | Elhub (authorised), HAN-port readers (Tibber Pulse / AMS), inverter APIs (SolarEdge, Fronius, Huawei) | R2/R3 |
| Smart home | Home Assistant per home, Matter where available; bridge service | R3 |
| Auth | Supabase Auth; BankID later for residents | Norwegian trust |

## Security
Row-level security per role; documents in private buckets with signed URLs; audit log on downloads and
assumption changes; 2FA for admin/energy_team; rate limiting on public APIs; dependency scanning; backups
with restore drill.

## Environments
`dev` → `preview` (per PR) → `prod`. Assets versioned by `manifest.json.built_at`; database migrations
in repo; assumptions published via admin with version history.

## Repositories
- `knotten-web` — Next.js app, API, CMS schemas, i18n
- `knotten-pipeline` — this package's `pipeline/` (Blender + Python), CI job that validates `plots.json`
  against schema and publishes assets
- `knotten-energy` — the energy group's models and their contract uploads (they own it)

## Coding conventions
IDs from the spine everywhere; no numbers in JSX (bind to assumptions); components for each of the five
moves; storybook for the passport and overlay; e2e tests for register-interest and data-room access.
