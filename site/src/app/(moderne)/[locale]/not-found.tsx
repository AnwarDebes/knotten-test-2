"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";

/** The 404 for /no and /en, in the visitor's language: a missing page, plot or unknown address. */
export default function NotFound() {
  const locale = useParams<{ locale?: string }>()?.locale === "en" ? "en" : "no";
  const no = locale === "no";
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Denne siden finnes ikke" : "This page does not exist"}
        lede={no ? "Kanskje du lette etter tomtene, energikonseptet eller dokumentene." : "Perhaps you were looking for the plots, the energy concept or the documents."}
      />
      <section className="wrap pb-24 flex flex-wrap gap-3">
        <Link className="btn btn-amber" href={`/${locale}`}>{no ? "Til forsiden" : "To the front page"}</Link>
        <Link className="btn btn-ghost" href={`/${locale}/tomter`}>{no ? "Tomtene" : "The plots"}</Link>
      </section>
    </>
  );
}
