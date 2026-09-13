import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { newId, updateStore } from "@/lib/store";

/**
 * Interest registration from the website form. The lead lands in the project's records with
 * status "new", where the administrator sees it on the admin overview. Production adds the
 * double opt-in email and the admin notification (specs/04, specs/09).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!body.consent_updates) return NextResponse.json({ error: "consent_required" }, { status: 400 });
  const purpose = ["buy", "invest", "partner", "curious"].includes(body.purpose) ? body.purpose : "curious";
  await updateStore("web", `new lead ${String(body.email).slice(0, 60)}`, (s) => {
    s.leads.push({
      id: newId("lead"),
      name: String(body.name ?? "").slice(0, 120),
      email: String(body.email).slice(0, 200),
      phone: String(body.phone ?? "").slice(0, 40),
      purpose,
      plots: Array.isArray(body.plots) ? body.plots.filter((p: unknown) => typeof p === "string").slice(0, 10) : [],
      consent_updates: !!body.consent_updates,
      consent_investor: !!body.consent_investor,
      consent_research: !!body.consent_research,
      source: String(body.source ?? "web").slice(0, 60),
      created: new Date().toISOString(),
      status: "new",
      notes: [],
    });
  });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
