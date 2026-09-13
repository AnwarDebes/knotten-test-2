# Module · Municipality reporting

**Purpose** Give Lindesnes kommune the basis for regulation and later compliance, from the same data.
**Users** municipality case handlers, Sigve.

## Release 1 — exports
- Regulation basis pack: site map with LiDAR contours, parcel, plan overlay, road profile with grades
  (`road.json`), cut/fill per plot, view analysis summary, sun analysis summary, energy concept summary
- PDF + GIS files (GeoJSON/SOSI in EPSG:25832) generated from the pipeline outputs
- Municipality role: view/download, comment on a pack

## Release 2 — scheduled
- Periodic energy performance report (field kWh, self-sufficiency, CO₂), occupancy, plan compliance
- Correspondence log; version history per pack

## Acceptance
- A pack can be regenerated after the plan changes without manual editing
- All coordinates in packs are EPSG:25832 and match Matrikkel parcel
