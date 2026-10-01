import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/klassisk/Shell";
import { FACT } from "@/lib/facts";

export const metadata: Metadata = {
  title: { default: "Knotten", template: "%s | Knotten" },
  description:
    `Knotten: rundt ${FACT.plots} tomter på Rødberg i Lindesnes, planlagt som Norges mest energivennlige boligfelt.`,
  metadataBase: new URL("https://knotten.no"),
  openGraph: { title: "Knotten", description: "Sjøutsikt i Rødberg. Norges mest energivennlige boligfelt.", images: ["/img/view.jpg"] },
};

/** Klassisk, the default design: the front door (/) and the Norwegian pages beside it. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
