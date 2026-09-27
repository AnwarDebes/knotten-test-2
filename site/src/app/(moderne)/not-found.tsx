import Link from "next/link";
import Nav from "@/components/ui/Nav";
import Footer from "@/components/ui/Footer";
import PageHead from "@/components/ui/PageHead";
import DesignSwitch from "@/components/DesignSwitch";

/**
 * The Moderne 404: a missing plot, or a one-word address that is not a page (it lands in the
 * [locale] segment, since the Klassisk pages sit beside /no and /en).
 */
export default function NotFound() {
  return (
    <>
      <DesignSwitch current="moderne" />
      <main className="flex-1">
        <Nav locale="no" />
        <PageHead title="Denne siden finnes ikke" lede="Kanskje du lette etter tomtene, energikonseptet eller dokumentene." />
        <section className="wrap pb-24 flex flex-wrap gap-3">
          <Link className="btn btn-amber" href="/no">Til forsiden</Link>
          <Link className="btn btn-ghost" href="/no/tomter">Tomtene</Link>
        </section>
      </main>
      <Footer locale="no" />
    </>
  );
}
