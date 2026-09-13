# Module · AI-based optimisation (Release 3)

**Purpose** Lower cost and raise self-sufficiency by scheduling flexible loads and storage.
**Users** operator, residents (consent + override), energy team.

## Scope
- Inputs: spot prices (day-ahead), weather forecast (MET), PV forecast per roof (from the real horizon
  profile — the pipeline's `horizon_deg_by_bearing`), load forecasts, SOC, EV plans
- Outputs: recommended schedules for batteries, EV charging, heat pumps, hot water; field-level sharing plan
- Stage 1 recommendations only; Stage 2 automatic control via smart-home bridge with resident consent and a
  visible override; every action logged and explainable ("charged at 02:00 because price 0.31 NOK/kWh")

## Data
`reading`, forecasts, `system`, consents; recommendation and action logs.

## 3D
Recommendations preview in the twin as a "tomorrow" scrub; the outage switch uses the same optimiser
to show islanding strategy.

## Acceptance
- Measured saving vs baseline reported monthly with confidence interval
- No control without consent; override within one tap
