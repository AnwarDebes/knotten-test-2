import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Cinzel, Geist } from "next/font/google";
import "../globals.css";
import { isLocale } from "@/lib/i18n";
import { FACT } from "@/lib/facts";
import { SITE } from "@/lib/meta";
import Track from "@/components/Track";
import Footer from "@/components/ui/Footer";
import Chat from "@/components/ui/Chat";
import Motion from "@/components/ui/Motion";
import DesignSwitch from "@/components/DesignSwitch";
import SiteOnly from "@/components/ui/SiteOnly";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz", "wdth"],
  display: "swap",
});

/* the wordmark of the logo: wide, quiet capitals. Only the logo's fallback uses it (when logo.png is
   missing), so it is fetched when needed instead of preloaded on every page */
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
  preload: false,
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export function generateStaticParams() {
  return [{ locale: "no" }, { locale: "en" }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const en = (await params).locale === "en";
  return {
    metadataBase: new URL(SITE),
    title: { default: en ? "Knotten. Sea view at Rødberg" : "Knotten. Sjøutsikt i Rødberg", template: "%s. Knotten" },
    description: en
      ? `About ${FACT.plots} energy-friendly homes on a wooded knoll above the Audna, near Sniksfjorden in Lindesnes. The terrain is measured, the sun is real. Stand on the plot before it exists.`
      : `Rundt ${FACT.plots} energivennlige boliger på en skogkledd knaus over Audna, nær Sniksfjorden i Lindesnes. Terrenget er målt, solen er ekte. Stå på tomten før den finnes.`,
  };
}

export const viewport: Viewport = {
  themeColor: "#f5f8fa",
  width: "device-width",
  initialScale: 1,
};

/**
 * Moderne's root layout, once per language (/no and /en). The language sits on <html>, so screen
 * readers, translation tools and search engines read each page in the right language.
 */
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  // an unknown first segment (/finnes-ikke) still arrives here; its page answers with the 404 in not-found.tsx
  const locale = isLocale(l) ? l : "no";
  return (
    <html lang={locale === "no" ? "nb" : "en"} data-scroll-behavior="smooth" className={`${bricolage.variable} ${geist.variable} ${cinzel.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <SiteOnly hideOn="portal"><DesignSwitch current="moderne" locale={locale} /></SiteOnly>
        <main className="flex-1">{children}</main>
        <SiteOnly>
          <Footer locale={locale} />
          <Chat locale={locale} />
          <Motion />
        </SiteOnly>
        <Track design="moderne" />
      </body>
    </html>
  );
}
