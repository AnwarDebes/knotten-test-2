# Knotten site: the standing brief (written 2026-09-13 night, before the user's demo)

The user (Anwar) is asleep and expects to wake up to a finished, production-ready site. Work autonomously.
This file exists so nothing is lost across context compaction. Read it fully before continuing.

## Who and what
- Project: Knotten, Sjøutsikt i Rødberg. Sigve Simonsen AS builds "Norges mest energivennlige boligfelt":
  about 30 homes on the knoll Knotten (58.0675 N, 7.279 E, Lindesnes, Agder), above Snigsfjorden where the
  Audna meets the fjord. Parcel gnr 355 bnr 10 (39 431 m²) + bnr 368 = 40 181 m². The flat plots by
  Rødbergsveien have no sea view (Sigve). The office (19 offices now, 28 planned), the residential house (121/123),
  a planned office extension and a planned workshop behind the house are in the project area.
- People: Anwar (website, digital platform, both tracks), Sujata (marketing, track 2), Henrik (energy, track 1),
  Sigve (owner). NO names of students on the site. Sigve is not technical; Anwar demos.
- Roles wanted: user, admin, superadmin. Preview login exists (cookie), Nav shows who is logged in.

## Hard rules from the user
- No em dashes or en dashes anywhere on the site.
- Light and smooth: production mode for demos; 3D framed, never full screen; never trap the scroll; no scroll-jacking.
- Not "AI design". Rejected: cream+serif, dark+Fraunces, the amber sun-arc figure ("not informative"), the
  version with the film as hero + big statement + before/after wipe ("still looks bad").
- The journey must be the main landing hero (from fjord, to field, onto a plot, into the living room), the
  fly-in video only small on the side. Remove the before/after drone-render wipe (user disliked that image).
- Background: small cool animations, but light (canvas particles / gradients, pause when hidden).
- Logo: the real round logo (KNOTTEN, Sjøutsikt i Rødberg, Sniksfjorden Lindesnes, Sigve Simonsen AS).
  Not on disk (not in the docx media either). Logo.tsx uses /assets/incoming/logo.png if present.
- AI chat icon must look good ("Knotten AI", placeholder, no live data).
- Consistency: the Blender renders/video and the browser 3D must show the same houses in the same places.
  relayout_v2.py rebuilds Blender from data/plots.json; make its house geometry match Proposal.tsx.
- Real admin dashboard/CRM for Sigve: leads pipeline, plot status/prices, news, documents, assumptions, roles.
- Include all provided material: work structure (tracks 1/2, phases, deliverables), Sigve's energy direction
  (4 Sep 2026), Sigve's feedback on release 1 (vision, releases 2/3, investor questions, existing buildings,
  digitalisation beyond website, business success criteria), energy budget spreadsheet, EED borehole field,
  Henrik's measures table, view photographs (site/public/assets/incoming/web/photo_*.webp), maps, terrain
  profile (409.5 m A to B), plan sketch, internship posting, parcel email.
- Layout v3 (2026-09-14 rerun) is final: exactly 30 plots, 26 hill all with measured sea view (22 open sea), 4 flat
  by Rødbergsveien. pipeline/plan_layout_v3.py (MIN_SPACING 15, EDGE_MARGIN 12, flats fill to TOTAL 30).

## State of the build (update as you go)
- Two designs (2026-09-27): Sigve liked both, so the Klassisk design (was the separate knotten-web repo) now lives in
  this site as the DEFAULT at / (src/app/(klassisk)), and this design is "Moderne" at /no and /en (src/app/(moderne)).
  A strip above both headers, "Utseende: Klassisk | Moderne", switches to the matching page (src/lib/design.ts) and a
  cookie makes / remember the choice (src/proxy.ts). Leads, login and the portal are shared. See README "Two designs".
- Round 6 (2026-09-14, after the user's morning feedback): LIGHT palette from the logo (cool white, navy ink #17283a,
  fjord blue, pine, amber sun), no dark page. Motion.tsx: scroll progress bar, pointer ring, .rise reveals via
  IntersectionObserver, Words headline reveal. Ambient is CSS-only gradients (no motes; the user disliked them).
  Logo.tsx falls back to a Cinzel wordmark until logo.png exists. Store writes to /tmp on Vercel.
- Round 5 done 2026-09-14: (superseded palette) dark fjord-night design (globals.css), journey Stage as landing hero (hero prop,
  auto-start), fly-in card beside it, photo strip, energy panel with the energy group's figures, canvas Ambient,
  Knotten AI pill (Chat.tsx), no ScrollWipe. Content pages enriched from the PDFs (prosjektet, investor, omradet,
  utsikt). Admin CRM: site/src/app/[locale]/portal/admin/* + lib/store.ts (site/data/crm.json), server actions.
  Five example leads (source "eksempel") seeded, removable from the admin overview.
- Blender re-render: stills done 2026-09-14 early morning; fly-in frames rendering (about 45 s each, 72 frames);
  renders/after_render.ps1 copies the mp4 to site/public/renders/knotten_flyin_720p.mp4 when done and refreshes WebPs.
- Production server: `cd site && npm run build`, then start detached with PowerShell Start-Process cmd.exe
  "/c npm run start -- -p 3000 > ..\renders\prod_server.log 2>&1" with WorkingDirectory site.
- Logo still missing on disk: drop the round logo at site/public/assets/incoming/logo.png.
