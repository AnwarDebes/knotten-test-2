import { serif, sans } from "./fonts";
import Header from "./Header";
import Footer from "./Footer";
import Contours from "./Contours";
import TerrainProgress from "./TerrainProgress";
import SourceProvider from "./Source";
import DesignSwitch from "@/components/DesignSwitch";
import Track from "@/components/Track";

/** The whole Klassisk page around the content, used by the Klassisk layout. */
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no" data-scroll-behavior="smooth" className={`${serif.variable} ${sans.variable}`}>
      <body suppressHydrationWarning>
        <Contours />
        <SourceProvider>
          <DesignSwitch current="klassisk" />
          <Header />
          <main>{children}</main>
          <Footer />
          <TerrainProgress />
          <Track design="klassisk" />
        </SourceProvider>
      </body>
    </html>
  );
}
