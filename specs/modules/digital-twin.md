# Module · Digital twin

**Purpose** The same 3D model, bound to data — first modelled, then live.
**Users** admin/energy team (R1), residents/investors/municipality (R3).

## Release 1 (admin, modelled)
The living-field overlay in the twin route with a history scrub over the model's typical days;
weather from MET Norway drives the sky so the field looks like Knotten *now*.

## Release 3 (live)
- Live frames every 15 min from meters; history scrub over real data; outage replay
- Per-house drill-down (own data for residents, aggregate for others)
- Operations: fault highlighting (a roof dimmer than its neighbours under the same sun), maintenance markers
- Construction progress: as houses are built, flip `plot.status` and swap placeholder houses for as-built
  models (photogrammetry from drone) — the before/after gains a third state: *as built*

## Data
frame API; `reading`; weather; `plot.status`; as-built assets.

## Acceptance
- Twin and public living field share one component; only the data source differs
- A resident's home shows their data within 15 min of the meter reading
