import Link from "next/link";
import type { Plot } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { plotName, rowLabel, sunLabel } from "@/lib/format";

function SunRow({ label, day, small = false }: { label: string; day: Plot["sun"]["dec21"]; small?: boolean }) {
  const pct = Math.max(0, Math.min(1, day.possible_hours ? day.hours / day.possible_hours : 0));
  return (
    <div className={`${small ? "py-1.5" : "py-2.5"} border-b line`}>
      <div className="grid grid-cols-[1fr_auto] items-baseline gap-3">
        <div>
          <div className={small ? "text-[12.5px]" : "text-[14.5px]"}>{label}</div>
          <div className="provenance">{sunLabel(day.first_sun_cet)} til {sunLabel(day.last_sun_cet)}</div>
        </div>
        <div className={`num leading-none ${small ? "text-[19px]" : "text-[28px]"}`}>{day.hours.toFixed(1)}<span className="text-[12px] font-body opacity-60 ml-1">h</span></div>
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
    <div className={compact ? "paper p-3.5 text-[13px]" : "paper p-5 md:p-6"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`display leading-none ${compact ? "text-[20px]" : "text-[30px]"}`}>{plotName(plot.id, no)}</div>
          <div className="provenance mt-1.5">{plot.zone === "flat" ? P.flat : `${P.row} ${rowLabel(plot)}`}, {plot.local.z_ground.toFixed(0)} moh.</div>
        </div>
        <div className="text-right">
          <div className={`num leading-none ${compact ? "text-[20px]" : "text-[30px]"}`}>{plot.view.water_visible_deg}°</div>
          <div className="text-[12.5px] text-granite">{P.seaDeg}</div>
        </div>
      </div>

      <div className={compact ? "mt-1 text-[12.5px]" : "mt-3"}>
        <SunRow label={P.sunDec} day={plot.sun.dec21} small={compact} />
        {!compact && <SunRow label={P.sunMar} day={plot.sun.mar21} />}
        <SunRow label={P.sunJun} day={plot.sun.jun21} small={compact} />
      </div>

      <div className={`grid grid-cols-3 gap-2 whitespace-nowrap ${compact ? "mt-2.5 text-[11.5px]" : "mt-4 text-[14px]"}`}>
        <div><div className="provenance">{P.openSea}</div><div className={plot.view.open_sea_visible ? "text-pine font-medium" : ""}>{plot.view.open_sea_visible ? `${P.yes}, ${plot.view.open_sea_deg}°` : P.no}</div></div>
        <div><div className="provenance">{P.slope}</div><div>{plot.terrain.slope_deg.toFixed(0)}°</div></div>
        <div><div className="provenance">{P.cutfill}</div><div>≈ {plot.terrain.level_pad_cutfill_m3.toFixed(0)} m³</div></div>
      </div>

      <div className={compact ? "hidden" : "provenance mt-4"}>
        {no
          ? "Kartverket DTM 1 m og NOAA solposisjon. Terrengskygge med feltet ryddet. Beregnet 2026-09-30 for foreløpig utlegg v6 (rekke A til D), med nabohusene stående."
          : "Kartverket DTM 1 m and NOAA solar position. Terrain shading with the field cleared. Computed 2026-09-30 for provisional layout v6 (rows A to D), with the neighbouring houses standing."}
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
