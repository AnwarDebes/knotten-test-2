/**
 * Roles and portal areas, shared by server and browser code (no Node imports here).
 *
 * Three roles, as the project owner asked for: user, admin and superadmin. A user opens the portal
 * areas an administrator has given them (an investor gets the data room, the municipality gets its
 * report packs, a resident gets their home). Administrators open every area and run the CRM;
 * super administrators also manage administrators and the security settings.
 */
export const ROLES = ["public", "user", "admin", "superadmin"] as const;
export type Role = (typeof ROLES)[number];
export type AccountRole = Exclude<Role, "public">;

export const AREAS = ["investor", "resident", "energy", "project", "municipality", "research"] as const;
export type Area = (typeof AREAS)[number];

/**
 * What the server knows about the person behind a valid session. `preview` is set while an
 * administrator looks at the portal as someone else (an investor, the municipality); the session
 * then carries only that person's access, and changes are switched off.
 */
export type Session = { id: string; email: string; name: string; role: AccountRole; areas: Area[]; plot?: string; org?: string; preview?: { id: string; realRole: AccountRole } };

/** The signed, httpOnly session cookie (set and checked in lib/auth.ts). */
export const AUTH_COOKIE = "knotten_auth";
/** An administrator's "view as" choice. It can only narrow access, never widen it. */
export const VIEW_COOKIE = "knotten_view";

/** The "view as" choices an administrator can preview the portal with. */
export const PREVIEWS = [
  { id: "investor", areas: ["investor"], label: { no: "Investor", en: "Investor" }, as: { no: "en investor", en: "an investor" }, path: "/investor" },
  { id: "municipality", areas: ["municipality"], label: { no: "Lindesnes kommune", en: "Lindesnes municipality" }, as: { no: "Lindesnes kommune", en: "Lindesnes municipality" }, path: "/municipality" },
  { id: "research", areas: ["research"], label: { no: "Forsker ved UiA", en: "Researcher at UiA" }, as: { no: "en forsker ved UiA", en: "a researcher at UiA" }, path: "/research" },
  { id: "project", areas: ["project", "energy"], label: { no: "Prosjektgruppen", en: "The project group" }, as: { no: "prosjektgruppen", en: "the project group" }, path: "/project" },
  { id: "resident", areas: ["resident"], label: { no: "Beboer", en: "Resident" }, as: { no: "en beboer", en: "a resident" }, path: "/resident" },
] as const satisfies readonly { id: string; areas: readonly Area[]; label: { no: string; en: string }; as: { no: string; en: string }; path: string }[];

/** The readable cookie the header uses to greet the person. It decides nothing; access is checked on the server. */
export const WHO_COOKIE = "knotten_who";
export type Who = { name: string; role: AccountRole };

export function parseWho(raw: string | undefined): Who | null {
  if (!raw) return null;
  try {
    const w = JSON.parse(decodeURIComponent(raw)) as Partial<Who>;
    if (w.role !== "user" && w.role !== "admin" && w.role !== "superadmin") return null;
    return { role: w.role, name: String(w.name ?? "").slice(0, 80) };
  } catch {
    return null;
  }
}

export const isAdmin = (s: Pick<Session, "role"> | null | undefined) => s?.role === "admin" || s?.role === "superadmin";

/** Can this session open the area? Administrators open everything; a user opens the areas given to them. */
export function can(s: Pick<Session, "role" | "areas"> | null | undefined, area: Area | "admin" | "superadmin") {
  if (!s) return false;
  if (area === "superadmin") return s.role === "superadmin";
  if (area === "admin") return isAdmin(s);
  return isAdmin(s) || s.areas.includes(area);
}

export const ROLE_LABEL: Record<Role, { no: string; en: string }> = {
  public: { no: "Besøkende", en: "Visitor" },
  user: { no: "Bruker", en: "User" },
  admin: { no: "Administrator", en: "Administrator" },
  superadmin: { no: "Superadministrator", en: "Super administrator" },
};

export const AREA_LABEL: Record<Area, { no: string; en: string; hint: { no: string; en: string } }> = {
  investor: { no: "Datarom", en: "Data room", hint: { no: "Investordokumenter, scenarioer, spørsmål og svar", en: "Investor documents, scenarios, questions and answers" } },
  resident: { no: "Mitt hjem", en: "My home", hint: { no: "Egen tomt, egne dokumenter, samtykker og henvendelser", en: "Own plot, own documents, consents and requests" } },
  energy: { no: "Energi", en: "Energy", hint: { no: "Energidashbord, optimalisering, deling og tvillingen", en: "Energy dashboard, optimisation, sharing and the twin" } },
  project: { no: "Prosjektrom", en: "Project room", hint: { no: "Oppgaver, beslutninger, milepæler og prosjektdokumenter", en: "Tasks, decisions, milestones and project documents" } },
  municipality: { no: "Kommune", en: "Municipality", hint: { no: "Reguleringsgrunnlag og rapportpakker til Lindesnes kommune", en: "Regulation basis and report packs for Lindesnes municipality" } },
  research: { no: "Forskning", en: "Research", hint: { no: "Datasett med lisens og skjema for UiA", en: "Datasets with licence and schema for UiA" } },
};
