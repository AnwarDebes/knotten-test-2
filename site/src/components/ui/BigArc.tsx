"use client";
import { useMemo, useRef, useState } from "react";
import { solarPosition, knottenTime } from "@/lib/solar";
import { fmtHours } from "@/lib/format";

/**
 * The one big graphic on the site: the real path of the sun over Knotten on 21 December, drawn
 * large as a stroke that sweeps behind the headline, with the measured hill under it. Move the
 * pointer across it and the sun follows: the clock shows when it stands there, and whether the
 * ridge has taken it.
 */
export default function BigArc({ horizon, locale, className = "" }: { horizon: number[]; locale: "no" | "en"; className?: string }) {
  const W = 1600, H = 520;
  const AZ0 = 100, AZ1 = 260;
  const MAXEL = 16;
  const x = (az: number) => ((az - AZ0) / (AZ1 - AZ0)) * W;
  const y = (el: number) => H - 60 - (Math.max(-3, Math.min(MAXEL, el)) / MAXEL) * (H - 100);
  const no = locale === "no";
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null); // 0..1 across the arc

  const { hzLine, arcPath, samples } = useMemo(() => {
    const hz: string[] = [];
    for (let b = AZ0; b <= AZ1; b++) hz.push(`${x(b).toFixed(1)},${y(horizon[b % 360] ?? 0).toFixed(1)}`);
    const samples: { t: number; az: number; el: number; up: boolean }[] = [];
    for (let m = 0; m <= 1440; m += 2) {
      const s = solarPosition(knottenTime(2026, 12, 21, m / 60));
      if (s.elevation < -3 || s.azimuth < AZ0 || s.azimuth > AZ1) continue;
      samples.push({ t: m / 60, az: s.azimuth, el: s.elevation, up: s.elevation > (horizon[Math.round(s.azimuth) % 360] ?? 0) + 0.25 });
    }
    const arcPath = samples.length ? `M${samples.map((s) => `${x(s.az).toFixed(1)},${y(s.el).toFixed(1)}`).join(" L")}` : "";
    return { hzLine: `M${hz.join(" L")}`, arcPath, samples };
  }, [horizon]);

  const onMove = (e: React.PointerEvent) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    setHover(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };
  const s = hover === null ? null : samples[Math.round(hover * (samples.length - 1))];

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <path d={arcPath} fill="none" stroke="var(--amber)" strokeWidth="26" strokeLinecap="round" />
      <path d={hzLine} fill="none" stroke="var(--night)" strokeWidth="2.5" strokeLinejoin="round" opacity=".55" />
      {s && (
        <g style={{ pointerEvents: "none" }}>
          <circle cx={x(s.az)} cy={y(s.el)} r="22" fill={s.up ? "var(--amber)" : "var(--night)"} stroke="var(--frost)" strokeWidth="6" />
          <text x={x(s.az)} y={y(s.el) - 42} fontSize="26" fontFamily="var(--font-body)" fontWeight="500" textAnchor="middle" fill="var(--night)">
            {fmtHours(s.t)} {s.up ? (no ? "sol" : "sun") : (no ? "bak åsen" : "behind the ridge")}
          </text>
        </g>
      )}
    </svg>
  );
}
