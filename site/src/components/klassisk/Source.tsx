"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { SOURCES, type SourceId } from "@/lib/facts";

type Ctx = { open: (id: string, el: HTMLElement) => void; current: string | null };
const SourceCtx = createContext<Ctx>({ open: () => {}, current: null });

/** Holds the one shared popover that every "Kilde" chip opens. */
export default function SourceProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const popRef = useRef<HTMLDivElement>(null);

  const open = useCallback((id: string, el: HTMLElement) => {
    setCurrent((c) => (c === id ? null : id));
    const r = el.getBoundingClientRect();
    const left = Math.max(12, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - 360));
    setPos({ left, top: r.bottom + window.scrollY + 8 });
  }, []);

  useEffect(() => {
    if (!current) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".src") || popRef.current?.contains(t)) return;
      setCurrent(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setCurrent(null);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, [current]);

  const s = current ? SOURCES[current as SourceId] : null;
  return (
    <SourceCtx.Provider value={{ open, current }}>
      {children}
      {s && (
        <div ref={popRef} className="pop" role="dialog" aria-live="polite" style={{ left: pos.left, top: pos.top }}>
          {s.quote}
          <small>
            {s.doc.no}
            {s.url && (
              <>
                {" "}
                <a href={s.url} target="_blank" rel="noopener noreferrer">Åpne kilden</a>
              </>
            )}
          </small>
        </div>
      )}
    </SourceCtx.Provider>
  );
}

/** The chip. Put it right after the number it documents. */
export function Src({ id, label = "Kilde" }: { id: SourceId; label?: string }) {
  const { open, current } = useContext(SourceCtx);
  return (
    <button type="button" className="src" aria-expanded={current === id} onClick={(e) => open(id, e.currentTarget)}>
      {label}
    </button>
  );
}
