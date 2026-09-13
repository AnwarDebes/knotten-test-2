# 09 · Success criteria

## Business (Sigve's §6)

| KPI | Definition | Target (first 6 months live) | Source |
|---|---|---|---|
| Registrations | interest forms completed with consent | 150 | `lead` |
| Conversion | visitors → registration | ≥ 3 % | events |
| Passport shares | passport cards opened from a shared link | 300 | events |
| Investor interest | data-room access requests; NDAs signed | 15 / 8 | portal |
| Engagement | median time in *Stå på Knotten*; % who use the date dial; % who use the wipe | 90 s / 40 % / 60 % | events |
| Stakeholder participation | municipality + partner logins; documents downloaded; comments | monthly active ≥ 6 | portal |
| Reservations | plots reserved (when sales open) | — | `plot.status` |
| Press / reference | mentions, "reference project" citations | — | manual |

## Technical
- Core Web Vitals: LCP < 2.5 s (hero video poster), INP < 200 ms, CLS < 0.1
- 3D: ≥ 30 fps on a 2023 mid-range Android; ≥ 60 fps desktop; < 8 MB before interactive
- Availability 99.9 %; backups daily; restore tested quarterly
- Accessibility WCAG 2.1 AA for all non-3D paths; 3D has equivalents
- Data: 100 % of displayed numbers carry provenance; zero unsourced figures in audits

## Measurement plan
Cookieless analytics (Plausible or Umami, EU-hosted) for traffic; first-party `event` table for product
events — no consent banner needed for the default set; consent gate only if marketing pixels are added later.

Event taxonomy (name · props):
`hero_scrubbed` · depth% | `wipe_used` · state | `plot_selected` · plot_id | `dial_changed` · month, hour |
`passport_viewed` · plot_id, shared:bool | `proof_slider_used` · position | `overlay_outage_toggled` |
`lead_submitted` · plots[], source | `investor_access_requested` | `doc_downloaded` · doc_id, role |
`twin_viewed` · role.

KPI dashboard in `/portal/admin` with weekly email digest to Sigve.
