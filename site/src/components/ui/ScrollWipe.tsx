"use client";
import { useRef, useState } from "react";

/**
 * Before and after in one frame. As the frame travels up the screen the "after" image is revealed
 * from left to right, driven by the scroll position itself (CSS scroll timeline, no listeners).
 * Moving the pointer across it takes over the reveal; leaving hands it back to the scroll.
 */
export default function ScrollWipe({ before, after, labels, caption, className = "" }: { before: string; after: string; labels: [string, string]; caption?: string; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (!box.current) return;
    const r = box.current.getBoundingClientRect();
    setHover(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };
  return (
    <figure className={className}>
      <div
        ref={box}
        className="frame relative aspect-[16/10] md:aspect-[16/9] select-none"
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
      >
        <img src={before} alt={labels[0]} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <img
          src={after}
          alt={labels[1]}
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover ${hover === null ? "wipe-scroll" : ""}`}
          style={hover !== null ? { clipPath: `inset(0 ${(1 - hover) * 100}% 0 0)` } : undefined}
        />
        <div className={`absolute top-0 bottom-0 w-[2px] bg-white/90 ${hover === null ? "wipe-scroll-line" : ""}`} style={hover !== null ? { left: `${hover * 100}%` } : undefined} />
        <div className="absolute left-4 top-4 chip !bg-night/60 !text-white">{labels[0]}</div>
        <div className="absolute right-4 top-4 chip !bg-night/60 !text-white">{labels[1]}</div>
      </div>
      {caption && <figcaption className="provenance mt-3">{caption}</figcaption>}
      <style>{`
        @keyframes wipe-reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0% 0 0); } }
        @keyframes wipe-line { from { left: 0%; } to { left: 100%; } }
        .wipe-scroll { clip-path: inset(0 50% 0 0); }
        .wipe-scroll-line { left: 50%; }
        @supports (animation-timeline: view()) {
          .wipe-scroll { animation: wipe-reveal linear both; animation-timeline: view(); animation-range: entry 20% exit 20%; }
          .wipe-scroll-line { animation: wipe-line linear both; animation-timeline: view(); animation-range: entry 20% exit 20%; }
        }
      `}</style>
    </figure>
  );
}
