import { cache } from "react";
import { mutate, readJSON } from "./kv";
import { hashPassword, humanCode, randomToken, sha256 } from "./crypto";
import { AREAS, type AccountRole, type Area } from "@/lib/auth-shared";
import { CONTACT } from "@/lib/facts";

/**
 * Accounts for the portal: who can log in, with what role and which areas. Kept apart from the
 * CRM records (and out of git): this is the only place password hashes and link tokens live.
 */
export type Account = {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  areas: Area[];
  /** For residents: the plot that is their home, `plot-NN`. */
  plot?: string;
  /** Company, municipality or institution, for the overview. */
  org?: string;
  status: "invited" | "active" | "disabled";
  password?: string;
  created: string;
  created_by?: string;
  last_login?: string;
  logins: number;
  /** Raised when the password changes or someone logs out everywhere; older sessions stop working. */
  sv: number;
};
export type LinkToken = { hash: string; uid: string; kind: "invite" | "reset"; expires: string; created: string; by: string };
export type AuditEntry = { at: string; who: string; what: string };
type Failures = Record<string, { n: number; first: string; until?: string }>;
type AuthState = {
  accounts: Account[];
  tokens: LinkToken[];
  secret: string;
  setup_code?: string;
  failures: Failures;
  audit: AuditEntry[];
  reset_requests: { at: string; email: string }[];
};

const KEY = "auth";
const now = () => new Date().toISOString();
export const newAccountId = () => `u-${Date.now().toString(36)}${randomToken(4).slice(0, 5).toLowerCase()}`;

function seed(): AuthState {
  return {
    accounts: [
      // the project owner, waiting for the first-time setup to choose a password
      { id: "u-owner", email: CONTACT.email.toLowerCase(), name: CONTACT.name, role: "superadmin", areas: [...AREAS], org: CONTACT.company, status: "invited", created: now(), logins: 0, sv: 1 },
    ],
    tokens: [],
    secret: randomToken(48),
    failures: {},
    audit: [],
    reset_requests: [],
  };
}

export const loadAuth = cache(async (): Promise<AuthState> => {
  const s = await readJSON<AuthState>(KEY);
  if (s) return s;
  return mutate<AuthState, AuthState>(KEY, seed, (v) => v);
});

export const changeAuth = <R>(fn: (s: AuthState) => R | Promise<R>) => mutate<AuthState, R>(KEY, seed, fn);

export const findByEmail = (s: AuthState, email: string) => s.accounts.find((a) => a.email === email.trim().toLowerCase());
export const findById = (s: AuthState, id: string) => s.accounts.find((a) => a.id === id);

/** The secret that signs sessions: AUTH_SECRET when set (recommended in production), else one kept with the accounts. */
export async function authSecret() {
  const env = process.env.AUTH_SECRET;
  if (env && env.length >= 32) return env;
  return (await loadAuth()).secret;
}

/** True until a super administrator with a password exists. */
export async function needsSetup() {
  const s = await loadAuth();
  return !s.accounts.some((a) => a.role === "superadmin" && a.status === "active" && a.password);
}

let announced = false;
/** The one-time code that proves the person doing the first-time setup can see the server. */
export async function setupCode() {
  const fromEnv = process.env.KNOTTEN_SETUP_CODE?.trim();
  if (fromEnv) return fromEnv;
  const code = await changeAuth((s) => (s.setup_code ??= humanCode()));
  if (!announced) {
    announced = true;
    console.warn(`\n[knotten] First-time setup: open /no/login and enter the setup code ${code}\n`);
  }
  return code;
}

export function audit(s: AuthState, who: string, what: string) {
  s.audit = [{ at: now(), who, what }, ...s.audit].slice(0, 500);
}

// ---------------------------------------------------------------- failed attempts
const WINDOW_MIN = 15;
const LIMIT = { email: 5, ip: 30 };

/** Minutes left before this email or address may try again (0 when free). */
export async function lockedMinutes(email: string, ip: string) {
  const s = await loadAuth();
  const t = Date.now();
  const left = [`e:${email}`, `i:${ip}`].map((k) => s.failures[k]?.until).filter(Boolean).map((u) => Date.parse(u!) - t);
  const max = Math.max(0, ...left);
  return Math.ceil(max / 60000);
}

export async function recordFailure(email: string, ip: string) {
  await changeAuth((s) => {
    const t = Date.now();
    for (const [k, limit] of [[`e:${email}`, LIMIT.email], [`i:${ip}`, LIMIT.ip]] as const) {
      const f = s.failures[k];
      const fresh = !f || t - Date.parse(f.first) > WINDOW_MIN * 60000;
      const n = fresh ? 1 : f.n + 1;
      s.failures[k] = { n, first: fresh ? new Date(t).toISOString() : f.first, until: n >= limit ? new Date(t + WINDOW_MIN * 60000).toISOString() : f?.until };
    }
    // forget old entries so the record stays small
    for (const [k, f] of Object.entries(s.failures)) if (t - Date.parse(f.first) > 24 * 3600e3 && (!f.until || Date.parse(f.until) < t)) delete s.failures[k];
  });
}

export async function clearFailures(email: string, ip: string) {
  await changeAuth((s) => { delete s.failures[`e:${email}`]; delete s.failures[`i:${ip}`]; });
}

// ---------------------------------------------------------------- links (invitation, new password)
/** Make a link token; only its hash is stored, the token itself is shown once. */
export async function issueLink(uid: string, kind: LinkToken["kind"], by: string) {
  const token = randomToken(32);
  const hours = kind === "invite" ? 24 * 7 : 24;
  await changeAuth((s) => {
    s.tokens = s.tokens.filter((t) => !(t.uid === uid && t.kind === kind) && Date.parse(t.expires) > Date.now());
    s.tokens.push({ hash: sha256(token), uid, kind, expires: new Date(Date.now() + hours * 3600e3).toISOString(), created: now(), by });
    const a = findById(s, uid);
    audit(s, by, `${kind === "invite" ? "invitasjon laget for" : "lenke for nytt passord laget for"} ${a?.email ?? uid}`);
  });
  return { token, hours };
}

/** Who a link belongs to, without using it up. */
export async function peekLink(token: string) {
  const s = await loadAuth();
  const t = s.tokens.find((x) => x.hash === sha256(token));
  if (!t || Date.parse(t.expires) < Date.now()) return null;
  const account = findById(s, t.uid);
  if (!account || account.status === "disabled") return null;
  return { account, kind: t.kind };
}

/** Use a link to set a password: the account becomes active and every older session ends. */
export async function redeemLink(token: string, password: string) {
  const hash = await hashPassword(password);
  return changeAuth((s) => {
    const t = s.tokens.find((x) => x.hash === sha256(token));
    if (!t || Date.parse(t.expires) < Date.now()) return null;
    const a = findById(s, t.uid);
    if (!a || a.status === "disabled") return null;
    a.password = hash;
    a.status = "active";
    a.sv += 1;
    a.last_login = now();
    a.logins = (a.logins ?? 0) + 1;
    s.tokens = s.tokens.filter((x) => x.uid !== a.id);
    s.reset_requests = s.reset_requests.filter((r) => r.email !== a.email);
    audit(s, a.email, t.kind === "invite" ? "tok imot invitasjonen og valgte passord" : "valgte nytt passord med lenke");
    return { ...a };
  });
}
