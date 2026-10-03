"use client";
import { useEffect } from "react";

/**
 * The page's motion, all of it cheap:
 * - a thin progress bar along the top that follows the scroll,
 * - a ring that follows the pointer on desktops and opens over links and buttons,
 * - sections that come in as they scroll into view (.rise, [data-reveal]) and headlines
 *   whose words arrive one after the other (.words).
 * One IntersectionObserver, one requestAnimationFrame loop that sleeps when nothing moves.
 * Off entirely when the visitor prefers reduced motion.
 */
export default function Motion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;

    // reveal on scroll
    const targets = () => document.querySelectorAll<HTMLElement>(".rise, .words, [data-reveal]");
    if (reduced) {
      targets().forEach((el) => el.classList.add("in"));
    }
    const io = reduced ? null : new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io?.unobserve(e.target); }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    const observe = () => targets().forEach((el) => { if (!el.classList.contains("in")) io?.observe(el); });
    observe();
    // pages change without a reload; watch for new sections
    const mo = new MutationObserver(() => observe());
    mo.observe(document.body, { childList: true, subtree: true });

    // progress bar
    const bar = document.createElement("div");
    bar.className = "progress-bar";
    document.body.appendChild(bar);
    let barRaf = 0;
    const onScroll = () => {
      if (barRaf) return;
      barRaf = requestAnimationFrame(() => {
        barRaf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    // pointer ring
    let ring: HTMLDivElement | null = null;
    let raf = 0, tx = -100, ty = -100, x = -100, y = -100, big = false, shown = false;
    const step = () => {
      x += (tx - x) * 0.18; y += (ty - y) * 0.18;
      if (ring) ring.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${big ? 2.2 : 1})`;
      if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) raf = requestAnimationFrame(step); else raf = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX; ty = e.clientY;
      if (!shown && ring) { ring.classList.add("on"); shown = true; }
      const t = (e.target as HTMLElement | null)?.closest?.("a, button, [role=button], input, select, textarea, canvas, .cursor-ew-resize, .cursor-pointer");
      const nb = !!t;
      if (nb !== big && ring) { big = nb; ring.classList.toggle("big", big); }
      if (!raf) raf = requestAnimationFrame(step);
    };
    const onLeave = () => { if (ring) ring.classList.remove("on"); shown = false; };
    if (fine && !reduced) {
      ring = document.createElement("div");
      ring.className = "pointer-ring";
      document.body.appendChild(ring);
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("mouseleave", onLeave);
    }

    return () => {
      io?.disconnect(); mo.disconnect();
      window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onMove); document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf); cancelAnimationFrame(barRaf);
      bar.remove(); ring?.remove();
    };
  }, []);
  return null;
}

/** A headline whose words arrive one after the other when it scrolls in. Server-safe: plain spans. */
export function Words({ text, className = "", as: Tag = "span" }: { text: string; className?: string; as?: "span" | "h1" | "h2" | "div" | "p" }) {
  const words = text.split(" ");
  return (
    <Tag className={`words ${className}`} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="w" aria-hidden><span style={{ transitionDelay: `${Math.min(i, 14) * 45}ms`, animationDelay: `${Math.min(i, 14) * 45}ms` }}>{w}{i < words.length - 1 ? " " : ""}</span></span>
      ))}
    </Tag>
  );
}
