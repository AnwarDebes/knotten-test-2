import type { Locale } from "@/lib/i18n";

export default function DayChart({ frames, locale }: { frames: { pv: number; load: number; soc: number }[]; locale: Locale }) {
  const no = locale === "no";
  const W = 900, H = 260, padL = 44, padB = 24, padT = 12;
  const max = Math.max(...frames.map((f) => Math.max(f.pv, f.load))) * 1.1 || 1;
  const x = (h: number) => padL + (h / 24) * (W - padL - 8);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const path = (k: "pv" | "load") => frames.map((f, h) => `${h === 0 ? "M" : "L"}${x(h + 0.5).toFixed(1)},${y(f[k]).toFixed(1)}`).join(" ");
  const socPath = frames.map((f, h) => `${h === 0 ? "M" : "L"}${x(h + 0.5).toFixed(1)},${(padT + (1 - f.soc) * (H - padT - padB)).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="day">
        <rect x={padL} y={padT} width={W - padL - 8} height={H - padT - padB} fill="#f6f4ee" />
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={padL} x2={W - 8} y1={y(max * f)} y2={y(max * f)} stroke="rgba(23,33,42,.12)" />)}
        {[0.25, 0.5, 0.75].map((f) => <text key={f} x={padL - 4} y={y(max * f) + 4} fontSize="11" textAnchor="end" fill="#6b7680">{(max * f).toFixed(0)} kW</text>)}
        <path d={path("pv") + ` L${x(23.5)},${y(0)} L${x(0.5)},${y(0)} Z`} fill="rgba(217,164,65,.28)" />
        <path d={path("pv")} fill="none" stroke="#d9a441" strokeWidth="2" />
        <path d={path("load")} fill="none" stroke="#2b3a45" strokeWidth="2" />
        <path d={socPath} fill="none" stroke="#5f7d6a" strokeWidth="1.5" strokeDasharray="4 3" />
        {[0, 6, 12, 18, 24].map((h) => <text key={h} x={x(h)} y={H - 6} fontSize="11" textAnchor="middle" fill="#6b7680">{h}:00</text>)}
      </svg>
      <div className="flex flex-wrap gap-4 text-[13px] mt-1">
        <span><span className="inline-block w-3 h-[2px] align-middle mr-1" style={{ background: "#d9a441" }} />PV</span>
        <span><span className="inline-block w-3 h-[2px] align-middle mr-1" style={{ background: "#2b3a45" }} />{no ? "Forbruk" : "Load"}</span>
        <span><span className="inline-block w-3 h-[2px] align-middle mr-1 border-t border-dashed" style={{ borderColor: "#5f7d6a" }} />SOC (0 til 100 %)</span>
      </div>
    </div>
  );
}
