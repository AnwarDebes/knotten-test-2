"use client";
import { useRef, useState } from "react";

/** Photograph against model from the same point. Drag to compare. */
export default function ProofSlider({ photo, model, labels, className = "" }: { photo: string; model: string; labels: [string, string]; className?: string }) {
  const [x, setX] = useState(0.5);
  const [drag, setDrag] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (!box.current) return;
    if (e.type === "pointerdown") { setDrag(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
    if (e.type === "pointerup" || e.type === "pointercancel") setDrag(false);
    if (e.type === "pointerdown" || (e.type === "pointermove" && drag)) {
      const r = box.current.getBoundingClientRect();
      setX(Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)));
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setX((v) => Math.max(0.02, v - 0.04));
    if (e.key === "ArrowRight") setX((v) => Math.min(0.98, v + 0.04));
  };
  return (
    <div
      ref={box}
      className={`relative w-full aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-night select-none touch-none cursor-ew-resize ${className}`}
      onPointerDown={move} onPointerMove={move} onPointerUp={move} onPointerCancel={move}
      tabIndex={0} onKeyDown={onKey} role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(x * 100)} aria-label={`${labels[0]} / ${labels[1]}`}
    >
      <img src={model} alt={labels[1]} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      {photoOk && (
        <img src={photo} alt={labels[0]} className="absolute inset-0 w-full h-full object-cover" draggable={false} style={{ clipPath: `inset(0 ${100 - x * 100}% 0 0)` }} onError={() => setPhotoOk(false)} />
      )}
      <div className="wipe-handle" style={{ left: `${x * 100}%` }} />
      <div className="absolute left-3 top-3 chip !bg-night/60 !text-white">{photoOk ? labels[0] : ""}</div>
      <div className="absolute right-3 top-3 chip !bg-night/60 !text-white">{labels[1]}</div>
    </div>
  );
}
