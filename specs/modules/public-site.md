# Module · Public site

**Purpose** Make people want Knotten, then let them verify it, then let them act.
**Users** buyers, investors (first contact), municipality, neighbours, press.

## Features
1. Landing with the five moves (see 01): hero scrub, wipe, stand on plot, proof, living field
2. Sticky CTA *Meld interesse*; secondary *Se tomtene*
3. Pages: `/tomter`, `/utsikt`, `/energi`, `/energi/eksisterende`, `/omradet`, `/prosjektet`, `/investor`, `/nyheter`, `/kontakt`
4. Interest registration: name, email, phone (optional), plots of interest (from the 3D), purpose
   (buy / invest / partner / curious), consent per purpose; double opt-in email; admin notification
5. News with milestones (regulation, site works, student deliveries)
6. Language toggle NO/EN; SEO; OG images (plot passports)
7. Reduced-motion and no-WebGL fallbacks

## Data
CMS content; `plots.json` (analysis); `assumption`; `lead`.

## 3D integration
Landing embeds the scene once and keeps it mounted across moves (no reload). Deep links:
`/?plot=plot-07&date=2026-12-21T12:00&state=built` reproduce a view.

## Acceptance
- LCP < 2.5 s; hero video poster is a real frame
- A buyer can go from landing to a shared passport in under 60 s on a phone
- All numbers show provenance chips; provisional labels visible
- Registration works end-to-end with consent records stored
