"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const PATH = "M3 40H78C90 40 96 36 102 28C110 18 118 8 147 5";
const SECTION_LABELS: Record<string, string> = {
  hero: "Utsikten",
  stedet: "Stedet",
  kart: "Kartene",
  tomter: "Tomtene",
  energi: "Energi",
  bygg: "Eksisterende bygg",
  investor: "Investorer",
  kontakt: "Kontakt",
};

/**
 * Scroll progress as a small terrain profile, bottom left: flat river plain, then the knoll.
 * The dot climbs as the visitor scrolls. Kept faint and click-through so it never gets in the way.
 */
export default function TerrainProgress() {
  const fill = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const [label, setLabel] = useState("");
  const path = usePathname();
  const hidden = path.startsWith("/tomtene") || path.startsWith("/logg-inn");

  useEffect(() => {
    const p = fill.current;
    const d = dot.current;
    if (!p || !d) return;
    const L = p.getTotalLength();
    p.style.strokeDasharray = `${L}`;
    let ticking = false;
    const upd = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const k = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      const pt = p.getPointAtLength(L * k);
      p.style.strokeDashoffset = `${L * (1 - k)}`;
      d.setAttribute("cx", `${pt.x}`);
      d.setAttribute("cy", `${pt.y}`);
      const mid = window.scrollY + window.innerHeight * 0.45;
      let cur = "";
      document.querySelectorAll<HTMLElement>("[data-journey]").forEach((el) => {
        if (el.offsetTop <= mid) cur = SECTION_LABELS[el.dataset.journey || ""] || cur;
      });
      setLabel(cur);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(upd);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", upd);
    upd();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", upd);
    };
  }, [path]);

  return (
    <div className={`prof${hidden ? " hidden" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 150 46">
        <path d={PATH} fill="none" stroke="#D4DCE4" strokeWidth="1.5" strokeLinecap="round" />
        <path ref={fill} d={PATH} fill="none" stroke="#2F5F85" strokeWidth="1.5" strokeLinecap="round" />
        <circle ref={dot} cx="3" cy="40" r="3" fill="#14263D" stroke="#fff" strokeWidth="1.2" />
        <g fontSize="6" fill="#7C8A9B"><text x="3" y="33">0 moh</text><text x="123" y="15">60 moh</text></g>
      </svg>
      <span className="proflbl"><span>Elva</span><b>{label || "Knotten"}</b><span>Knotten</span></span>
    </div>
  );
}
