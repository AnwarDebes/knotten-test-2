import { NextResponse } from "next/server";
import { answer, redact } from "@/lib/server/assistant";
import { allow } from "@/lib/server/limit";
import { recordEvent } from "@/lib/server/stats";
import { mutate } from "@/lib/server/kv";

/**
 * Questions to Knotten AI. Answers come from the project's own data (lib/server/assistant.ts).
 * What is kept: a count per topic, and the questions that got no answer, with email addresses
 * and numbers removed, so the owner can see what visitors want to know. Nothing about the asker.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { q?: unknown; locale?: unknown } | null;
  const q = typeof body?.q === "string" ? body.q.trim().slice(0, 500) : "";
  const lang = body?.locale === "en" ? "en" : "no";
  if (!q) return NextResponse.json({ error: "empty" }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
  if (!(await allow("ask", ip, 30, 10))) {
    return NextResponse.json({ text: lang === "no" ? "Du har spurt mye på kort tid. Vent litt og prøv igjen." : "You have asked a lot in a short time. Wait a little and try again.", links: [], source: "none", intent: "limit" });
  }
  const a = await answer(q, lang);
  await recordEvent("ask");
  await recordEvent(`ask_${a.intent}`);
  if (a.source !== "data") {
    await mutate<{ asked: { at: string; q: string; lang: string; source: string }[] }, void>("asked", () => ({ asked: [] }), (v) => {
      v.asked = [{ at: new Date().toISOString(), q: redact(q), lang, source: a.source }, ...v.asked].slice(0, 200);
    }).catch(() => undefined);
  }
  return NextResponse.json(a);
}
