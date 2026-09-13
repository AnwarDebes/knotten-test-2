import Link from "next/link";
import type { Plot } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { sunLabel } from "@/lib/format";

function SunRow({ label, day }: { label: string; day: Plot["sun"]["dec21"] }) {
  const pct = Math.max(0, Math.min(1, day.possible_hours ? day.hours / day.possible_hours : 0));
  return (
    <div className="py-2.5 border-b line">
      <div className="grid grid-cols-[1fr_auto] items-baseline gap-3">
        <div>
          <div className="text-[14.5px]">{label}</div>
          <div className="provenance">{sunLabel(day.first_sun_cet)} til {sunLabel(day.last_sun_cet)}</div>
        </div>
        <div className="num text-[28px] leading-none">{day.hours.toFixed(1)}<span className="text-[12px] font-body opacity-60 ml-1">h</span></div>
      </div>
      <div className="mt-2 h-[3px] rounded bg-ink/10 overflow-hidden"><div className="h-full bg-amber" style={{ width: `${pct * 100}%` }} /></div>
    </div>
  );
}

/** The sun passport: one plot, its measured sun and view, on a card that reads like a document. */
export default function Passport({ plot, locale, compact = false }: { plot: Plot; locale: Locale; compact?: boolean }) {
  const d = t(locale);
  const P = d.passport;
  const no = locale === "no";
  return (
    <div className="paper p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="display text-[30px] leading-none">{plot.id.replace("plot-", no ? "Tomt " : "Plot ")}</div>
          <div className="provenance mt-1.5">{plot.zone === "flat" ? P.flat : `${P.row} ${plot.row}`}, {plot.local.z_ground.toFixed(0)} moh.</div>
        </div>
        <div className="text-right">
          <div className="num text-[30px] leading-none">{plot.view.water_visible_deg}°</div>
          <div className="text-[12.5px] text-granite">{P.seaDeg}</div>
        </div>
      </div>

      <div className="mt-3">
        <SunRow label={P.sunDec} day={plot.sun.dec21} />
        {!compact && <SunRow label={P.sunMar} day={plot.sun.mar21} />}
        <SunRow label={P.sunJun} day={plot.sun.jun21} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-[14px]">
        <div><div className="provenance">{P.openSea}</div><div className={plot.view.open_sea_visible ? "text-pine font-medium" : ""}>{plot.view.open_sea_visible ? `${P.yes}, ${plot.view.open_sea_deg}°` : P.no}</div></div>
        <div><div className="provenance">{P.slope}</div><div>{plot.terrain.slope_deg.toFixed(0)}°</div></div>
        <div><div className="provenance">{P.cutfill}</div><div>≈ {plot.terrain.level_pad_cutfill_m3.toFixed(0)} m³</div></div>
      </div>

      <div className="provenance mt-4">
        {no
          ? "Kartverket DTM 1 m og NOAA solposisjon. Terrengskygge med feltet ryddet. Beregnet 2026-09-08 for foreløpig utlegg v2."
          : "Kartverket DTM 1 m and NOAA solar position. Terrain shading with the field cleared. Computed 2026-09-08 for provisional layout v2."}
      </div>
      {!compact && (
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link className="btn btn-sm" href={`/${locale}/tomter/${plot.id}`}>{d.cta.passport}</Link>
          <Link className="btn btn-ghost btn-sm" href={`/${locale}/interesse?plot=${plot.id}`}>{d.cta.register}</Link>
        </div>
      )}
    </div>
  );
}
