import type { Building } from "@/lib/server/records";

const MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

/**
 * Measured monthly consumption for one of the buildings on the property, in the Klassisk look:
 * the last 24 months as bars, months with an upgrade in sun yellow. Shown only when the owner has
 * loaded meter data in the portal and chosen to publish it.
 */
export default function MeterChart({ b }: { b: Building }) {
  const rows = b.readings.slice(-24);
  const W = 420, H = 150, left = 34, bottom = 22, top = 14;
  const max = Math.max(1, ...rows.map((r) => r.kwh));
  const bw = (W - left - 6) / Math.max(1, rows.length);
  const ups = new Set(b.upgrades.map((u) => u.date.slice(0, 7)));
  const nf = (v: number) => Math.round(v).toLocaleString("nb-NO");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${b.name.no}: målt forbruk per måned, ${rows[0]?.month} til ${rows[rows.length - 1]?.month}`}>
      <g stroke="#E3E9EF" strokeWidth="1"><path d={`M${left} ${top}H${W - 4}M${left} ${(top + H - bottom) / 2}H${W - 4}M${left} ${H - bottom}H${W - 4}`} /></g>
      <text x="2" y={top + 4} fontSize="9" fill="#5C6979">{nf(max)}</text>
      <text x="2" y={H - bottom} fontSize="9" fill="#5C6979">kWh</text>
      {rows.map((r, i) => {
        const h = ((H - top - bottom) * r.kwh) / max;
        const m = Number(r.month.slice(5, 7)) - 1;
        return (
          <g key={r.month}>
            <rect x={left + i * bw + bw * 0.15} y={H - bottom - h} width={bw * 0.7} height={h} rx="1.5" fill={ups.has(r.month) ? "var(--sun)" : "var(--fjord-deep)"}>
              <title>{`${MONTHS[m]} ${r.month.slice(0, 4)}: ${nf(r.kwh)} kWh`}</title>
            </rect>
            {(m === 0 || i === 0) && <text x={left + i * bw} y={H - 6} fontSize="9" fill="#5C6979">{`${MONTHS[m]} ${r.month.slice(2, 4)}`}</text>}
          </g>
        );
      })}
    </svg>
  );
}
