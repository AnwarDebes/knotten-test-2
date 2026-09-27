"use client";
import { useEffect, useRef, useState } from "react";

/** Counts a number up from zero the first time it is scrolled into view. Renders the final value without JS. */
export default function CountUp({ value, prefix = "", suffix = "", duration = 1200 }: { value: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLElement>(null);
  const [n, setN] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / duration);
        const e = 1 - Math.pow(1 - k, 3);
        setN(Math.round(value * e));
        if (k < 1) requestAnimationFrame(step);
      };
      setN(0);
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);
  return <b ref={ref}>{prefix}{n.toLocaleString("nb-NO").replace(/ /g, " ")}{suffix}</b>;
}
