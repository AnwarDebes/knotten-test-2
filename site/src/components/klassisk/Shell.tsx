import { Newsreader, Figtree } from "next/font/google";
import Header from "./Header";
import Footer from "./Footer";
import Contours from "./Contours";
import TerrainProgress from "./TerrainProgress";
import SourceProvider from "./Source";
import DesignSwitch from "@/components/DesignSwitch";

const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const sans = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

/** The whole Klassisk page around the content. Used by the Klassisk layout and by the site's 404 page. */
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" className={`${serif.variable} ${sans.variable}`}>
      <body suppressHydrationWarning>
        <Contours />
        <SourceProvider>
          <DesignSwitch current="klassisk" />
          <Header />
          <main>{children}</main>
          <Footer />
          <TerrainProgress />
        </SourceProvider>
      </body>
    </html>
  );
}
