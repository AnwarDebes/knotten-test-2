"use client";
import Link from "next/link";
import Logo from "./Logo";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  useEffect(() => setOpen(false), [path]);
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
              <span>EN</span>
            </span>
            <Link className="btn ghost sm" href="/logg-inn">Logg inn</Link>
            <Link className="btn sm" href="/kontakt">Meld interesse</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
