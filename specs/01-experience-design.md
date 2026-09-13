# 01 · Experience design

## The signature experience: *Stå på Knotten* ("Stand on Knotten")

The whole site is built around one interaction nobody has offered before: **the visitor stands on a
plot that does not exist yet and sees exactly what they would see — at any date, any time, before and
after, with the real sun and the real horizon — and every claim is verifiable.**

It has five moves. Each one is a section of the landing page, and each is also a reusable component.

### Move 1 — Arrive (cinematic hero)
Pre-rendered fly-in (`renders/knotten_flyin_720p.mp4` and the PNG frame sequence for scroll-scrubbing).
The camera comes in over Snigsfjorden, up the Audna, over the farms, and settles above the field.
Text arrives with the camera: *Knotten — sjøutsikt i Rødberg.* On scroll the frames scrub; on a phone the
video plays. No 3D engine yet — this is guaranteed photoreal and instant.

### Move 2 — The wipe (before / after)
The hero frame hands over to the real-time model at the same camera. A vertical wipe lets the visitor
drag between **today** (LiDAR forest, exactly as it is) and **built** (field cleared, road, houses).
Both states share terrain, sun and horizon, so nothing shifts except what the project changes.
Alternative controls: a toggle, and a timeline with four stops — *I dag · Ryddet · Bygget · Bebodd*
(today · cleared · built · lived-in). *Bebodd* adds lights in windows and PV on roofs; later it is the twin.

### Move 3 — Stand on your plot
The visitor picks a plot on the site plan (or taps a house). The camera drops to the living-room floor of
that plot, eye height, facing the view. Two dials:

- **Date/time dial** — the sun is the real sun for Knotten. Default: 21 December 12:00. Dragging the dial
  through the day shows sun clearing the ridge; dragging through the year shows midsummer. First and last
  sun are marked on the dial from `plots.json`.
- **View corridor** — the bearings from which open sea is visible are highlighted on the horizon as a
  glowing arc. The visitor can turn the head; the arc stays where the sea is.

Under the view, the **Sun passport** for the plot: sun hours on 21 Dec / 21 Mar / 21 Jun, sea-view degrees,
open sea yes/no, elevation, slope. Each figure has a provenance chip ("Kartverket LiDAR 1 m · computed
2026-09-05"). Shareable as a card (`/plot/07/passport`), which is the lead magnet: a buyer sends it
to their partner.

### Move 4 — Proof
A slider between the **real photograph** taken from the neighbour's grillbu and the **model rendered
from the same point**. When the horizon lines up, the visitor has just verified the model themselves.
Then the slider continues past the photograph into the built state: "this is what the camera can't
show yet." This section is where the energy story starts, because the same model that proved the view
is the one that computes the shading on every roof.

### Move 5 — The living field (energy made visible)
The energy concept is not a diagram; it is drawn on the landscape. Over the 3D field:

- roofs glow with **PV production** (sun-driven, so it changes with the date dial — winter honesty again),
- windows warm with **consumption**,
- **energy sharing** between homes is animated as flow along the field's own grid,
- the **hub / storage** pulses with state of charge,
- an **outage switch**: cut the grid, watch the field keep running on its own storage — the robustness
  promise, as a thing you can see.

In Release 1 this runs on the energy group's modelled numbers (or mock data labelled as such). In
Release 3 it runs on live meters. Same component, same IDs, different data source.

## Secondary journeys

| Visitor | Wants | Path |
|---|---|---|
| Buyer | "Would I love living there?" | Hero → wipe → stand on plot → passport → register interest |
| Investor | "Is this real, does it pay, does it scale?" | Hero → proof → living field → investor section → data room |
| Municipality / partner | "Is it serious and well-founded?" | Proof → regulation basis → reports |
| Neighbour / local | "What will I see?" | Stand on *their* point (grillbu, Raudberg) |
| Student / researcher | "Can I use the data?" | Research space |

## Emotional arc
Sea and light first (the reason to want it), then truth (the reason to believe it), then energy (the reason
it's smart), then people (the reason it's a community), then action (register / invest / partner).

## Accessibility and honesty rules
- Every 3D interaction has a non-3D equivalent (stills, tables). The passport works without WebGL.
- Reduced-motion users get stills instead of the scrubbed fly-in.
- Provisional data is visibly labelled *foreløpig*. No number without a source.
- Winter view is default, never hidden behind a midsummer-only preset.
