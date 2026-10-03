"use client";
import { useRef, useState } from "react";

/** Photograph against model from the same point. Drag to compare. */
export default function ProofSlider({ photo, model, labels, className = "" }: { photo: string; model: string; labels: [string, string]; className?: string }) {
  const [x, setX] = useState(0.5);
  const [drag, setDrag] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  // a finger that only lands (or swipes the page on) does not move the divider: it moves on a sideways drag or a tap
  const down = useRef<{ x: number; y: number } | null>(null);
  const move = (e: React.PointerEvent) => {
    if (!box.current) return;
    const touch = e.pointerType === "touch";
    if (e.type === "pointerdown") { setDrag(true); down.current = { x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
    const tap = touch && e.type === "pointerup" && !!down.current && Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 10;
    if (e.type === "pointerup" || e.type === "pointercancel") { setDrag(false); down.current = null; }
    if ((e.type === "pointerdown" && !touch) || (e.type === "pointermove" && drag) || tap) {
      const r = box.current.getBoundingClientRect();
      setX(Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)));
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    const to = (f: (v: number) => number) => { e.preventDefault(); setX((v) => Math.min(0.98, Math.max(0.02, f(v)))); };
    if (k === "ArrowLeft" || k === "ArrowDown") to((v) => v - 0.04);
    if (k === "ArrowRight" || k === "ArrowUp") to((v) => v + 0.04);
    if (k === "PageDown") to((v) => v - 0.2);
    if (k === "PageUp") to((v) => v + 0.2);
    if (k === "Home") to(() => 0.02);
    if (k === "End") to(() => 0.98);
  };
  return (
    <div
      ref={box}
      className={`relative w-full aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-night select-none touch-pan-y cursor-ew-resize ${className}`}
      onPointerDown={move} onPointerMove={move} onPointerUp={move} onPointerCancel={move}
      tabIndex={0} onKeyDown={onKey} role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(x * 100)} aria-valuetext={`${Math.round(x * 100)} % ${labels[0].toLowerCase()}`} aria-label={`${labels[0]} / ${labels[1]}`}
    >
      <img src={model} alt={labels[1]} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      {photoOk && (
        <img src={photo} alt={labels[0]} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" draggable={false} style={{ clipPath: `inset(0 ${100 - x * 100}% 0 0)` }} onError={() => setPhotoOk(false)} />
      )}
      <div className="wipe-handle" style={{ left: `${x * 100}%` }} />
      <div className="absolute left-3 top-3 chip !bg-night/75 !text-white">{photoOk ? labels[0] : ""}</div>
      <div className="absolute right-3 top-3 chip !bg-night/75 !text-white">{labels[1]}</div>
    </div>
  );
}
