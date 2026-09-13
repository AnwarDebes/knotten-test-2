import type { Plot } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { solarPosition, knottenTime } from "@/lib/solar";

/** Terrain horizon by bearing with the sun's path on three dates. Server-rendered SVG. */
export default function HorizonChart({ plot, locale }: { plot: Plot; locale: Locale }) {
  const W = 720, H = 220, padL = 34, padB = 22, padT = 10;
  const maxEl = 60;
  const x = (b: number) => padL + (b / 360) * (W - padL - 8);
  const y = (el: number) => padT + (1 - Math.max(0, el) / maxEl) * (H - padT - padB);
  const hz = plot.horizon_deg_by_bearing;
  const path = hz.map((v, b) => `${b === 0 ? "M" : "L"}${x(b).toFixed(1)},${y(v).toFixed(1)}`).join(" ") + ` L${x(360)},${y(0)} L${x(0)},${y(0)} Z`;
  const sunPath = (month: number) => {
    const pts: string[] = [];
    for (let m = 0; m < 1440; m += 10) {
      const s = solarPosition(knottenTime(2026, month, 21, m / 60));
      if (s.elevation <= 0) continue;
      pts.push(`${x(s.azimuth).toFixed(1)},${y(s.elevation).toFixed(1)}`);
    }
    return pts;
  };
  const dates = [[12, "#d9a441"], [3, "#9fb3bf"], [6, "#5f7d6a"]] as const;
  const no = locale === "no";
  const dirs = [[0, "N"], [90, "Ø"], [180, "S"], [270, "V"]] as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="horizon">
      <rect x={padL} y={padT} width={W - padL - 8} height={H - padT - padB} fill="#f6f4ee" />
      {[15, 30, 45].map((el) => <line key={el} x1={padL} x2={W - 8} y1={y(el)} y2={y(el)} stroke="rgba(23,33,42,.12)" />)}
      {[15, 30, 45].map((el) => <text key={el} x={padL - 4} y={y(el) + 4} fontSize="11" textAnchor="end" fill="#6b7680">{el}°</text>)}
      <path d={path} fill="#2b3a45" opacity="0.92" />
      {dates.map(([mo, col]) => {
        const pts = sunPath(mo);
        return pts.map((p, i) => <circle key={`${mo}-${i}`} cx={+p.split(",")[0]} cy={+p.split(",")[1]} r="1.6" fill={col} />);
      })}
      {dirs.map(([b, l]) => <text key={b} x={x(b)} y={H - 6} fontSize="11" textAnchor="middle" fill="#6b7680">{no ? l : l === "Ø" ? "E" : l === "V" ? "W" : l}</text>)}
      <g fontSize="11" fill="#17212a">
        <circle cx={W - 190} cy={padT + 10} r="3" fill="#d9a441" /><text x={W - 183} y={padT + 14}>21 {no ? "des" : "Dec"}</text>
        <circle cx={W - 130} cy={padT + 10} r="3" fill="#9fb3bf" /><text x={W - 123} y={padT + 14}>21 {no ? "mar" : "Mar"}</text>
        <circle cx={W - 70} cy={padT + 10} r="3" fill="#5f7d6a" /><text x={W - 63} y={padT + 14}>21 {no ? "jun" : "Jun"}</text>
      </g>
    </svg>
  );
}
