import { NextResponse } from "next/server";
import { loadPlots } from "@/lib/data";
import { frameFor } from "@/lib/energy";

/**
 * One energy frame for the digital twin: every home's solar, use, battery and sharing at a
 * moment (Norwegian time). Today the source is the model; live meters will answer in the same
 * shape with source "live". Example: /api/energy/frame?ts=2026-12-21T12:00
 */
export async function GET(req: Request) {
  const ts = new URL(req.url).searchParams.get("ts") ?? "";
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return NextResponse.json({ error: "ts must look like 2026-12-21T12:00 (Norwegian time)" }, { status: 400 });
  const month = Number(m[2]), day = Number(m[3]), hour = Number(m[4] ?? 12) + Number(m[5] ?? 0) / 60;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour >= 24) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  const { plots } = await loadPlots();
  return NextResponse.json(frameFor(plots, month, day, hour), { headers: { "Cache-Control": "public, max-age=3600" } });
}
