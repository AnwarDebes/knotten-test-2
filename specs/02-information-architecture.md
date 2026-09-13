# 02 · Information architecture

## Sitemap (public, `knotten.no` or agreed domain)

```
/                      Landing: the five moves (hero, wipe, stand on plot, proof, living field), CTA
/tomter                Site plan + plot list (sortable by sun, view, size, price status)
/tomter/plot-07        Plot page: 3D viewpoint, sun passport, house type, energy profile, availability
/tomter/plot-07/passport  Shareable card (OG image generated server-side)
/energi                The energy concept: hub, PV, storage, sharing, robustness — with the living-field view
/energi/eksisterende   Existing office + house: measured performance, before/after upgrades
/utsikt                The view: corridor map, grillbu proof slider, photo gallery, drone footage
/omradet               The area: Rødberg, Snigsfjorden, Lindesnes, distances, services, school
/prosjektet            Vision, timeline, regulation status, team, UiA collaboration, partners
/investor              Public investor page: thesis, numbers with provenance, request data-room access
/nyheter               Updates (regulation milestones, site work, student deliveries)
/kontakt + /interesse  Contact, interest registration (the primary conversion)
/personvern            Privacy (GDPR), cookie policy (analytics is cookieless by default)
/en/...                English mirror of the above
```

## Authenticated areas (same app, role-gated)

```
/portal                Landing after login, role-aware
/portal/investor       Data room, financial model, scenario explorer, updates, Q&A
/portal/resident       My home, my energy, documents, support, community
/portal/energy         Field energy dashboard (residents see field level; admins see all)
/portal/twin           Digital twin viewer (3D bound to live/modelled data)
/portal/project        Project workspace: tasks, documents, decisions, stakeholders, meetings
/portal/municipality   Reporting packs, plan documents, correspondence
/portal/research       UiA research space: datasets, API keys, exports, publications
/portal/admin          Users, roles, content, assumptions file, KPI dashboard, integrations
```

## Roles

| Role | Sees | Can |
|---|---|---|
| public | public site | register interest, download passport |
| lead | + saved plots | receive updates |
| investor | + data room, model | comment, request docs |
| resident | + own home, own meters, community | control own smart-home links (R3) |
| contractor | + project workspace (scoped) | update tasks, upload docs |
| municipality | + reporting packs | download, comment |
| researcher | + datasets, API | export within licence |
| energy_team | + assumptions, contract upload | publish numbers with a version |
| admin | everything | everything |

## Navigation
- Top bar: *Tomter · Utsikt · Energi · Området · Prosjektet · Investor · Kontakt* — language toggle — *Logg inn*.
- Persistent CTA: *Meld interesse* (register interest).
- Footer: partners (Sigve Simonsen AS, UiA), data sources and licences, privacy.

## Languages
Norwegian Bokmål primary; English full mirror. Route prefix `/en`. Content in a headless CMS with
locale fields; UI strings in i18n files. Numbers formatted per locale (spaces as thousands separators
in NO).

## Content types (CMS)
`page`, `news`, `plot` (mirrors `plots.json` id, adds price/status/house type), `houseType`,
`energyStory` (sections with data bindings), `partner`, `document` (gated), `faq`, `assumption` (value,
unit, source, date, version), `milestone`.
