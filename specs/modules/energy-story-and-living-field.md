# Module · Energy story and the living field

**Purpose** Make the energy concept visible, credible and (later) live.
**Users** everyone; the energy group as data owner.

## Energy story `/energi`
Sections bound to the contract: energy demand vs TEK17; PV on roofs (with the real horizon shading from
`plots.json.horizon_deg_by_bearing`); storage (battery, and the sand-silo idea as a labelled option);
hub and distribution; V2G/V2H; robustness (islanding hours); future scenarios. Each section has a
"what this means for you" line and a provenance chip.

## Living field (3D overlay)
The field drawn with its energy: roof glow = production, window warmth = consumption, flows = sharing,
hub pulse = storage. Controls: date dial (shared with stand-on-plot), **outage switch**, speed.
Data by release: R1 — frames generated nightly from the energy group's model (hourly, per plot,
typical days per month); R3 — live meters (15 min).

Frame contract: `GET /api/energy/frame?ts=` →
`{ts, plots: {plot-07: {pv_kw, load_kw, soc, sharing_to: [{plot, kw}]}}, field: {import_kw, export_kw, soc}}`.

## Winter honesty
Default date is 21 Dec. The overlay shows small PV and large storage draw. The narrative explains why
the concept still works (storage sizing, sharing, hub). Midsummer is one drag away.

## Acceptance
- Overlay runs at 60 fps desktop / 30 fps mobile with 27 houses
- Switching from model to live frames requires no code change (same contract)
- Every figure in `/energi` resolves to an assumption with version
