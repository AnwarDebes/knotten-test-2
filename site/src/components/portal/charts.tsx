/**
 * Small charts for the portal, drawn as SVG on the server: no chart library, readable without
 * scripts, and printable. Hovering a bar or point shows its value (SVG <title>).
 */

type BarDatum = { label: string; value: number; tone?: "fjord" | "pine" | "amber" | "muted"; title?: string };
const FILL = { fjord: "var(--fjord)", pine: "var(--pine)", amber: "var(--amber)", muted: "rgba(23,40,58,.18)" };

export function Bars({ data, height = 180, unit = "", every = 1, fmt = (v: number) => Math.round(v).toLocaleString("nb-NO"), ariaLabel }: { data: BarDatum[]; height?: number; unit?: string; every?: number; fmt?: (v: number) => string; ariaLabel: string }) {
  const W = 720, H = height, top = 16, bottom = 26, left = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (W - left * 2) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
      <line x1={left} x2={W - left} y1={H - bottom} y2={H - bottom} stroke="var(--line-strong)" />
      <text x={left} y={11} fontSize="11" fill="var(--muted)">{fmt(max)} {unit}</text>
      <line x1={left} x2={W - left} y1={top} y2={top} stroke="var(--line)" strokeDasharray="3 4" />
      {data.map((d, i) => {
        const h = ((H - top - bottom) * d.value) / max;
        const x = left + i * bw;
        return (
          <g key={i}>
            <rect x={x + bw * 0.14} y={H - bottom - h} width={bw * 0.72} height={Math.max(0, h)} rx={Math.min(4, bw * 0.2)} fill={FILL[d.tone ?? "fjord"]}>
              <title>{d.title ?? `${d.label}: ${fmt(d.value)} ${unit}`}</title>
            </rect>
            {i % every === 0 && <text x={x + bw / 2} y={H - 8} fontSize="11" textAnchor="middle" fill="var(--muted)">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Spark({ values, width = 160, height = 40, tone = "fjord" }: { values: number[]; width?: number; height?: number; tone?: "fjord" | "pine" | "amber" }) {
  if (values.length < 2 || values.every((v) => !v)) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 3 - (v / max) * (height - 6)}`);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-hidden>
      <polyline points={`0,${height} ${pts.join(" ")} ${width},${height}`} fill={tone === "pine" ? "rgba(79,113,86,.12)" : tone === "amber" ? "rgba(226,162,59,.16)" : "rgba(47,102,136,.12)"} stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke={FILL[tone]} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Power price through the day as steps, today and (when published) tomorrow, with a mark for now. */
export function PriceSteps({ today, tomorrow, nowHour, no }: { today: { hour: number; nok: number }[]; tomorrow?: { hour: number; nok: number }[] | null; nowHour?: number; no: boolean }) {
  const series = [...today.map((p) => ({ ...p, day: 0 })), ...(tomorrow ?? []).map((p) => ({ ...p, day: 1 }))];
  if (!series.length) return null;
  const W = 720, H = 200, top = 18, bottom = 26, left = 34, right = 8;
  const max = Math.max(0.5, ...series.map((p) => p.nok)) * 1.08;
  const min = Math.min(0, ...series.map((p) => p.nok));
  const n = series.length;
  const x = (i: number) => left + (i / n) * (W - left - right);
  const y = (v: number) => top + (1 - (v - min) / (max - min)) * (H - top - bottom);
  let d = "";
  series.forEach((p, i) => { d += `${i === 0 ? "M" : "L"}${x(i)},${y(p.nok)} L${x(i + 1)},${y(p.nok)} `; });
  const ticks = [0, max / 2, max].map((v) => Math.round(v * 100) / 100);
  const nowI = nowHour !== undefined ? today.findIndex((p) => p.hour === Math.floor(nowHour)) : -1;
  const lo = series.reduce((b, p, i) => (p.nok < series[b].nok ? i : b), 0);
  const hi = series.reduce((b, p, i) => (p.nok > series[b].nok ? i : b), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={no ? "Strømpris time for time" : "Power price hour by hour"}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 0 ? undefined : "3 4"} />
          <text x={left - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill="var(--muted)">{v.toFixed(2).replace(".", no ? "," : ".")}</text>
        </g>
      ))}
      {tomorrow && tomorrow.length > 0 && <rect x={x(today.length)} y={top} width={W - right - x(today.length)} height={H - top - bottom} fill="rgba(47,102,136,.05)" />}
      <path d={d} fill="none" stroke="var(--fjord)" strokeWidth="2" strokeLinejoin="round" />
      {series.map((p, i) => (
        <rect key={i} x={x(i)} y={top} width={x(i + 1) - x(i)} height={H - top - bottom} fill="transparent">
          <title>{`${p.day ? (no ? "I morgen" : "Tomorrow") : (no ? "I dag" : "Today")} ${String(p.hour).padStart(2, "0")}:00  ${p.nok.toFixed(2)} kr/kWh`}</title>
        </rect>
      ))}
      <circle cx={(x(lo) + x(lo + 1)) / 2} cy={y(series[lo].nok)} r="4" fill="var(--pine)" />
      <circle cx={(x(hi) + x(hi + 1)) / 2} cy={y(series[hi].nok)} r="4" fill="var(--amber)" />
      {nowI >= 0 && (
        <g>
          <line x1={x(nowI + ((nowHour ?? 0) % 1))} x2={x(nowI + ((nowHour ?? 0) % 1))} y1={top - 6} y2={H - bottom} stroke="var(--ink)" strokeWidth="1.2" />
          <text x={x(nowI + ((nowHour ?? 0) % 1)) + 4} y={top - 6} fontSize="11" fill="var(--ink)">{no ? "nå" : "now"}</text>
        </g>
      )}
      {[0, 6, 12, 18].map((h) => <text key={h} x={x(h)} y={H - 8} fontSize="11" fill="var(--muted)">{`${String(h).padStart(2, "0")}`}</text>)}
      {tomorrow && tomorrow.length > 0 && [0, 12].map((h) => <text key={`t${h}`} x={x(today.length + h)} y={H - 8} fontSize="11" fill="var(--muted)">{h === 0 ? (no ? "i morgen" : "tomorrow") : "12"}</text>)}
    </svg>
  );
}
