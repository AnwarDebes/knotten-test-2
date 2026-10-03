"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";

/** When a page cannot be shown (a service that does not answer): say so in the visitor's language, and offer a way on. */
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useParams<{ locale?: string }>()?.locale === "en" ? "en" : "no";
  const no = locale === "no";
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Siden kunne ikke vises" : "The page could not be shown"}
        lede={no ? "Noe gikk galt da siden skulle lages. Prøv igjen om et øyeblikk, eller gå videre til forsiden eller tomtene." : "Something went wrong while the page was being made. Try again in a moment, or go on to the front page or the plots."}
      />
      <section className="wrap pb-24 grid gap-4">
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-amber" onClick={() => retry()}>{no ? "Prøv igjen" : "Try again"}</button>
          <Link className="btn btn-ghost" href={`/${locale}`}>{no ? "Til forsiden" : "To the front page"}</Link>
          <Link className="btn btn-ghost" href={`/${locale}/tomter`}>{no ? "Tomtene" : "The plots"}</Link>
        </div>
        {error.digest && <p className="text-[12.5px] text-muted">{no ? "Feilkode" : "Error code"}: {error.digest}</p>}
      </section>
    </>
  );
}
