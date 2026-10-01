/**
 * The single source of truth for the project's facts, read by both designs (Klassisk and Moderne)
 * and the portal: the source quotes behind every "Kilde" chip, the headline figures, the energy data,
 * the contact details, the work plan and the document register. The pages keep their own layout and
 * wording; the numbers, dates and contact details both designs share come from here. Checked against the
 * verified source folder (knotten-source-informations) on 27 September 2026, with the project group's
 * decisions of the same day (sand battery dropped, wind under evaluation, four rows, 243 567 kWh solar).
 */
export * from "./core";
export * from "./sources";
export * from "./energy";
export * from "./figures";
export * from "./project";
