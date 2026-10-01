import { headers } from "next/headers";

/**
 * Outgoing email, used only when an email service is set up: RESEND_API_KEY and MAIL_FROM
 * (for example "Knotten <post@knotten.no>"). Without it the portal shows invitation and
 * password links to the administrator, who passes them on; nothing is lost either way.
 */
export const MAIL_ON = !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function sendMail(to: string, subject: string, text: string) {
  if (!MAIL_ON) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The site's own address, for links in invitations: SITE_URL when set, else the address of this request. */
export async function siteOrigin() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
