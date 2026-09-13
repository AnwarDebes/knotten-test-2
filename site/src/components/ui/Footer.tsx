import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { ASSUMPTIONS_VERSION } from "@/lib/assumptions";
import Logo from "./Logo";

/** The close of every page: one dark panel, the name large, the way to get in touch, the map of the site. */
export default function Footer({ locale }: { locale: Locale }) {
  const d = t(locale);
  const no = locale === "no";
  const p = (path: string) => `/${locale}${path}`;
  const cols: [string, [string, string][]][] = [
    [no ? "Stedet" : "The place", [[p("/tomter"), d.nav.plots], [p("/utsikt"), d.nav.view], [p("/omradet"), d.nav.area], [p("/energi"), d.nav.energy], [p("/energi/eksisterende"), no ? "Eksisterende bygg" : "Existing buildings"]]],
    [no ? "Prosjektet" : "The project", [[p("/prosjektet"), d.nav.project], [p("/investor"), d.nav.investor], [p("/dokumenter"), no ? "Dokumenter" : "Documents"], [p("/nyheter"), no ? "Nyheter" : "News"], [p("/kontakt"), d.nav.contact]]],
    [no ? "Portal" : "Portal", [[p("/login"), d.nav.login], [p("/portal"), no ? "Portalen" : "The portal"], [p("/portal/energy"), no ? "Energidashbord" : "Energy dashboard"], [p("/personvern"), d.footer.privacy]]],
  ];
  return (
    <footer className="mt-auto">
      <div className="wrap pb-6 pt-10">
        <div className="panel-2 overflow-hidden">
          <div className="p-8 md:p-14 grid gap-12 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="display text-[clamp(52px,9vw,140px)] leading-[.9] tracking-tight">Knotten</div>
              <p className="lede mt-5 max-w-[40ch]">{no ? "Sjøutsikt i Rødberg. Rundt 30 energivennlige boliger på knausen over Snigsfjorden, der Audna møter fjorden." : "Sea view at Rødberg. About 30 energy-friendly homes on the knoll above Snigsfjorden, where the Audna meets the fjord."}</p>
              <div className="mt-8 flex flex-wrap gap-2">
                <Link className="btn btn-amber no-underline" href={p("/interesse")}>{d.nav.interest}</Link>
                <a className="btn btn-ghost no-underline" href="mailto:sigve.simonsen@hotmail.com">{no ? "Skriv til oss" : "Write to us"}</a>
              </div>
            </div>
            <div className="grid gap-8 sm:grid-cols-3 content-start">
              {cols.map(([h, items]) => (
                <div key={h} className="grid content-start gap-2.5 text-[15px]">
                  <div className="text-muted mb-1">{h}</div>
                  {items.map(([href, label]) => <Link key={href} href={href} className="no-underline text-ink-2 hover:text-ink">{label}</Link>)}
                </div>
              ))}
            </div>
          </div>
          <div className="px-8 md:px-14 py-6 border-t line flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-muted">
            <span className="inline-flex items-center gap-3 text-ink"><Logo height={40} wordmark={false} /><span>Sigve Simonsen AS</span></span>
            <span>Knotten, Rødberg, 4520 Lindesnes</span>
            <span>+47 954 95 152</span>
            <span className="lg:ml-auto max-w-[60ch]">{d.footer.data} {no ? "Forutsetninger" : "Assumptions"} {ASSUMPTIONS_VERSION}.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
