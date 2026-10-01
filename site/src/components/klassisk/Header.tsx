"use client";
import Link from "next/link";
import Logo from "./Logo";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session-client";
import { toModerne } from "@/lib/design";

const NAV = [
  ["/", "Forside"],
  ["/prosjektet", "Prosjektet"],
  ["/tomtene", "Tomtene"],
  ["/energi", "Energi"],
  ["/eksisterende-bygg", "Eksisterende bygg"],
  ["/investorer", "Investorer"],
  ["/dokumentbank", "Dokumentbank"],
] as const;

export default function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const session = useSession();
  // close the menu when the page changes (adjusting state during render, not in an effect)
  const [shownFor, setShownFor] = useState(path);
  if (shownFor !== path) {
    setShownFor(path);
    setOpen(false);
  }
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" href="/" aria-label="Knotten, til forsiden">
          <Logo />
        </Link>
        <button className="burger" aria-expanded={open} aria-controls="nav" onClick={() => setOpen((o) => !o)}>
          Meny
        </button>
        <nav className={`nav${open ? " open" : ""}`} id="nav" aria-label="Hovedmeny">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
              {label}
            </Link>
          ))}
          <div className="tools">
            <span className="lang" aria-label="Språk">
              <span className="on">NO</span>
              {/* English exists in the Moderne design only; EN opens the same page there */}
              <a href={toModerne(path ?? "/").replace(/^\/no(?=\/|$)/, "/en")} hrefLang="en" lang="en" title="English (modern design)">EN</a>
            </span>
            {session ? <Link className="btn ghost sm" href="/no/portal">Portalen</Link> : <Link className="btn ghost sm" href="/logg-inn">Logg inn</Link>}
            <Link className="btn sm" href="/kontakt">Meld interesse</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
