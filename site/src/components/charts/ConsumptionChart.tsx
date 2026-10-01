import type { Locale } from "@/lib/i18n";
import { MONTHS } from "@/lib/i18n";

/** Monthly consumption, two years, with an intervention band. Sample data until the meters are wired. */
export default function ConsumptionChart({ seed, locale }: { seed: number; locale: Locale }) {
  const no = locale === "no";
  const rnd = (i: number) => { const x = Math.sin(seed * 97 + i * 13.37) * 10000; return x - Math.floor(x); };
  const shape = (m: number) => 0.55 + 0.45 * Math.cos(((m - 0.5) / 12) * Math.PI * 2); // winter high
  const y1 = Array.from({ length: 12 }, (_, m) => Math.round((2400 + 1900 * shape(m)) * (0.92 + rnd(m) * 0.16)));
  const y2 = Array.from({ length: 12 }, (_, m) => Math.round(y1[m] * (m >= 3 ? 0.78 : 0.98) * (0.94 + rnd(m + 20) * 0.12))); // heat pump from April
  const W = 720, H = 240, padL = 44, padB = 26, padT = 12;
  const max = Math.max(...y1) * 1.08;
  const x = (m: number) => padL + (m / 12) * (W - padL - 8);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const bw = (W - padL - 8) / 12;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="consumption">
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={padL} x2={W - 8} y1={y(max * f)} y2={y(max * f)} stroke="rgba(23,33,42,.12)" />)}
        {[0.25, 0.5, 0.75].map((f) => <text key={f} x={padL - 4} y={y(max * f) + 4} fontSize="11" textAnchor="end" fill="#6b7680">{Math.round(max * f / 100) / 10}k</text>)}
        <rect x={x(3)} y={padT} width={x(12) - x(3)} height={H - padT - padB} fill="rgba(217,164,65,.10)" />
        <text x={x(3) + 6} y={padT + 14} fontSize="11" fill="#b7842a">{no ? "eksempel på et tiltak" : "example of a measure"}</text>
        {y1.map((v, m) => <rect key={`a${m}`} x={x(m) + 3} y={y(v)} width={bw / 2 - 4} height={y(0) - y(v)} fill="#9fb3bf" />)}
        {y2.map((v, m) => <rect key={`b${m}`} x={x(m) + bw / 2} y={y(v)} width={bw / 2 - 4} height={y(0) - y(v)} fill="#2b3a45" />)}
        {MONTHS[locale].map((mo, m) => <text key={mo} x={x(m) + bw / 2} y={H - 8} fontSize="11" textAnchor="middle" fill="#6b7680">{mo}</text>)}
      </svg>
      <div className="flex gap-4 text-[13px] mt-1">
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "#9fb3bf" }} />{no ? "Eksempel, år 1" : "Example, year 1"}</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: "#2b3a45" }} />{no ? "Eksempel, år 2" : "Example, year 2"}</span>
        <span className="provenance ml-auto">kWh/{no ? "mnd" : "month"} · {no ? "eksempeldata" : "sample data"}</span>
      </div>
    </div>
  );
}
