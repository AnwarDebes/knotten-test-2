import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { newId, readStore, updateStore, type Lead } from "@/lib/store";
import { allow } from "@/lib/server/limit";
import { recordEvent } from "@/lib/server/stats";
import { MAIL_ON, sendMail, siteOrigin } from "@/lib/server/mail";

const PURPOSES = ["buy", "invest", "partner", "curious"] as const;
const PURPOSE_NO: Record<Lead["purpose"], string> = { buy: "kjøpe bolig", invest: "investere", partner: "samarbeide", curious: "følge med" };

/**
 * Interest registration from the website forms (both designs). The lead lands in the project's
 * records with status "new", where the administrator sees it in the portal. A person who registers
 * again with the same email is updated, not counted twice. A hidden field catches simple robots,
 * and one address can send at most five registrations in ten minutes.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email.trim())) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!body.consent_updates) return NextResponse.json({ error: "consent_required" }, { status: 400 });
  // robots fill in every field, people never see this one: answer as usual, keep nothing
  if (String(body.website ?? "").trim()) return NextResponse.json({ ok: true });
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
  if (!(await allow("leads", ip, 5, 10))) return NextResponse.json({ error: "too_many" }, { status: 429 });

  const purpose: Lead["purpose"] = PURPOSES.includes(body.purpose) ? body.purpose : "curious";
  const email = body.email.trim().slice(0, 200);
  // the Klassisk form has a message box; it lands as a note on the lead
  const message = String(body.message ?? "").trim().slice(0, 2000);
  const plots: string[] = Array.isArray(body.plots) ? body.plots.filter((p: unknown) => typeof p === "string" && /^plot-\d{2}$/.test(p)).slice(0, 10) : [];
  const created = new Date().toISOString();
  const name = String(body.name ?? "").trim().slice(0, 120);

  const repeat = await updateStore("web", `${name || email} registrerte interesse`, (s) => {
    const known = s.leads.find((l) => l.email.toLowerCase() === email.toLowerCase() && l.source !== "eksempel");
    if (known) {
      known.plots = [...new Set([...known.plots, ...plots])];
      known.consent_investor ||= !!body.consent_investor;
      known.consent_research ||= !!body.consent_research;
      if (!known.name && name) known.name = name;
      if (!known.phone && body.phone) known.phone = String(body.phone).slice(0, 40);
      known.notes.push({ at: created, by: "Nettsiden", text: [`Registrerte seg på nytt (${PURPOSE_NO[purpose]}).`, message].filter(Boolean).join("\n") });
      return true;
    }
    s.leads.push({
      id: newId("lead"),
      name,
      email,
      phone: String(body.phone ?? "").trim().slice(0, 40),
      purpose,
      plots,
      consent_updates: true,
      consent_investor: !!body.consent_investor,
      consent_research: !!body.consent_research,
      source: String(body.source ?? "web").slice(0, 60),
      created,
      status: "new",
      notes: message ? [{ at: created, by: "Nettsiden", text: message }] : [],
    });
    return false;
  });

  await recordEvent(repeat ? "lead_repeat" : "lead");
  if (!repeat) await recordEvent(`lead_${purpose}`);
  revalidatePath("/", "layout");

  // tell the project owner, after the answer has gone back to the visitor
  if (MAIL_ON && !repeat) {
    const origin = await siteOrigin();
    after(async () => {
      const { settings } = await readStore();
      await sendMail(
        settings.contact_email,
        `Ny interessent: ${name || email}`,
        `${name || "(uten navn)"} <${email}> vil ${PURPOSE_NO[purpose]}.${plots.length ? `\nTomter: ${plots.join(", ")}` : ""}${message ? `\n\n${message}` : ""}\n\nSvar og sett status i portalen:\n${origin}/no/portal/admin/interessenter?status=new`,
      );
    });
  }
  return NextResponse.json({ ok: true });
}
