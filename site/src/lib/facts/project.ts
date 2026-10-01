import type { Lang, T } from "./core";

/**
 * The project's shared facts outside the energy concept: contact details, the internship, the work plan
 * and the document register. Both designs read them from here and keep their own wording around them.
 * Checked against knotten-source-informations on 27 September 2026.
 */

/** Contact details, as in the internship posting. The place line is the project's location, not a postal
 *  address (none is given in the sources); the user chose it on 27 September 2026. */
export const CONTACT = {
  company: "Sigve Simonsen AS",
  name: "Sigve Simonsen",
  role: { no: "Daglig leder", en: "Managing Director" } as T,
  email: "sigve.simonsen@hotmail.com",
  phone: "954 95 152",
  phone_intl: "+47 954 95 152",
  tel: "+4795495152",
  place: "Knotten, Rødberg, 4520 Lindesnes",
};

/** The internship posting: 300 hours, start by agreement between August and November, deadline 7 July. */
export const INTERNSHIP = {
  hours: 300,
  start: { no: "etter avtale mellom august og november 2026", en: "by agreement between August and November 2026" } as T,
  deadline: { no: "7. juli 2026", en: "7 July 2026" } as T,
};

/** The six phases of the work structure for tracks 1 and 2; `weeks` is null where the date is still to be agreed. */
export const WORK_PLAN: { name: T; weeks: [number, number] | null }[] = [
  { name: { no: "Oppstart", en: "Start" }, weeks: [1, 1] },
  { name: { no: "Befaring", en: "Site visit" }, weeks: null },
  { name: { no: "Research", en: "Research" }, weeks: [2, 4] },
  { name: { no: "Konsept", en: "Concept" }, weeks: [5, 7] },
  { name: { no: "Kvalitetssikring", en: "Quality assurance" }, weeks: [8, 10] },
  { name: { no: "Sluttfase", en: "Final phase" }, weeks: [11, 12] },
];

/** The final phase, when the technical energy report and the market and investor report are delivered. */
export const FINAL_PHASE = WORK_PLAN[WORK_PLAN.length - 1];

/** [11, 12] -> "uke 11 til 12" (no) or "weeks 11 to 12" (en); null -> "dato avtales" or "date to be agreed". */
export function weeks(w: [number, number] | null, lang: Lang = "no"): string {
  if (!w) return lang === "no" ? "dato avtales" : "date to be agreed";
  if (w[0] === w[1]) return lang === "no" ? `uke ${w[0]}` : `week ${w[0]}`;
  return lang === "no" ? `uke ${w[0]} til ${w[1]}` : `weeks ${w[0]} to ${w[1]}`;
}

/** Who may open a document. Documents that name students are behind the login (the site never shows student names). */
export type Access = "public" | "login";

/** Date (year-month, or year-month-day) and access for every document either design lists. */
export const DOCS = {
  direction: { date: "2026-09-04", access: "login" }, // the owner's preliminary energy direction; names a student
  work: { date: "2026-08", access: "login" }, // work structure for tracks 1 and 2; the .docx was created 17 August 2026
  view_photos: { date: "2026-09", access: "public", file: "/docs/utsikt_fra_knotten_byggefelt.pdf" },
  maps: { date: "2026-09", access: "public" },
  status: { date: "2026-08-31", access: "login" },
  budget: { date: "2026-09-13", access: "login" }, // the .xlsx was created 8 September and saved 13 September 2026
  measures: { date: "2026-08-28", access: "login" },
  eed: { date: "2026-09", access: "login" },
  market: { date: "2026-08-27", access: "login" },
  feedback: { date: "2026-08-28", access: "login" },
  plots_data: { date: "2026-09-30", access: "public", file: "/data/plots.json" },
  road_data: { date: "2026-09-30", access: "public", file: "/data/road.json" },
  parcel_data: { date: "2026-09-08", access: "public", file: "/data/parcels.json" },
} as const satisfies Record<string, { date: string; access: Access; file?: string }>;

const MONTHS_NO = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

/** "2026-09-04" -> "4. sep 2026"; "2026-08" -> "aug 2026" (the short Norwegian form Klassisk uses). */
export function dateNo(iso: string): string {
  const [y, m, d] = iso.split("-");
  const month = MONTHS_NO[Number(m) - 1];
  return d ? `${Number(d)}. ${month} ${y}` : `${month} ${y}`;
}

const MONTHS_LONG: Record<Lang, string[]> = {
  no: ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** "2026-09-04" -> "4. september 2026" (no) or "4 September 2026" (en), for dates in running text. */
export function dateLong(iso: string, lang: Lang = "no"): string {
  const [y, m, d] = iso.split("-");
  const month = MONTHS_LONG[lang][Number(m) - 1];
  if (!d) return `${month} ${y}`;
  return lang === "no" ? `${Number(d)}. ${month} ${y}` : `${Number(d)} ${month} ${y}`;
}
