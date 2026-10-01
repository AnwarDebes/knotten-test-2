"use server";
import { redirect } from "next/navigation";
import { clientIp, endSession, getSession, safeNext, startSession } from "@/lib/auth";
import { AREAS } from "@/lib/auth-shared";
import {
  audit, changeAuth, clearFailures, findByEmail, findById, issueLink, loadAuth, lockedMinutes, needsSetup,
  newAccountId, recordFailure, redeemLink, setupCode,
} from "@/lib/server/accounts";
import { hashPassword, passwordProblem, safeEqual, verifyPassword } from "@/lib/server/crypto";
import { MAIL_ON, sendMail, siteOrigin } from "@/lib/server/mail";
import { recordEvent } from "@/lib/server/stats";

/**
 * Sign-in for the portal, shared by both designs. Every form posts here; the answers are the same
 * whether an address exists or not, failed attempts are counted per address and per network, and
 * passwords never leave this file except as scrypt hashes.
 */
export type FormState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
const lang = (fd: FormData) => (fd.get("lang") === "en" ? "en" : "no") as "no" | "en";
const T = {
  no: {
    missing: "Skriv inn e-post og passord.",
    wrong: "Feil e-post eller passord.",
    locked: (m: number) => `For mange mislykkede forsøk. Prøv igjen om ${m} ${m === 1 ? "minutt" : "minutter"}.`,
    done: "Oppsettet er allerede gjort. Logg inn som vanlig.",
    badCode: "Feil oppsettskode.",
    name: "Skriv inn navnet ditt.",
    email: "Skriv inn en gyldig e-postadresse.",
    mismatch: "Passordene er ikke like.",
    badLink: "Lenken er ugyldig eller utløpt. Be administratoren om en ny.",
    resetSent: "Takk. Hvis adressen har tilgang til portalen, får administratoren beskjed og sender deg en lenke for nytt passord.",
    resetMailed: "Takk. Hvis adressen har tilgang til portalen, kommer en lenke for nytt passord på e-post i løpet av noen minutter.",
    wrongCurrent: "Nåværende passord stemmer ikke.",
    changed: "Passordet er endret. Andre innlogginger er logget ut.",
    saved: "Lagret.",
  },
  en: {
    missing: "Enter your email and password.",
    wrong: "Wrong email or password.",
    locked: (m: number) => `Too many failed attempts. Try again in ${m} ${m === 1 ? "minute" : "minutes"}.`,
    done: "The setup is already done. Log in as usual.",
    badCode: "Wrong setup code.",
    name: "Enter your name.",
    email: "Enter a valid email address.",
    mismatch: "The passwords do not match.",
    badLink: "The link is invalid or has expired. Ask the administrator for a new one.",
    resetSent: "Thank you. If the address has access to the portal, the administrator is told and sends you a link for a new password.",
    resetMailed: "Thank you. If the address has access to the portal, a link for a new password arrives by email within a few minutes.",
    wrongCurrent: "The current password is not correct.",
    changed: "The password is changed. Other sessions have been logged out.",
    saved: "Saved.",
  },
};
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const t = T[lang(fd)];
  const locale = str(fd, "locale") === "en" ? "en" : "no";
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: t.missing };
  const ip = await clientIp();
  const wait = await lockedMinutes(email, ip);
  if (wait > 0) return { error: t.locked(wait) };
  const a = findByEmail(await loadAuth(), email);
  const ok = await verifyPassword(password, a?.status === "active" ? a.password : undefined);
  if (!ok || !a || a.status !== "active") {
    await recordFailure(email, ip);
    await changeAuth((s) => audit(s, email, "mislykket innlogging"));
    return { error: t.wrong };
  }
  await clearFailures(email, ip);
  const fresh = await changeAuth((s) => {
    const x = findById(s, a.id)!;
    x.last_login = new Date().toISOString();
    x.logins = (x.logins ?? 0) + 1;
    audit(s, x.email, "logget inn");
    return { ...x };
  });
  await startSession(fresh, fd.get("remember") === "on");
  await recordEvent("login");
  redirect(safeNext(str(fd, "next", 300), locale));
}

export async function logout(fd: FormData) {
  const s = await getSession();
  if (s) await changeAuth((st) => audit(st, s.email, "logget ut"));
  await endSession();
  redirect(safeNext(str(fd, "to", 300) || "/", "no"));
}

export async function logoutEverywhere(fd: FormData) {
  const s = await getSession();
  if (s) await changeAuth((st) => { const a = findById(st, s.id); if (a) { a.sv += 1; audit(st, a.email, "logget ut på alle enheter"); } });
  await endSession();
  redirect(safeNext(str(fd, "to", 300) || "/no/login", "no"));
}

