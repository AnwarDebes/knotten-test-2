"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { SOURCES, type SourceId } from "@/lib/sources";

/**
 * The small "Kilde" chip after a figure. Opens a card with the source's own words and the document
 * it comes from, so every number on the page can be checked where it stands. Closes on Escape, on a
 * click elsewhere, and when the chip is pressed again.
 */
export default function Src({ id, locale }: { id: SourceId; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("left");
  const root = useRef<HTMLSpanElement>(null);
  const s = SOURCES[id];
  const no = locale === "no";
  useEffect(() => {
    if (!open) return;
    const el = root.current;
    if (el) setSide(el.getBoundingClientRect().left > window.innerWidth - 380 ? "right" : "left");
    const down = (e: PointerEvent) => { if (el && !el.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <span ref={root} className="relative inline-block align-middle">
      <button type="button" className={`src ${open ? "on" : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {no ? "Kilde" : "Source"}
      </button>
      {open && (
        <span role="dialog" className={`src-pop ${side === "right" ? "right-0" : "left-0"}`}>
          <span className="block">{s.quote}</span>
          <span className="block mt-2 text-[12px] opacity-70">{s.doc[locale]}</span>
        </span>
      )}
    </span>
  );
}
