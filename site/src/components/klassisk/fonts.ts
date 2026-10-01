import { Newsreader, Figtree } from "next/font/google";

/**
 * Klassisk's two typefaces, preloaded on every Klassisk page (Shell.tsx). The site-wide 404 page uses
 * the same typefaces without preloading (fonts-404.ts): every route of both designs carries that page,
 * and fonts it preloads would be preloaded on the Moderne pages too.
 */
export const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
export const sans = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});
