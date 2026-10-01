import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "crypto";

/**
 * Passwords are stored as scrypt hashes (Node's built-in implementation): a random salt per
 * password and a cost that makes guessing slow. Format: s1$N$r$p$salt$hash, base64url parts.
 */
const N = 16384, R = 8, P = 1, KEYLEN = 64;

function scryptAsync(password: string, salt: Buffer, keylen: number, opts: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["s1", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string | undefined) {
  // a missing account still pays for one hash, so the answer takes as long either way
  const parts = (stored ?? "").split("$");
  const valid = parts.length === 6 && parts[0] === "s1";
  const [n, r, p] = valid ? parts.slice(1, 4).map(Number) : [N, R, P];
  const salt = valid ? Buffer.from(parts[4], "base64url") : randomBytes(16);
  const expected = valid ? Buffer.from(parts[5], "base64url") : randomBytes(KEYLEN);
  const key = await scryptAsync(password.normalize("NFKC"), salt, expected.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  return valid && key.length === expected.length && timingSafeEqual(key, expected);
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("base64url");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A short code people can type: 4+4 characters without look-alikes (no 0/O, 1/I/L). */
export function humanCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const b = randomBytes(8);
  const chars = Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Password rules: long rather than complicated, and not one of the passwords everyone tries first. */
const COMMON = new Set(["passord123", "password123", "1234567890", "qwertyuiop", "knotten123", "sommer2026", "vinter2026", "lindesnes1"]);
export function passwordProblem(pw: string, email = "", lang: "no" | "en" = "no") {
  const no = lang === "no";
  if (pw.length < 10) return no ? "Passordet må ha minst 10 tegn." : "The password needs at least 10 characters.";
  if (pw.length > 200) return no ? "Passordet er for langt." : "The password is too long.";
  if (COMMON.has(pw.toLowerCase())) return no ? "Passordet er for vanlig. Velg et annet." : "That password is too common. Choose another.";
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length > 3 && pw.toLowerCase().includes(local)) return no ? "Passordet kan ikke inneholde e-postadressen." : "The password cannot contain the email address.";
  if (new Set(pw).size < 5) return no ? "Passordet har for få ulike tegn." : "The password has too few different characters.";
  return null;
}
