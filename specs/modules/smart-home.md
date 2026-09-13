# Module · Smart-home integration (Release 3)

**Purpose** Let homes participate in the field's energy system and the twin, without lock-in.
**Users** residents, operator.

## Approach
- Per-home Home Assistant (local first), Matter devices where possible; a field bridge service
  exposes only what the resident consents to (e.g. heat pump setpoint, EV charger, battery)
- Standard entity mapping to `system` IDs; state mirrored to the twin
- Security: per-home tokens, local network isolation, audit

## Acceptance
- A resident can connect a device in < 10 minutes and see it in the twin
- Disconnecting removes all control paths immediately
