/**
 * The site has two designs of the same project, as Sigve asked for: Klassisk (the default, at /)
 * and Moderne (at /no and /en). Each keeps its own addresses and pages. The switch at the top of
 * every page opens the matching page in the other design and remembers the choice in a cookie,
 * so the front door (/) opens the design the visitor picked last (see src/proxy.ts).
 * No Node or browser imports here: the proxy, the server and the client all read this file.
 */
export type Design = "klassisk" | "moderne";
export const DEFAULT_DESIGN: Design = "klassisk";
export const DESIGN_COOKIE = "knotten_design";

/** Klassisk page to the Moderne page that says the same thing (path after /no). */
const KLASSISK_TO_MODERNE: Record<string, string> = {
  "/": "",
  "/prosjektet": "/prosjektet",
  "/tomtene": "/tomter",
  "/energi": "/energi",
  "/eksisterende-bygg": "/energi/eksisterende",
  "/investorer": "/investor",
  "/dokumentbank": "/dokumenter",
  "/kontakt": "/interesse",
  "/logg-inn": "/login",
  "/logg-inn/passord": "/login",
  "/personvern": "/personvern",
  // only in Klassisk: the closest Moderne page
  "/kart": "/omradet",
  "/galleri": "/utsikt",
  "/kilder": "/dokumenter",
};

/** Moderne page (path after the locale) to Klassisk. Checked in order, so sub-pages come first. */
const MODERNE_TO_KLASSISK: [string, string][] = [
  ["/energi/eksisterende", "/eksisterende-bygg"],
  ["/energi", "/energi"],
  ["/tomter", "/tomtene"],
  ["/prosjektet", "/prosjektet"],
  ["/investor", "/investorer"],
  ["/dokumenter", "/dokumentbank"],
  ["/kontakt", "/kontakt"],
  ["/interesse", "/kontakt"],
  ["/login", "/logg-inn"],
  ["/personvern", "/personvern"],
  // only in Moderne: the closest Klassisk page
  ["/utsikt", "/galleri"],
  ["/omradet", "/kart"],
];

/** Klassisk is Norwegian only, so it always opens the Norwegian Moderne pages. */
export function toModerne(klassiskPath: string): string {
  return `/no${KLASSISK_TO_MODERNE[klassiskPath] ?? ""}`;
}

/** Plot pages, news and anything unknown open the Klassisk front page or the nearest section. */
export function toKlassisk(modernePath: string): string {
  const rest = modernePath.replace(/^\/(no|en)(?=\/|$)/, "");
  for (const [from, to] of MODERNE_TO_KLASSISK) if (rest === from || rest.startsWith(`${from}/`)) return to;
  return "/";
}

/** Remembered for a year; read by the proxy on the next visit to /. */
export function rememberDesign(design: Design) {
  document.cookie = `${DESIGN_COOKIE}=${design}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
