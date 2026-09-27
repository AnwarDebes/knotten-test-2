import type { Metadata } from "next";
import Link from "next/link";
import "./(klassisk)/globals.css";
import Shell from "@/components/klassisk/Shell";

export const metadata: Metadata = { title: "Denne siden finnes ikke | Knotten" };

/**
 * The 404 for addresses no page answers. The site has two root layouts (one per design), so
 * this page brings its own: the default design, Klassisk.
 */
export default function GlobalNotFound() {
  return (
    <Shell>
      <section className="sec">
        <div className="wrap stack" style={{ maxWidth: "60ch" }}>
          <div className="eyebrow">Ikke funnet</div>
          <h1 style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>Denne siden finnes ikke</h1>
          <p className="lede">Kanskje du lette etter tomtene, energikonseptet eller dokumentbanken.</p>
          <div className="cta-row"><Link className="btn" href="/">Til forsiden</Link><Link className="btn ghost" href="/tomtene">Tomtene</Link></div>
        </div>
      </section>
    </Shell>
  );
}
