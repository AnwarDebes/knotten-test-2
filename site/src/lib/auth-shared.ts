/** Role model shared by server and client. No Node imports here. */
export const ROLES = ["public", "user", "admin", "superadmin"] as const;
export type Role = (typeof ROLES)[number];
export type Session = { role: Role; name: string; email: string };

export const SESSION_COOKIE = "knotten_session";

export function parseSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(decodeURIComponent(raw)) as Partial<Session>;
    if (!s.role || !ROLES.includes(s.role) || s.role === "public") return null;
    return { role: s.role, name: String(s.name ?? "").slice(0, 80), email: String(s.email ?? "").slice(0, 120) };
  } catch {
    return null;
  }
}

/**
 * Access rules for the skeleton: admins see everything; a user sees every area that is not
 * admin-only. `need` keeps the portal's area names (investor, resident, ...) so the pages read well.
 */
export function allowed(role: Role, ...need: string[]) {
  if (role === "admin" || role === "superadmin") return true;
  if (role === "user") return need.length > 0 && !need.includes("admin");
  return false;
}

export const ROLE_LABEL: Record<Role, { no: string; en: string }> = {
  public: { no: "Besøkende", en: "Visitor" },
  user: { no: "Bruker", en: "User" },
  admin: { no: "Administrator", en: "Administrator" },
  superadmin: { no: "Superadministrator", en: "Super administrator" },
};
