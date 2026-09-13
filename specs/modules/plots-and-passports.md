# Module · Plots and sun passports

**Purpose** Turn the terrain analysis into the buying decision.
**Users** buyers, Sigve (status), investors (demand signal).

## Plot list `/tomter`
Interactive top-down plan (orthographic 3D, `Cam_Plan`) with hover/tap; list beside it sortable by
sun on 21 Dec, sea-view degrees, size, elevation, status. Filters: open sea visible, row, house type.

## Plot page `/tomter/plot-NN`
- Stand-on-plot 3D viewpoint with date dial and view corridor
- Sun passport: sun hours 21 Dec / 21 Mar / 21 Jun with first/last sun; water-visible degrees;
  open sea; elevation; slope; cut/fill; each with provenance
- House type, floor plan (when available), energy profile (from contract), price/status
- "Compare" tray: up to three plots side by side
- CTA: register interest for this plot

## Passport card `/tomter/plot-NN/passport`
Server-rendered image (1200×630) + page: the plot's headline facts and a tiny turntable render.
Shareable; counts as an event.

## Data
`plot` (status, price, house type) + `plot.analysis` from `plots.json` + assumptions.
Regenerate analysis whenever the plan changes (`pipeline/plan_layout.py`).

## Acceptance
- Sorting by 21 Dec sun works and matches `plots.json`
- Passport image generated < 1 s (cached)
- Plot status editable in admin without deploy
