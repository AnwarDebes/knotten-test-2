"use client";
import { usePathname } from "next/navigation";
import { rememberDesign, toKlassisk, toModerne, type Design } from "@/lib/design";

const LABELS = {
  no: { title: "Utseende", klassisk: "Klassisk", moderne: "Moderne" },
  en: { title: "Appearance", klassisk: "Classic", moderne: "Modern" },
};

/**
 * The slim strip above the header in both designs: "Utseende: Klassisk | Moderne". It sits in
 * the same corner in both, so a visitor can flip back and forth without hunting for it. The
 * markup is shared; each design dresses it in its own look (.dbar in the two globals.css).
 * The other design is a plain link, so it works before the page is interactive.
 */
export default function DesignSwitch({ current, locale = "no" }: { current: Design; locale?: "no" | "en" }) {
  const path = usePathname() ?? "/";
  // the portal is one back office behind the login, not part of the choice
  if (current === "moderne" && /^\/(no|en)\/portal(\/|$)/.test(path)) return null;
  const t = LABELS[locale];
  const href = current === "klassisk" ? toModerne(path) : toKlassisk(path);
  const item = (d: Design) =>
    d === current ? (
      <span key={d} aria-current="true">{t[d]}</span>
    ) : (
      <a key={d} href={href} onClick={() => rememberDesign(d)}>{t[d]}</a>
    );
  return (
    <div className="dbar">
      <div className="wrap dbar-in">
        <span className="dbar-label" id="dbar-label">{t.title}</span>
        <div className="dbar-seg" role="group" aria-labelledby="dbar-label">
          {item("klassisk")}
          {item("moderne")}
        </div>
      </div>
    </div>
  );
}
