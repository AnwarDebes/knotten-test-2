"use client";

/*
 * Klassisk's colours, written out for this page alone (like the 404), with the system's own fonts: when this page
 * shows, the site's layout and its stylesheets are what failed.
 */
const CSS = `
:root { --paper: #f6f8fa; --ink: #14263d; --ink-2: #4a5a6e; --ink-3: #5c6979; --fjord-deep: #2f5f85; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; background: var(--paper); color: var(--ink); font-family: "Segoe UI", Helvetica, Arial, sans-serif; font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
.ge { margin: auto; width: min(60ch, 100% - 32px); padding-block: 48px; display: flex; flex-direction: column; gap: 18px; }
.ge-eyebrow { margin: 0; font-family: Georgia, serif; font-size: 1.35rem; letter-spacing: .16em; text-transform: uppercase; }
.ge h1 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.08; }
.ge-lede { margin: 0; font-size: 1.2rem; color: var(--ink-2); }
.ge-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
.ge-cta button, .ge-cta a { display: inline-flex; align-items: center; padding: 12px 20px; border-radius: 999px; border: 1px solid var(--ink); font: inherit; font-weight: 500; text-decoration: none; cursor: pointer; }
.ge-cta button { background: var(--ink); color: #fff; }
.ge-cta a { background: transparent; color: var(--ink); }
.ge-cta :focus-visible, .ge-en a:focus-visible { outline: 2px solid var(--fjord-deep); outline-offset: 2px; }
.ge-en { margin: 14px 0 0; font-size: .92rem; color: var(--ink-3); }
.ge-en a { color: var(--fjord-deep); }
.ge-code { margin: 0; font-size: .8rem; color: var(--ink-3); }
`;

/**
 * The last safety net: shown only when a design's root layout itself fails (each design's error page catches
 * everything below its layout). It brings its own document, in Norwegian with a way into the English pages.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="nb">
      <body>
        <style>{CSS}</style>
        <main className="ge">
          <p className="ge-eyebrow">Knotten</p>
          <h1>Siden kunne ikke vises</h1>
          <p className="ge-lede">Noe gikk galt da siden skulle lages. Prøv igjen om et øyeblikk.</p>
          {/* plain links: a full page load, since the site's own navigation is what failed */}
          <div className="ge-cta">
            <button type="button" onClick={() => retry()}>Prøv igjen</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point here */}
            <a href="/">Til forsiden</a>
          </div>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point here */}
          <p className="ge-en" lang="en">The page could not be shown. Try again in a moment, or go to <a href="/en" hrefLang="en">Knotten in English</a>.</p>
          {error.digest && <p className="ge-code">Feilkode: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
