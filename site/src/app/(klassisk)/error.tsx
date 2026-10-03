"use client";
import Link from "next/link";
import PageHead from "@/components/klassisk/PageHead";

/** When a page cannot be shown (a service that does not answer): say so, and offer a way on. */
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <PageHead title="Siden kunne ikke vises" crumb="Feil">
        <p>Noe gikk galt da siden skulle lages. Prøv igjen om et øyeblikk, eller gå videre til forsiden eller tomtene.</p>
      </PageHead>
      <section className="sec">
        <div className="wrap stack" style={{ maxWidth: "70ch" }}>
          <div className="cta-row" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={() => retry()}>Prøv igjen</button>
            <Link className="btn ghost" href="/">Til forsiden</Link>
            <Link className="btn ghost" href="/tomtene">Tomtene</Link>
          </div>
          {error.digest && <p className="small">Feilkode: {error.digest}</p>}
        </div>
      </section>
    </>
  );
}
