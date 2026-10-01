import type { Audience, DocCategory } from "@/lib/server/records";
import type { DOCS } from "@/lib/facts";

/**
 * The working documents the public document bank lists as "requires login", and how each one is
 * filed in the portal when it is uploaded: title, kind and who sees it. The public bank links to
 * the portal by these keys, and the portal's document page shows which ones are still missing.
 * Uploads for these keys are stored under the title, never under the original file name (some
 * original names contain people's names, which the site does not show).
 */
export type InternalDoc = { key: keyof typeof DOCS; title: { no: string; en: string }; category: DocCategory; audience: Audience[]; what: { no: string; en: string } };

export const INTERNAL_DOCS: InternalDoc[] = [
  { key: "direction", title: { no: "Foreløpig retning for energikonseptet", en: "Preliminary direction for the energy concept" }, category: "energy", audience: ["all"], what: { no: "Prosjekteiers svar på energisporets spørsmål, 4. september 2026. Norsk og engelsk.", en: "The project owner's answers to the energy track's questions, 4 September 2026. Norwegian and English." } },
  { key: "work", title: { no: "Arbeidsopplegg for spor 1 og 2", en: "Work structure, tracks 1 and 2" }, category: "other", audience: ["project"], what: { no: "Roller, arbeidspakker, faser og sluttleveranser.", en: "Roles, work packages, phases and final deliverables." } },
  { key: "status", title: { no: "Statusoppsummering, elektro og teknikk", en: "Status summary, electrical and technical" }, category: "reports", audience: ["all"], what: { no: "Metode, foreløpige tall og hva som mangler, fra energisporet.", en: "Method, provisional figures and what is missing, from the energy track." } },
  { key: "budget", title: { no: "Energiregnskap, arbeidsversjon", en: "Energy budget, working version" }, category: "energy", audience: ["all"], what: { no: "Regnearket med forutsetninger, produksjon, lagring og nøkkeltall for året.", en: "The spreadsheet with assumptions, production, storage and key figures for the year." } },
  { key: "measures", title: { no: "Sammenligning av tiltak", en: "Comparison of measures" }, category: "energy", audience: ["all"], what: { no: "Kostnad, robusthet, energi og anbefaling per tiltak, fra energisporet.", en: "Cost, robustness, energy and recommendation per measure, from the energy track." } },
  { key: "eed", title: { no: "Grunnvarmeanalyse i Earth Energy Designer", en: "Ground heat analysis in Earth Energy Designer" }, category: "energy", audience: ["all"], what: { no: "Grunnlast, brønnkonfigurasjon og væsketemperaturer over 35 år.", en: "Base load, borehole configuration and fluid temperatures over 35 years." } },
  { key: "market", title: { no: "Marked, merkevare og kommersialisering", en: "Market, brand and commercialisation" }, category: "reports", audience: ["investor", "project"], what: { no: "Målgrupper, posisjonering, støtteordninger og plan, fra markedssporet.", en: "Target groups, positioning, support schemes and plan, from the market track." } },
  { key: "feedback", title: { no: "Tilbakemelding på leveranseplanen", en: "Feedback on the delivery plan" }, category: "other", audience: ["project"], what: { no: "Prosjekteiers vurdering av planen for den digitale plattformen, 28. august 2026.", en: "The project owner's assessment of the plan for the digital platform, 28 August 2026." } },
];

export const internalDoc = (key: string) => INTERNAL_DOCS.find((d) => d.key === key);

/** Where the public document bank sends someone who wants an internal document: the portal, through the login. */
export const portalDocPath = (key: string, locale: "no" | "en" = "no") => `/${locale}/portal/dokumenter?dok=${key}`;
