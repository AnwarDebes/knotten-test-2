/**
 * The screens in the house, drawn on one canvas (an atlas the 3D samples): the energy screen in the
 * living room (the energy display for residents, one of the project's measures), the heat pump's and
 * the inverter's displays, the electricity meter and the thermostat. They show the visited house's own
 * figures from the energy simulation at the hour the visitor has chosen.
 *
 * Atlas (UV origin at the bottom left): energy screen top half; heat pump bottom-left of the middle
 * quarter, inverter bottom-right of it; meter and thermostat in the lowest quarter.
 */
import * as THREE from "three";
import type { LiveFigures } from "./walkState";

export type Screen = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture };

export function makeScreen(): Screen {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx, texture };
}

const n1 = (v: number, no: boolean) => (Math.abs(v) < 10 ? v.toFixed(1) : v.toFixed(0)).replace(".", no ? "," : ".");
const MONTHS = { no: ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };

export function drawScreens(s: Screen, f: LiveFigures | null, locale: "no" | "en", plotNo: number) {
  const g = s.ctx, no = locale === "no";
  g.save();
  // ---------------- the energy screen (1024 x 512, top half of the canvas)
  g.fillStyle = "#0e151c"; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#e9eef2"; g.font = "600 34px system-ui, sans-serif";
  g.fillText(no ? `Hus ${plotNo} · energi nå` : `House ${plotNo} · energy now`, 36, 58);
  g.font = "400 26px system-ui, sans-serif"; g.fillStyle = "#8fa3b3";
  if (f) g.fillText(`${String(f.hour).padStart(2, "0")}:00 · ${f.day}. ${MONTHS[locale][f.month - 1]} · ${n1(f.temp, no)} °C · ${n1(f.price, no)} kr/kWh`, 36, 100);
  const tile = (x: number, y: number, label: string, value: string, unit: string, col: string) => {
    g.fillStyle = "#162330"; g.beginPath(); g.roundRect(x, y, 300, 160, 18); g.fill();
    g.fillStyle = "#8fa3b3"; g.font = "500 24px system-ui, sans-serif"; g.fillText(label, x + 22, y + 40);
    g.fillStyle = col; g.font = "700 64px system-ui, sans-serif"; g.fillText(value, x + 22, y + 118);
    const w = g.measureText(value).width;
    g.fillStyle = "#c9d6df"; g.font = "500 28px system-ui, sans-serif"; g.fillText(unit, x + 32 + w, y + 118);
  };
  if (f) {
    tile(36, 128, no ? "Sol på taket" : "Solar on the roof", n1(f.pv, no), "kW", "#f2b84b");
    tile(362, 128, no ? "Huset bruker" : "The house uses", n1(f.use, no), "kW", "#e9eef2");
    tile(688, 128, no ? "Batteri" : "Battery", String(Math.round(f.soc * 100)), "%", "#5fd18b");
    tile(36, 310, no ? "Varmepumpe" : "Heat pump", n1(f.hp, no), "kW", "#9fc7e8");
    const gridLabel = f.offline ? (no ? "Nettet er borte" : "Grid is down") : f.grid >= 0 ? (no ? "Kjøpt fra nettet" : "Bought from the grid") : (no ? "Solgt til nettet" : "Sold to the grid");
    tile(362, 310, gridLabel, n1(Math.abs(f.grid), no), "kW", f.grid >= 0 ? "#8fb4ff" : "#f2b84b");
    const shareLabel = f.share >= 0 ? (no ? "Fra naboene" : "From neighbours") : (no ? "Til naboene" : "To neighbours");
    tile(688, 310, shareLabel, n1(Math.abs(f.share), no), "kW", "#f2b84b");
    // the battery's bar along the bottom
    g.fillStyle = "#162330"; g.fillRect(36, 486, 952, 10);
    g.fillStyle = "#5fd18b"; g.fillRect(36, 486, 952 * Math.max(0, Math.min(1, f.soc)), 10);
  } else {
    g.fillStyle = "#8fa3b3"; g.font = "400 30px system-ui, sans-serif";
    g.fillText(no ? "Venter på simuleringen ..." : "Waiting for the simulation ...", 36, 260);
  }
  // ---------------- the heat pump's display (512 x 256 at y 512)
  g.fillStyle = "#0b1116"; g.fillRect(0, 512, 512, 256);
  g.fillStyle = "#7fb8e8"; g.font = "600 30px system-ui, sans-serif"; g.fillText(no ? "Varmepumpe" : "Heat pump", 22, 556);
  g.fillStyle = "#e6edf2"; g.font = "700 64px system-ui, sans-serif";
  g.fillText(f ? `${n1(f.hp, no)} kW` : "--", 22, 640);
  g.font = "500 26px system-ui, sans-serif"; g.fillStyle = "#9fb0bd";
  g.fillText(f ? `${no ? "Ute" : "Out"} ${n1(f.temp, no)} °C   COP ${n1(f.cop, no)}` : "", 22, 700);
  g.fillText(no ? "Varmtvann 55 °C   Gulvvarme" : "Hot water 55 °C   Floor heating", 22, 740);
  // ---------------- the inverter's display (512 x 256 at x 512, y 512)
  g.fillStyle = "#0b1116"; g.fillRect(512, 512, 512, 256);
  g.fillStyle = "#f2b84b"; g.font = "600 30px system-ui, sans-serif"; g.fillText(no ? "Solcelle og batteri" : "Solar and battery", 534, 556);
  g.fillStyle = "#e6edf2"; g.font = "700 64px system-ui, sans-serif"; g.fillText(f ? `${n1(f.pv, no)} kW` : "--", 534, 640);
  g.font = "500 26px system-ui, sans-serif"; g.fillStyle = "#9fb0bd";
  g.fillText(f ? `${no ? "Batteri" : "Battery"} ${Math.round(f.soc * 100)} % · ${n1(f.batteryKwh, no)} kWh` : "", 534, 700);
  g.fillText(f ? `${n1(f.kwp, no)} kWp ${no ? "på taket" : "on the roof"}` : "", 534, 740);
  // ---------------- the electricity meter (512 x 256 at y 768): an LCD with the reading
  g.fillStyle = "#a6b39a"; g.fillRect(0, 768, 512, 256);
  g.fillStyle = "#1c241a"; g.font = "700 76px ui-monospace, monospace";
  const reading = f ? Math.round(f.yearUse * 0.73) : 0;
  g.fillText(String(reading).padStart(6, "0"), 30, 900);
  g.font = "600 34px ui-monospace, monospace"; g.fillText("kWh  HAN", 340, 960);
  // ---------------- the thermostat (256 x 256 at x 512, y 768)
  g.fillStyle = "#f4f4f2"; g.fillRect(512, 768, 256, 256);
  g.fillStyle = "#2b3640"; g.font = "600 92px system-ui, sans-serif"; g.fillText(no ? "21,5" : "21.5", 530, 930);
  g.font = "500 40px system-ui, sans-serif"; g.fillText("°C", 680, 880);
  g.restore();
  s.texture.needsUpdate = true;
}
