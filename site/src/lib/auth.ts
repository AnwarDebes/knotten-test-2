import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authSecret, findById, loadAuth, type Account } from "./server/accounts";
import { hmac, safeEqual } from "./server/crypto";
import { AUTH_COOKIE, can, isAdmin, PREVIEWS, VIEW_COOKIE, WHO_COOKIE, type Area, type Role, type Session } from "./auth-shared";

/**
 * Sessions: after a correct password the server sets a signed, httpOnly cookie that scripts in
 * the page cannot read. It carries the account id, the account's session version and an expiry.
 * Every request checks the signature and looks the account up again, so a disabled account or a
 * changed password ends old sessions at once. A second, readable cookie only carries the name
 * for the header's greeting; it grants nothing.
 */
export { ROLES, ROLE_LABEL, AREAS, AREA_LABEL, can, isAdmin } from "./auth-shared";
export type { Role, Session, Area } from "./auth-shared";

export { AUTH_COOKIE };
const LEGACY_COOKIE = "knotten_session";
const SHORT = 12 * 3600;        // a normal login lasts a working day
const LONG = 30 * 24 * 3600;    // "remember me": thirty days

type Payload = { u: string; v: number; e: number };

async function sign(p: Payload) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${hmac(await authSecret(), body)}`;
}

async function verify(token: string | undefined): Promise<Payload | null> {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac || !safeEqual(mac, hmac(await authSecret(), body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as Payload;
    return typeof p.u === "string" && typeof p.v === "number" && p.e * 1000 > Date.now() ? p : null;
  } catch {
    return null;
  }
}

const toSession = (a: Account): Session => ({ id: a.id, email: a.email, name: a.name, role: a.role, areas: a.areas, plot: a.plot, org: a.org });

/** The person behind this request, ignoring any "view as" preview. Looked up once per request. */
export const getRealSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const p = await verify(jar.get(AUTH_COOKIE)?.value);
  if (!p) return null;
  const a = findById(await loadAuth(), p.u);
  if (!a || a.status !== "active" || a.sv !== p.v) return null;
  return toSession(a);
});

/**
 * The person behind this request as the portal should treat them. For an administrator who has
 * chosen "view as", that is the narrower access of the chosen person; nobody else is affected.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const real = await getRealSession();
  if (!real || !isAdmin(real)) return real;
  const raw = (await cookies()).get(VIEW_COOKIE)?.value;
  if (!raw) return real;
  try {
    const v = JSON.parse(raw) as { id?: string; plot?: string };
    const p = PREVIEWS.find((x) => x.id === v.id);
    if (!p) return real;
    const plot = p.id === "resident" && typeof v.plot === "string" && /^plot-\d{2}$/.test(v.plot) ? v.plot : undefined;
    return { ...real, role: "user", areas: [...p.areas], plot, preview: { id: p.id, realRole: real.role } };
  } catch {
    return real;
  }
});

export async function getRole(): Promise<Role> {
  return (await getSession())?.role ?? "public";
}

/** Set the cookies after a successful login (Server Functions only). */
export async function startSession(a: Account, remember: boolean) {
  const age = remember ? LONG : SHORT;
  const token = await sign({ u: a.id, v: a.sv, e: Math.floor(Date.now() / 1000) + age });
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(AUTH_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: age });
  jar.set(WHO_COOKIE, JSON.stringify({ name: a.name, role: a.role }), { httpOnly: false, sameSite: "lax", secure, path: "/", maxAge: age });
  jar.delete(LEGACY_COOKIE);
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  jar.delete(WHO_COOKIE);
  jar.delete(LEGACY_COOKIE);
}

/** The visitor's address, for counting failed logins. Only the first hop that the host adds. */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim().slice(0, 64);
}

/**
 * A same-site path to continue to after logging in; anything else, or a login page, falls back to the portal.
 * The path is parsed the way the browser will read it: a tab or a newline in "/\t/evil.example" is dropped
 * by the URL parser and leaves "//evil.example", another site, so control characters are refused outright
 * and only a path that stays on this site is kept.
 */
export function safeNext(next: string | null | undefined, locale: string) {
  const fallback = `/${locale}/portal`;
  const n = String(next ?? "");
  if (!n.startsWith("/") || n.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(n)) return fallback;
  const base = "https://knotten.invalid";
  let u: URL;
  try { u = new URL(n, base); } catch { return fallback; }
  if (u.origin !== base) return fallback;
  const path = u.pathname + u.search + u.hash;
  if (/^\/((no|en)\/login|logg-inn)(\/|\?|#|$)/.test(path)) return fallback;
  return path;
}

/**
 * For portal pages and their actions: the session, or a redirect to the login page (with the way
 * back). When `area` is given and the person may not open it, the result is null and the page
 * shows "no access" instead.
 */
export async function requireSession(locale: string, here: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/${locale}/login?next=${encodeURIComponent(here)}`);
  return s;
}

export async function requireArea(locale: string, here: string, area: Area | "admin" | "superadmin"): Promise<{ session: Session; ok: boolean }> {
  const session = await requireSession(locale, here);
  return { session, ok: can(session, area) };
}

/** For Server Actions: the acting session, or an error when it lacks the right. */
export async function actor(area: Area | "admin" | "superadmin" | "any" = "admin"): Promise<Session> {
  const s = await getSession();
  // a preview is for looking: nothing is changed in someone else's name
  if (s?.preview) throw new Error("preview");
  if (!s || (area !== "any" && !can(s, area))) throw new Error("forbidden");
  return s;
}
