import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Cinzel, Geist } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz", "wdth"],
  display: "swap",
});

/* the wordmark of the logo: wide, quiet capitals */
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Knotten. Sjøutsikt i Rødberg",
  description:
    "Rundt 30 energivennlige boliger på en skogkledd knaus over Snigsfjorden i Lindesnes. Terrenget er målt, solen er ekte. Stå på tomten før den finnes.",
};

export const viewport: Viewport = {
  themeColor: "#f5f8fa",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb" className={`${bricolage.variable} ${geist.variable} ${cinzel.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
