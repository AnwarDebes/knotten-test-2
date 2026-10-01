/**
 * Shared building blocks for the facts module. Both designs (Klassisk and Moderne) and the portal read
 * every project fact from src/lib/facts; this file only holds the types and the number formatting, so a
 * figure is printed the same way everywhere. No Node or browser imports: server and client both use it.
 */
export type Lang = "no" | "en";

/** A text in both languages. Klassisk is Norwegian only and reads `.no`. */
export type T = { no: string; en: string };

/** How sure a figure is, in the words the "Kilder og forutsetninger" page uses. */
export type Status = "fastsatt" | "foreløpig" | "beregnet" | "verifisert";

export const STATUS_LABEL: Record<Status, T> = {
  fastsatt: { no: "Fastsatt", en: "Fixed" },
  foreløpig: { no: "Foreløpig", en: "Provisional" },
  beregnet: { no: "Beregnet", en: "Computed" },
  verifisert: { no: "Verifisert", en: "Verified" },
};

/**
 * 719500 -> "719 500" (no) or "719,500" (en); 105.83 -> "105,83" or "105.83". Negative numbers get a plain
 * hyphen: the Norwegian locale would print a long minus sign, which reads as a dash on the site.
 */
export function fmt(n: number, lang: Lang = "no", digits?: number): string {
  return n.toLocaleString(lang === "no" ? "nb-NO" : "en-GB", digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace("−", "-");
}

/** Rounds to a step first: fmtRound(719500, 1000) -> "720 000". */
export function fmtRound(n: number, step: number, lang: Lang = "no"): string {
  return fmt(Math.round(n / step) * step, lang);
}

const WORDS: Record<Lang, string[]> = {
  no: ["null", "én", "to", "tre", "fire", "fem", "seks", "sju", "åtte", "ni", "ti", "elleve", "tolv"],
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"],
};

/** A count written as a word in running text: 4 -> "fire" (no) or "four" (en); above twelve, digits. */
export function word(n: number, lang: Lang = "no"): string {
  return WORDS[lang][n] ?? fmt(n, lang);
}

/** "fire rekker" -> "Fire rekker", for a count that starts a sentence. */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
