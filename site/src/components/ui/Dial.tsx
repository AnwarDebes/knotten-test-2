"use client";
import type { Locale } from "@/lib/i18n";
import { MONTHS, t } from "@/lib/i18n";
import { solarPosition, knottenTime } from "@/lib/solar";

export type DialValue = { month: number; hour: number };

/** Sun and date. Two sliders, one readout; the amber dot on the thumb is the sun. */
export default function Dial({ value, onChange, locale, horizon }: { value: DialValue; onChange: (v: DialValue) => void; locale: Locale; horizon?: number[] }) {
  const d = t(locale);
  const date = knottenTime(2026, value.month, 21, value.hour);
  const sun = solarPosition(date);
  const hz = horizon ? horizon[Math.round(sun.azimuth) % 360] : 0;
  const up = sun.elevation > hz + 0.25;
  const hh = Math.floor(value.hour);
  const mm = Math.round((value.hour - hh) * 60);
  return (
    <div className="dial glass p-2.5 w-[min(80vw,210px)]">
      <div className="flex items-baseline justify-between gap-3">
        <div className="num text-[24px] leading-none">{hh}:{mm.toString().padStart(2, "0")}</div>
        <div className="text-right">
          <div className="display-italic text-[15px] leading-none">21. {MONTHS[locale][value.month - 1]}</div>
          <div className={`text-[11px] mt-0.5 ${up ? "text-amber" : "opacity-60"}`}>
            {up ? d.dial.sunUp : d.dial.sunDown}, {sun.elevation.toFixed(0)}°
          </div>
        </div>
      </div>
      <label className="block mt-2 text-[11px] opacity-75">{d.dial.hour}
        <input type="range" min={0} max={23.75} step={0.25} value={value.hour} onChange={(e) => onChange({ ...value, hour: +e.target.value })} aria-label={d.dial.hour} />
      </label>
      <label className="block mt-1.5 text-[11px] opacity-75">{d.dial.month}
        <input type="range" min={1} max={12} step={1} value={value.month} onChange={(e) => onChange({ ...value, month: +e.target.value })} aria-label={d.dial.month} />
      </label>
    </div>
  );
}
