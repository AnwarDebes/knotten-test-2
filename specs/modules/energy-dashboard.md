# Module · Energy dashboard (Release 2)

**Purpose** See the field's energy as numbers, live and historic.
**Users** residents (field level + own), energy team, Sigve, investors (aggregate), UiA.

## Views
- Now: import/export, production, load, SOC, price; sparkline last 24 h
- Day/week/month/year: stacked production vs load, self-sufficiency %, cost, CO₂
- Per system: PV strings, batteries, heat pumps, EV chargers
- Model vs measured: the energy group's expectation overlaid — the calibration story continues
- Robustness: islanding capability now (hours at current load), outage log
- Alerts: under-performance, faults, price peaks

## Data
`reading` at 15 min/1 h; spot prices; weather.

## Acceptance
- Any chart drills to raw readings; every KPI shows its formula
- 12 months at 1 h renders < 1 s (pre-aggregates)
