# 13 · Open questions and inputs needed

| # | Needed | From | Unblocks | Status |
|---|---|---|---|---|
| 1 | Site plan file (PDF/DWG/SOSI) or image + 2 known points | Sigve / planner | real house positions, road, clearing; all per-plot numbers regenerate | open — layout is provisional |
| 2 | gnr/bnr of the property | Sigve | exact parcel polygon from Matrikkel | open |
| 3 | Grillbu photograph (original file) + exact spot | Sigve | proof slider, second calibration | open — model camera placed by estimate |
| 4 | Norge i bilder login (Geonorge) or drone orthophoto | Sigve / UiA / students | 10 cm ground texture, licence for public use | open — Esri used for study |
| 5 | House types: footprint, storeys, floor levels, blocks vs standalone | Sigve / architect | houses, cut/fill, view from real floor heights | open — 11 × 8.5 m placeholder |
| 6 | Elhub IDs + history for office and house | Sigve | existing-buildings page, calibration | open |
| 7 | Energy contract v1 (per schema) | energy group | living field on real model output, investor numbers | open — schema delivered |
| 8 | Prices, availability, sales process | Sigve | plot pages, reservations | open |
| 9 | Domain, hosting account, CMS account, e-sign vendor | Sigve | deployment | open |
| 10 | Brand assets (logo vector, fonts) | Sigve | design system | open |
| 11 | Regulation timeline and municipality contacts | Sigve | project page, reporting module | open |
| 12 | Consent texts / privacy policy review | legal | leads, residents | open |

## Decisions already taken (change if you disagree)
- Coordinate origin at the given point; local metres; UTM32 alongside
- Web terrain tiers 2 m / 5 m / 50 m / 250 m; trees instanced from JSON
- Default 3D moment: 21 December 12:00
- Norwegian primary, English mirror
- Supabase + Next.js + r3f stack; EU hosting; cookieless analytics
- Provisional layout: 4 contour rows, 27 plots, houses face downhill
