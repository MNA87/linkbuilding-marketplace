import { createHmac, timingSafeEqual } from "node:crypto";

// Around a login: the lock after too many wrong tries, a short description of
// the device for the mail after an admin login, and the signed link in that
// mail ("Dit was ik niet").

export const MAX_FAILED_LOGINS = 10;
export const LOCK_MINUTES = 30;
// An admin login lasts a day; then log in again (see the jwt callback).
export const ADMIN_LOGIN_MS = 24 * 60 * 60 * 1000;

export const isLocked = (lockedUntil: Date | null, now = new Date()) => Boolean(lockedUntil && lockedUntil > now);

// One more wrong try: the new count, and the lock when it reaches the limit.
export function afterFailedLogin(failed: number, now = new Date()): { failedLogins: number; lockedUntil: Date | null } {
  const next = failed + 1;
  return next >= MAX_FAILED_LOGINS
    ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) }
    : { failedLogins: next, lockedUntil: null };
}

// "Chrome op Mac" from the browser's User-Agent; good enough for a mail.
export function describeDevice(userAgent: string | undefined): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (!browser && !os) return "Onbekend apparaat";
  return [browser ?? "Browser", os && `op ${os}`].filter(Boolean).join(" ");
}

// The "Dit was ik niet" link: who it's for and until when, signed with
// NEXTAUTH_SECRET so it can't be made up. Valid for a week.
const NOT_ME_DAYS = 7;
const sign = (payload: string, secret: string) =>
  createHmac("sha256", `not-me:${secret}`).update(payload).digest("base64url");

export function notMeToken(userId: string, now = Date.now(), secret = process.env.NEXTAUTH_SECRET ?? ""): string {
  const payload = `${userId}.${now + NOT_ME_DAYS * 86_400_000}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload, secret)}`;
}

export function readNotMeToken(
  token: string,
  now = Date.now(),
  secret = process.env.NEXTAUTH_SECRET ?? ""
): string | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !secret) return null;
  const payload = Buffer.from(encoded, "base64url").toString();
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [userId, until] = payload.split(".");
  return userId && Number(until) > now ? userId : null;
}
