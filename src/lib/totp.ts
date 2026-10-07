import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Tweestapsverificatie with an authenticator app (Google or Microsoft
// Authenticator): the standard 6-digit codes that change every 30 seconds
// (TOTP, RFC 6238), and one-time reservecodes for a lost phone.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of Array.from(buf)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Geen geldige base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// A new secret for the app: 20 random bytes, as base32.
export const newTotpSecret = () => base32Encode(randomBytes(20));

// The code for one 30-second step.
export function totpCode(secret: string, time = Date.now(), digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / 30)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const n = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return n.toString().padStart(digits, "0");
}

// A typed code, allowing a step either side for a phone's clock being off.
export function verifyTotp(secret: string, typed: string, time = Date.now()): boolean {
  const code = typed.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((step) => {
    const expected = Buffer.from(totpCode(secret, time + step * 30_000));
    return timingSafeEqual(expected, Buffer.from(code));
  });
}

// What the app scans (as a QR code): the account and who it's for.
export function totpUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// Reservecodes: 8 of them like "7KQ2-M9XA"; only their hashes are kept.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const chars = Array.from(randomBytes(8), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

export const hashBackupCode = (code: string) =>
  createHash("sha256").update(code.replace(/[\s-]/g, "").toUpperCase()).digest("hex");

// The hash list without the code used, or null when it isn't one of them.
export function spendBackupCode(hashes: string[], typed: string): string[] | null {
  const hash = hashBackupCode(typed);
  return hashes.includes(hash) ? hashes.filter((h) => h !== hash) : null;
}
