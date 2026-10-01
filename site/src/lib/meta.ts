import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";

/** The public address used in link previews and language alternates (the same as sitemap.ts). */
export const SITE = (process.env.SITE_URL || "https://knotten.no").replace(/\/$/, "");

type Text = { title?: string; description: string };

/**
 * Title, description and language alternates for a public Moderne page, in the page's own language:
 * `export const generateMetadata = pageMeta("/utsikt", { no: {...}, en: {...} })`. The layout adds
 * ". Knotten" to the title; leave the title out on the front page to get the layout's own.
 */
export function pageMeta(path: string, text: { no: Text; en: Text }) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return withAlternates(path, locale, text[locale]);
  };
}

/** The same for a page that builds its own text (a plot page): canonical address, both languages, preview. */
export function withAlternates(path: string, locale: "no" | "en", { title, description }: Text): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: `/${locale}${path}`, languages: { nb: `/no${path}`, en: `/en${path}`, "x-default": `/no${path}` } },
    openGraph: {
      ...(title ? { title: `${title}. Knotten` } : {}),
      description,
      url: `/${locale}${path}`,
      siteName: "Knotten",
      locale: locale === "no" ? "nb_NO" : "en_GB",
      type: "website",
      // a page with its own opengraph-image file (the plot pages) shows that instead
      images: [{ url: "/img/view.jpg", width: 1440, height: 1440, alt: locale === "no" ? "Utsikten sørover mot Sniksfjorden" : "The view south towards Sniksfjorden" }],
    },
  };
}
