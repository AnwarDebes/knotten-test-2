import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE, type Role, type Session } from "./auth-shared";

/**
 * Preview auth. Three roles, as Sigve asked for: user, admin, superadmin (plus the anonymous
 * visitor). The session lives in a readable cookie so the navigation can show who is logged in
 * without turning every page dynamic. Production swaps this for Supabase Auth with the same
 * role names (see specs/10).
 */
export { ROLES, ROLE_LABEL, allowed, parseSession, SESSION_COOKIE } from "./auth-shared";
export type { Role, Session } from "./auth-shared";

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return parseSession(c.get(SESSION_COOKIE)?.value);
}

export async function getRole(): Promise<Role> {
  return (await getSession())?.role ?? "public";
}
