import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { serif, sans } from "@/components/klassisk/fonts-404";

export const metadata: Metadata = { title: "Denne siden finnes ikke | Knotten" };

/*
 * Klassisk's look, written out for this page alone. The page used to import Klassisk's stylesheet, and
 * because every route carries this page, the Klassisk fonts were then preloaded on every Moderne page
 * too (about 230 kB never used). Its own small stylesheet keeps the two designs apart.
 */
const CSS = `
:root { --paper: #f6f8fa; --paper-2: #edf1f5; --ink: #14263d; --ink-2: #4a5a6e; --ink-3: #5c6979; --fjord-deep: #2f5f85; --line: #d4dce4; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; background: var(--paper); color: var(--ink); font-family: var(--font-sans), "Segoe UI", Helvetica, Arial, sans-serif; font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
.nf { margin: auto; width: min(60ch, 100% - 32px); padding-block: 48px; display: flex; flex-direction: column; gap: 18px; }
.nf-logo { display: inline-flex; align-items: center; gap: 12px; align-self: flex-start; margin-bottom: 20px; color: var(--ink); text-decoration: none; }
.nf-logo img { border-radius: 50%; box-shadow: 0 0 0 2px #fff, 0 0 0 3px var(--line), 0 4px 12px rgba(20, 38, 61, .18); }
.nf-name { display: block; font-family: var(--font-serif), Georgia, serif; font-size: 1.35rem; letter-spacing: .16em; text-transform: uppercase; line-height: 1; }
.nf-sub { display: block; margin-top: 5px; font-size: .62rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); line-height: 1; }
.nf-eyebrow { margin: 0; font-family: var(--font-serif), Georgia, serif; font-style: italic; font-size: 1.1rem; color: var(--fjord-deep); }
.nf h1 { margin: 0; font-family: var(--font-serif), Georgia, "Times New Roman", serif; font-weight: 300; letter-spacing: -.012em; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.08; text-wrap: balance; }
.nf-lede { margin: 0; font-size: 1.2rem; line-height: 1.5; color: var(--ink-2); }
.nf-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
.nf-btn { display: inline-flex; align-items: center; padding: 12px 20px; border-radius: 999px; border: 1px solid var(--ink); background: var(--ink); color: #fff; font-weight: 500; text-decoration: none; transition: background .25s; }
.nf-btn:hover { background: var(--fjord-deep); border-color: var(--fjord-deep); }
.nf-btn.ghost { background: transparent; color: var(--ink); }
.nf-btn.ghost:hover { background: var(--paper-2); border-color: var(--ink); }
.nf-en { margin: 14px 0 0; font-size: .92rem; color: var(--ink-3); }
.nf-en a { color: var(--fjord-deep); }
`;

/**
 * The 404 for addresses no page answers. The site has two root layouts (one per design), so this
 * page brings its own: the default design, Klassisk, with a way into the English pages.
 */
export default function GlobalNotFound() {
  return (
    <html lang="no" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <style href="knotten-404" precedence="default">{CSS}</style>
        <main className="nf">
          <Link className="nf-logo" href="/" aria-label="Knotten, til forsiden">
            <Image src="/img/logo-mark.png" alt="" width={56} height={56} priority />
            <span><span className="nf-name">Knotten</span><span className="nf-sub">Sjøutsikt i Rødberg</span></span>
          </Link>
          <p className="nf-eyebrow">Ikke funnet</p>
          <h1>Denne siden finnes ikke</h1>
          <p className="nf-lede">Kanskje du lette etter tomtene, energikonseptet eller dokumentbanken.</p>
          <div className="nf-cta"><Link className="nf-btn" href="/">Til forsiden</Link><Link className="nf-btn ghost" href="/tomtene">Tomtene</Link></div>
          <p className="nf-en" lang="en">This page does not exist. <Link href="/en" hrefLang="en">Knotten in English</Link></p>
        </main>
      </body>
    </html>
  );
}
