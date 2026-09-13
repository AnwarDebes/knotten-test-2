import { ImageResponse } from "next/og";
import { loadPlot } from "@/lib/data";
import { sunLabel } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await params;
  const p = await loadPlot(id);
  const no = locale === "no";
  const name = id.replace("plot-", no ? "Tomt " : "Plot ");
  const col = (label: string, value: string, sub: string) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 22, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 72 }}>{value}</div>
      <div style={{ fontSize: 20, opacity: 0.7 }}>{sub}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#17212a", color: "#f6f4ee", padding: 56, fontFamily: "Georgia, serif" }}>
        <div style={{ fontSize: 28, opacity: 0.8 }}>KNOTTEN · Sjøutsikt i Rødberg</div>
        <div style={{ fontSize: 96, marginTop: 12 }}>{name}</div>
        {p && (
          <div style={{ display: "flex", gap: 56, marginTop: 40 }}>
            {col(no ? "Sol 21. desember" : "Sun 21 December", `${p.sun.dec21.hours.toFixed(1)} h`, `${sunLabel(p.sun.dec21.first_sun_cet)} til ${sunLabel(p.sun.dec21.last_sun_cet)}`)}
            {col(no ? "Sjø i sikt" : "Water in view", `${p.view.water_visible_deg}°`, p.view.open_sea_visible ? (no ? "åpent hav" : "open sea") : "fjord")}
            {col(no ? "Høyde" : "Elevation", `${p.local.z_ground.toFixed(0)} m`, no ? "over havet" : "above sea level")}
          </div>
        )}
        <div style={{ marginTop: "auto", fontSize: 20, color: "#9fb3bf" }}>{`Kartverket DTM 1 m · NOAA · ${no ? "beregnet" : "computed"} 2026-09-05 · ${no ? "foreløpig utlegg" : "provisional layout"}`}</div>
      </div>
    ),
    size,
  );
}
