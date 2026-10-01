import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import { buildDigest } from "@/lib/server/digest";
import { MAIL_ON, sendMail } from "@/lib/server/mail";
import { safeEqual } from "@/lib/server/crypto";

/**
 * The weekly summary, sent by Vercel Cron on Monday mornings (vercel.json). Vercel sends the
 * CRON_SECRET as a bearer token; without that secret nobody can trigger a mail from outside.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { settings } = await readStore();
  if (!settings.weekly_digest) return NextResponse.json({ sent: false, reason: "switched off in the settings" });
  if (!MAIL_ON) return NextResponse.json({ sent: false, reason: "email is not set up (RESEND_API_KEY, MAIL_FROM)" });
  const digest = await buildDigest(settings.digest_lang ?? "no");
  const sent = await sendMail(settings.contact_email, digest.subject, digest.text);
  return NextResponse.json({ sent, to: settings.contact_email });
}
