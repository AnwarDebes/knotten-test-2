"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Reveals its content once when it scrolls into view. Content is visible without JS and
 * with reduced motion. With `stagger`, direct children arrive one after another.
 */
export default function Reveal({ children, className = "", style, delay = 0, stagger = false, as: Tag = "div" }: { children: React.ReactNode; className?: string; style?: CSSProperties; delay?: number; stagger?: boolean; as?: "div" | "section" | "figure" }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (setOn(true), io.disconnect())), { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const T = Tag as "div";
  return (
    <T ref={ref as React.RefObject<HTMLDivElement>} className={`reveal${stagger ? " stagger" : ""}${on ? " in" : ""} ${className}`.trim()} style={{ ...style, ["--d" as string]: `${delay}ms` }}>
      {children}
    </T>
  );
}
