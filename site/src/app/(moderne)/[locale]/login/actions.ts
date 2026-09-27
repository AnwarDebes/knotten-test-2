"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLES, SESSION_COOKIE, type Role } from "@/lib/auth-shared";

/** Preview sign-in: no password check, the chosen role and name go into a readable cookie. */
export async function signIn(formData: FormData) {
  const role = String(formData.get("role") ?? "user") as Role;
  const locale = String(formData.get("locale") ?? "no");
  const email = String(formData.get("email") ?? "").slice(0, 120);
  const nameFromEmail = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  const name = String(formData.get("name") ?? nameFromEmail ?? "").slice(0, 80);
  if (!ROLES.includes(role) || role === "public") redirect(`/${locale}/login`);
  const c = await cookies();
  // Next encodes the value once itself; the client decodes once (see lib/auth-shared parseSession)
  c.set(SESSION_COOKIE, JSON.stringify({ role, name, email }), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 7, httpOnly: false });
  redirect(`/${locale}/portal`);
}

export async function signOut(formData: FormData) {
  const locale = String(formData.get("locale") ?? "no");
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  redirect(`/${locale}`);
}
