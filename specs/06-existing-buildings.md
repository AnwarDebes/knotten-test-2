# 06 · Existing buildings — measured proof

The office building and the house on the property are the only parts of Knotten that already produce
data. They bridge theory and practice, so they get their own section of the public site and their own
module in the twin.

## What they are in the model
Both stand in `existing_buildings.glb` with LiDAR-profiled roofs (from Kartverket DOM). Give them
stable IDs: `existing-office`, `existing-house`. Their roof planes' orientation and pitch are measured —
so the PV yield estimate for them is grounded, and it becomes the calibration case for the whole field.

## Data to collect (Sigve)
- Elhub metering-point IDs for both; historical consumption 15 min/1 h, as far back as available.
- Heated floor area, construction year, heating system, any upgrades with dates.
- Any local production (PV) or battery already installed, with inverter logs.
- Photos, and permission to publish aggregated figures.

## Public page `/energi/eksisterende`
1. **History** — monthly consumption bars for the last 2–3 years; year-over-year overlay; heating-degree-day
   normalisation so weather doesn't masquerade as savings.
2. **Live** — current week at 1 h resolution from the meters (once connected); a small "now" tile.
3. **Before / after upgrades** — vertical bands mark each intervention (heat pump, insulation, PV);
   the chart shows measured effect, with an honesty note where the effect is within noise.
4. **Calibration** — "Our model predicted X kWh for this roof; the meter says Y." When the field's PV
   estimates use the same method, this is the credibility anchor for investors.
5. **Robustness demo** — if a battery/UPS exists: a logged outage or a staged islanding test with the trace.

## In the twin
Both buildings carry live meters. They are the first two nodes of the field graph, so the living-field
overlay has real data from day one — the rest of the field can run on model output until built.

## Success measure
A visitor can answer "did the upgrades actually work?" from the page alone, with sources.
