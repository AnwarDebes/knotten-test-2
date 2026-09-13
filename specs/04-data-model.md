# 04 · Data model

## The spine
`field → plot → building → unit → system → meter → reading`
plus `document`, `stakeholder`, `lead`, `assumption`, `event`, `report`, `dataset`.

The same IDs are used in `plots.json`, the GLB object names, the CMS, the database and the twin.
IDs are stable strings, never renumbered: `plot-07`, `plot-07/a` (building a on plot 7),
`plot-07/a/pv-1`, `meter:elhub:707057500012345678`.

## Entities (Postgres + PostGIS)

| Table | Key fields |
|---|---|
| `field` | id, name, parcel (polygon, EPSG:25832), assumptions_version |
| `plot` | id, field_id, geom (polygon), centroid, ground_z, floor_z, row, status (`available/reserved/sold`), price, house_type_id, analysis (jsonb from `plots.json`), provenance |
| `building` | id, plot_id, kind (`house/block/existing_office/existing_house/hub`), footprint, floors, heated_area_m2, class (`TEK17/lavenergi/passivhus/plusshus`) |
| `unit` | id, building_id, resident_user_id |
| `system` | id, building_id or field_id, type (`pv/battery/heat_pump/ev_charger/hub/wind/geothermal/sand_storage/inverter`), rated_kw, capacity_kwh, vendor_model |
| `meter` | id, system_id or building_id, source (`elhub/han/local/model`), measures, unit, resolution |
| `reading` | meter_id, ts (timestamptz), value — **hypertable / partitioned by month** |
| `assumption` | key, value, unit, low, high, source, date, version, published_by |
| `document` | id, title, file, visibility (roles), tags, version |
| `stakeholder` | id, org, person, role, contact, consent |
| `lead` | id, email, phone, plots_of_interest[], consent, source, utm, created_at |
| `event` | analytics event (see 09) |
| `report` | id, kind (`municipality/investor/quarterly`), period, generated_file, inputs_version |
| `dataset` | id, name, licence, path, schema, access (`public/researcher`) |

## Files that seed the database
- `data/plots.json` → `plot.analysis` + geometry
- `data/trees.json` → static asset (not a table)
- `data/road.json`, `data/clearing.json` → static assets + `document`
- `data/schemas/energy_contract.schema.json` → validation for the energy group's uploads → `system`, `assumption`, `meter`

## Provenance
Every displayed number is an `assumption` or a computed field with `{value, unit, source, date, version}`.
The UI renders a chip; the admin can publish a new `assumptions_version`, and every page re-renders with it.
No hard-coded figures in components.

## Time series
- Resolution: 15 min (Elhub standard) and 1 h; store raw, aggregate on read.
- Units: kWh per interval, kW instantaneous, °C, % SOC. UTC storage, CET/CEST display.
- Sources: Elhub (via authorised access), HAN-port readers, inverter APIs, the energy group's model output
  (flagged `source=model`).
- Retention: forever for the field (research value), residents can export/delete their own (GDPR).

## API surface (internal, used by web + twin)
```
GET  /api/plots                      list with analysis summary
GET  /api/plots/:id                  full record incl. horizon profile
GET  /api/plots/:id/passport.png     generated share card
GET  /api/energy/frame?ts=           the overlay frame for the living field
GET  /api/energy/series?meter=&from=&to=&res=
POST /api/leads                      interest registration
POST /api/energy/contract            energy_team upload (validated against schema)
GET  /api/reports/:id                gated
GET  /api/research/datasets          gated
```

## Privacy
Leads and residents are personal data (GDPR, Norwegian Datatilsynet). Data minimisation, explicit consent
per purpose (updates / investor contact / research), export and delete endpoints, EU hosting.
Meter data is personal data for residents: aggregate at field level for public views.
