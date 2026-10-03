"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session-client";
import { ROLE_LABEL } from "@/lib/auth-shared";
import Logo from "./Logo";
import { CONTACT, FACT } from "@/lib/facts";

/**
 * The header: the logo, one sentence about the place, and two pills. It floats over the page and
 * turns to glass once you scroll. The menu opens as a sheet with the sections in large type.
 */
export default function Nav({ locale }: { locale: Locale; dark?: boolean }) {
  const d = t(locale);
  const no = locale === "no";
  const p = (path: string) => `/${locale}${path}`;
  const other = locale === "no" ? "en" : "no";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // the menu sheet starts where the header ends, which is lower while the design strip above is in view
  const header = useRef<HTMLElement>(null);
  const [sheetTop, setSheetTop] = useState<number>();
  const session = useSession();
  const router = useRouter();
  // the same page in the other language; the query and the anchor come along when clicked
  const otherHref = (usePathname() ?? `/${locale}`).replace(/^\/(no|en)(?=\/|$)/, `/${other}`);
  const switchLang = (e: React.MouseEvent<HTMLAnchorElement>) => {
    setOpen(false);
    const rest = window.location.search + window.location.hash;
    if (!rest || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    router.push(otherHref + rest);
  };

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);
  // the sheet covers the page: Escape closes it and the focus goes back to the button that opened it
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  const here = usePathname() ?? "";

  const links: [string, string, string][] = [
    [p("/tomter"), d.nav.plots, no ? `Rundt ${FACT.plots} tomter, solpass for hver` : `About ${FACT.plots} plots, a sun passport for each`],
    [p("/utsikt"), d.nav.view, no ? "Fjorden og åpent hav" : "The fjord and open sea"],
    [p("/energi"), d.nav.energy, no ? "Konseptet og tallene" : "The concept and the numbers"],
    [p("/energi/eksisterende"), no ? "Eksisterende bygg" : "Existing buildings", no ? "Kontoret, boligen og det som planlegges" : "The office, the house and what is planned"],
    [p("/omradet"), d.nav.area, no ? "Rødberg i Lindesnes" : "Rødberg in Lindesnes"],
    [p("/prosjektet"), d.nav.project, no ? "Fra målt grunnlag til salg" : "From measured basis to sale"],
    [p("/investor"), d.nav.investor, no ? "Det investorer spør om" : "What investors ask"],
    [p("/dokumenter"), no ? "Dokumenter" : "Documents", no ? "Rapporter, kart og notater" : "Reports, maps and notes"],
    [p("/kontakt"), d.nav.contact, CONTACT.company],
  ];

  return (
    <>
    <a className="skip" href="#innhold">{no ? "Hopp til innholdet" : "Skip to content"}</a>
    <header ref={header} className="sticky top-0 z-50 text-bone" style={{ height: "var(--nav-h)" }}>
      <div className={`absolute inset-0 transition-opacity duration-300 ${scrolled && !open ? "opacity-100" : "opacity-0"} bg-bg/85`} style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }} />
      <div className="wrap relative h-full grid grid-cols-[auto_1fr_auto] items-center gap-6">
        <Link href={p("")} className="no-underline flex items-center" aria-label="Knotten" onClick={() => setOpen(false)}>
          <Logo height={52} />
        </Link>

        <p className={`hidden lg:block justify-self-center max-w-[44ch] text-[15px] leading-snug text-center transition-opacity ${scrolled ? "opacity-0" : "opacity-80"}`}>
          {no ? `Norges mest energivennlige boligfelt. Rundt ${FACT.plots} boliger på Knotten i Lindesnes, over Sniksfjorden.` : `Norway's most energy-friendly housing field. About ${FACT.plots} homes on Knotten in Lindesnes, above Sniksfjorden.`}
        </p>

        <div className="justify-self-end flex items-center gap-2">
          <span className="lang-seg" role="group" aria-label={no ? "Språk" : "Language"}>
            {(["no", "en"] as const).map((l) =>
              l === locale ? (
                <span key={l} className="on" aria-current="true" lang={l}>{l.toUpperCase()}</span>
              ) : (
                <Link key={l} href={otherHref} onClick={switchLang} hrefLang={l} lang={l} aria-label={l === "en" ? "EN, read this page in English" : "NO, les denne siden på norsk"}>{l.toUpperCase()}</Link>
              ),
            )}
          </span>
          {session ? (
            <Link href={p("/portal")} className="btn btn-ghost btn-sm no-underline hidden sm:inline-flex">{session.name || ROLE_LABEL[session.role][locale]}</Link>
          ) : (
            <Link href={p("/login")} className="btn btn-ghost btn-sm no-underline hidden sm:inline-flex">{d.nav.login}</Link>
          )}
          <Link className="btn btn-sm no-underline hidden sm:inline-flex" href={p("/interesse")}>{d.nav.interest}</Link>
          <button ref={toggle} className={`btn btn-sm btn-plain ${open ? "" : "btn-ghost"}`} onClick={() => { setSheetTop(header.current?.getBoundingClientRect().bottom); setOpen((o) => !o); }} aria-expanded={open} aria-controls={open ? "menu" : undefined}>
            {open ? d.nav.close : d.nav.menu}
            <span className="inline-flex gap-[3px] ml-1" aria-hidden>
              <span className="w-[5px] h-[5px] rounded-full bg-current" /><span className="w-[5px] h-[5px] rounded-full bg-current" />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div id="menu" className="fixed inset-0 z-40 bg-bg text-bone overflow-auto" style={{ top: sheetTop ?? "var(--nav-h)" }}>
          <nav className="wrap py-8 md:py-12 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
            <div className="grid">
              {links.map(([href, label, hint], i) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={here === href ? "page" : undefined} className="no-underline group grid sm:grid-cols-[1fr_auto] items-baseline gap-x-6 py-2 border-b line rise-in" style={{ animationDelay: `${i * 35}ms` }}>
                  <span className="display text-[clamp(30px,4.6vw,60px)] group-hover:text-fjord transition-colors">{label}</span>
                  <span className="text-[14px] text-granite">{hint}</span>
                </Link>
              ))}
            </div>
            <div className="grid content-start gap-4 text-[15px]">
              <div className="flex flex-wrap gap-2">
                {session ? (
                  <Link href={p("/portal")} onClick={() => setOpen(false)} className="btn btn-ghost no-underline">{session.name || ROLE_LABEL[session.role][locale]}</Link>
                ) : (
                  <Link href={p("/login")} onClick={() => setOpen(false)} className="btn btn-ghost no-underline">{d.nav.login}</Link>
                )}
                <Link className="btn no-underline" href={p("/interesse")} onClick={() => setOpen(false)}>{d.nav.interest}</Link>
              </div>
              <Link href={otherHref} onClick={switchLang} hrefLang={other} lang={other} className="no-underline text-granite hover:text-bone">{other === "en" ? "Read this in English" : "Les dette på norsk"}</Link>
              <p className="text-granite max-w-[36ch] mt-6">{`${CONTACT.place}. ${CONTACT.company}.`}</p>
            </div>
          </nav>
        </div>
      )}
    </header>
    <div id="innhold" tabIndex={-1} className="outline-none" />
    </>
  );
}
