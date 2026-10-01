import { Newsreader, Figtree } from "next/font/google";

/** The Klassisk typefaces for the site-wide 404 page, loaded when that page is shown, never preloaded (see fonts.ts). */
export const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});
export const sans = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
  preload: false,
});
