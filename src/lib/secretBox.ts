import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Encryption for secrets kept in the database (API keys from Admin →
// Instellingen → Koppelingen): AES-256-GCM with a key derived from
// NEXTAUTH_SECRET, which lives only in Railway. Someone reading the
// database alone sees nothing usable.
function key(secret = process.env.NEXTAUTH_SECRET): Buffer {
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return createHash("sha256").update(`api-credentials:${secret}`).digest();
}

// "iv.tag.data", each base64.
export function encryptSecret(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

// Null when it can't be read (tampered with, or NEXTAUTH_SECRET changed).
export function decryptSecret(box: string, secret?: string): string | null {
  try {
    const [iv, tag, data] = box.split(".").map((part) => Buffer.from(part, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
