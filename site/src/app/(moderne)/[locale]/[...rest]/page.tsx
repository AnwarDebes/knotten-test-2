import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: (await params).locale === "en" ? "Page not found" : "Fant ikke siden" };
}

/** Any address under /no or /en that no page answers gets the 404 in the visitor's language and design. */
export default function Missing() {
  notFound();
}
