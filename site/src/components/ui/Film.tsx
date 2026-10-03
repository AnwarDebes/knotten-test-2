"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * The fly-in, rendered from the measured model: over the fjord, up the Audna, onto the field.
 * It plays once when it comes into view, holds the last frame, and can be replayed. Phones get the
 * poster and a play button, so nothing heavy loads unasked.
 */
export default function Film({ locale, className = "" }: { locale: Locale; className?: string }) {
  const no = locale === "no";
  const video = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"poster" | "playing" | "done">("poster");
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const capable = !window.matchMedia("(pointer: coarse)").matches && !nav.connection?.saveData && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!capable) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setAuto(true); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const play = () => {
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().then(() => setState("playing")).catch(() => setState("poster"));
  };
  useEffect(() => { if (auto && state === "poster") play(); }, [auto, state]);

  return (
    <div ref={root} className={`frame relative aspect-[16/9] ${className}`}>
      {/* (the card is about 340 px wide: the 960 px still is plenty, the 1920 px one only for a wide phone screen) */}
      <img src="/renders/web/site_after_960.webp" srcSet="/renders/web/site_after_960.webp 960w, /renders/web/site_after.webp 1920w" sizes="(min-width: 1024px) 360px, 100vw" alt="" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${state === "poster" ? "opacity-100" : "opacity-0"}`} />
      <video
        ref={video}
        className="absolute inset-0 w-full h-full object-cover"
        src="/renders/knotten_flyin_720p.mp4"
        preload={auto ? "auto" : "none"}
        muted
        playsInline
        aria-label={no ? "Flyturen: over Sniksfjorden, opp langs Audna og inn over feltet på Knotten" : "The fly-in: over Sniksfjorden, up the Audna and in over the field on Knotten"}
        onEnded={() => setState("done")}
      />
      {state !== "playing" && (
        <div className="absolute inset-0 grid place-items-center">
          <button className="btn btn-ghost" onClick={play}>
            {state === "done" ? (no ? "Se flyturen igjen" : "Watch the fly-in again") : (no ? "Se flyturen" : "Watch the fly-in")}
          </button>
        </div>
      )}
      {/* a film that plays on its own can always be stopped */}
      {state === "playing" && (
        <button className="absolute right-3 top-3 chip !bg-night/75 !text-white hover:!bg-night" onClick={() => { video.current?.pause(); setState("done"); }}>
          {no ? "Stopp filmen" : "Stop the film"}
        </button>
      )}
      {/* the caption on a soft shade, so it reads over the bright sky and water */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-3.5 pt-8 bg-gradient-to-t from-night/70 to-transparent text-[12.5px] text-white/90 pointer-events-none">{no ? "Rendret fra den målte modellen. 12 sekunder." : "Rendered from the measured model. 12 seconds."}</div>
    </div>
  );
}
