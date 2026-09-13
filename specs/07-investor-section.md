# 07 · Investor section

Two surfaces: the public `/investor` page (thesis + headline numbers) and the gated data room in the
portal. Both read from the same `assumption` records, so they never disagree.

## Questions investors ask, and how the platform answers

| Question | Answer surface | Data source |
|---|---|---|
| Expected energy savings | "vs TEK17 reference home" per house type, field total kWh/yr | energy contract `net_energy_demand`, `annual_import_kwh` |
| Long-term operating cost | NOK/home/yr under 3 price scenarios (low/base/high spot price), 20-yr view | contract `annual_cost_nok`, price scenarios in assumptions |
| Capex premium and payback | premium per home, payback years, sensitivity to subsidy (Enova) | contract `investor.*` |
| Scalability | what is site-specific (view, LiDAR) vs replicable (hub, sharing, platform) — a "Knotten kit" section | narrative + platform architecture |
| Innovation value | firsts: measured-twin marketing, energy sharing, islanding, UiA collaboration, national reference-project ambition | project docs |
| ESG / sustainability | CO₂ avoided/yr, self-sufficiency %, local energy share, biodiversity note (trees cleared vs kept: 3 511 of 31 823) | contract + `trees.json` |
| Is the view real? | proof slider, per-plot passports | LiDAR + photo |
| Is the sun real? | 21 Dec sun hours per plot | `plots.json` |
| Demand | interest registrations, plot reservations (live counters, admin-approved) | leads |

## Scenario explorer (data room)
Sliders: electricity price, subsidy level, PV size per home, battery size, share of homes with V2H.
Outputs recompute client-side from the published assumptions and the energy group's response curves
(they deliver a small table, not a black box). Every output shows the assumptions version.

## Data room contents
Prospectus, regulation status and documents, energy concept report (UiA group), financial model
(xlsx + the same in-app), risk register, team, timeline, Q&A log, NDA flow (e-sign) before access.

## Tone
Facts with sources, no superlatives without a number. The 3D is present but as evidence (proof slider,
living field), not as decoration.