/** First-time setup: the super administrator chooses a password, proven by the setup code. */
export async function setup(_: FormState, fd: FormData): Promise<FormState> {
  const t = T[lang(fd)];
  const locale = str(fd, "locale") === "en" ? "en" : "no";
  if (!(await needsSetup())) return { error: t.done };
  const ip = await clientIp();
  const wait = await lockedMinutes("setup", ip);
  if (wait > 0) return { error: t.locked(wait) };
  // the code may be typed with or without the dash, in any case
  const plain = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!safeEqual(plain(str(fd, "code", 40)), plain(await setupCode()))) {
    await recordFailure("setup", ip);
    return { error: t.badCode };
  }
  const name = str(fd, "name", 80), email = str(fd, "email").toLowerCase(), pw = String(fd.get("password") ?? ""), pw2 = String(fd.get("confirm") ?? "");
  if (!name) return { error: t.name };
  if (!EMAIL.test(email)) return { error: t.email };
  const problem = passwordProblem(pw, email, lang(fd));
  if (problem) return { error: problem };
  if (pw !== pw2) return { error: t.mismatch };
  const hash = await hashPassword(pw);
  const account = await changeAuth((s) => {
    let a = findByEmail(s, email) ?? s.accounts.find((x) => x.role === "superadmin" && !x.password);
    if (!a) {
      a = { id: newAccountId(), email, name, role: "superadmin", areas: [...AREAS], status: "active", created: new Date().toISOString(), logins: 0, sv: 1 };
      s.accounts.push(a);
    }
    Object.assign(a, { email, name, role: "superadmin", areas: [...AREAS], password: hash, status: "active", sv: a.sv + 1, last_login: new Date().toISOString(), logins: (a.logins ?? 0) + 1 });
    s.setup_code = undefined;
    audit(s, email, "første oppsett: superadministrator opprettet");
    return { ...a };
  });
  await clearFailures("setup", ip);
  await startSession(account, false);
  redirect(`/${locale}/portal`);
}

/** Choose a password from an invitation or a reset link. */
export async function choosePassword(_: FormState, fd: FormData): Promise<FormState> {
  const t = T[lang(fd)];
  const locale = str(fd, "locale") === "en" ? "en" : "no";
  const token = str(fd, "token", 200), pw = String(fd.get("password") ?? ""), pw2 = String(fd.get("confirm") ?? "");
  const problem = passwordProblem(pw, str(fd, "email"), lang(fd));
  if (problem) return { error: problem };
  if (pw !== pw2) return { error: t.mismatch };
  const a = await redeemLink(token, pw);
  if (!a) return { error: t.badLink };
  await startSession(a, false);
  await recordEvent("login");
  redirect(`/${locale}/portal`);
}

/** "Forgot password": always the same answer; the administrators see the request, or the link is emailed. */
export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const t = T[lang(fd)];
  const email = str(fd, "email").toLowerCase();
  if (!EMAIL.test(email)) return { error: t.email };
  const ip = await clientIp();
  if ((await lockedMinutes(`reset:${email}`, ip)) > 0) return { ok: MAIL_ON ? t.resetMailed : t.resetSent };
  await recordFailure(`reset:${email}`, ip);   // counts requests so the form cannot be used to flood anyone
  const a = findByEmail(await loadAuth(), email);
  if (a && a.status === "active") {
    if (MAIL_ON) {
      const { token } = await issueLink(a.id, "reset", "glemt passord");
      const url = `${await siteOrigin()}/${str(fd, "locale") === "en" ? "en" : "no"}/login/passord?token=${token}`;
      if (lang(fd) === "en") await sendMail(a.email, "New password for the Knotten portal", `Hi ${a.name},\n\nSomeone (hopefully you) asked for a new password for the Knotten portal. The link below lasts 24 hours:\n\n${url}\n\nIf it was not you, you can ignore this email.\n`);
      else await sendMail(a.email, "Nytt passord til Knotten-portalen", `Hei ${a.name},\n\nNoen (forhåpentlig du) ba om nytt passord til portalen for Knotten. Lenken under gjelder i 24 timer:\n\n${url}\n\nHvis det ikke var deg, kan du se bort fra denne e-posten.\n`);
    } else {
      await changeAuth((s) => {
        s.reset_requests = [{ at: new Date().toISOString(), email }, ...s.reset_requests.filter((r) => r.email !== email)].slice(0, 50);
        audit(s, email, "ba om nytt passord");
      });
    }
  }
  return { ok: MAIL_ON ? t.resetMailed : t.resetSent };
}

/** Signed in: change the password (the current one is required); other sessions end. */
export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const t = T[lang(fd)];
  const s = await getSession();
  if (!s) return { error: t.wrong };
  const a = findById(await loadAuth(), s.id);
  if (!a || !(await verifyPassword(String(fd.get("current") ?? ""), a.password))) return { error: t.wrongCurrent };
  const pw = String(fd.get("password") ?? ""), pw2 = String(fd.get("confirm") ?? "");
  const problem = passwordProblem(pw, a.email, lang(fd));
  if (problem) return { error: problem };
  if (pw !== pw2) return { error: t.mismatch };
  const hash = await hashPassword(pw);
  const fresh = await changeAuth((st) => {
    const x = findById(st, s.id)!;
    x.password = hash;
    x.sv += 1;
    audit(st, x.email, "endret passord");
    return { ...x };
  });
  await startSession(fresh, false);
  return { ok: t.changed };
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const t = T[lang(fd)];
  const s = await getSession();
  if (!s) return { error: t.wrong };
  const name = str(fd, "name", 80);
  if (!name) return { error: t.name };
  const fresh = await changeAuth((st) => { const x = findById(st, s.id)!; x.name = name; x.org = str(fd, "org", 120) || undefined; return { ...x }; });
  await startSession(fresh, false);
  return { ok: t.saved };
}
