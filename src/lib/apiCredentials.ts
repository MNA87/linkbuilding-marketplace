import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";

// The external services whose key admin sets in Instellingen → Koppelingen.
// A key set there wins; otherwise a Railway variable of the same service
// still works.
export const PROVIDERS = {
  ahrefs: { label: "Ahrefs", envVar: "AHREFS_API_KEY", what: "Domain Rating, verkeer en verwijzende domeinen" },
  seometrics: {
    label: "SEO Metrics Checker",
    envVar: "SEOMETRICS_API_KEY",
    what: "Trust Flow en Citation Flow (Majestic), Domain Authority en spamscore (Moz)",
  },
} as const;

export type Provider = keyof typeof PROVIDERS;

export function isProvider(value: string): value is Provider {
  return Object.hasOwn(PROVIDERS, value);
}

export type CredentialStatus = {
  provider: Provider;
  label: string;
  what: string;
  // Where the key in use comes from; null when there is none.
  source: "admin" | "railway" | null;
  last4: string | null;
  // Saved in admin but unreadable (NEXTAUTH_SECRET changed): fill it in again.
  unreadable: boolean;
  updatedAt: Date | null;
};

export async function getApiKey(provider: Provider): Promise<string | null> {
  const row = await prisma.apiCredential.findUnique({ where: { provider } });
  const saved = row ? decryptSecret(row.ciphertext) : null;
  return saved ?? process.env[PROVIDERS[provider].envVar] ?? null;
}

export async function credentialStatuses(): Promise<CredentialStatus[]> {
  const rows = await prisma.apiCredential.findMany();
  return (Object.keys(PROVIDERS) as Provider[]).map((provider) => {
    const row = rows.find((r) => r.provider === provider);
    const readable = row ? decryptSecret(row.ciphertext) !== null : false;
    const env = process.env[PROVIDERS[provider].envVar];
    return {
      provider,
      label: PROVIDERS[provider].label,
      what: PROVIDERS[provider].what,
      source: readable ? "admin" : env ? "railway" : null,
      last4: readable ? row!.last4 : env ? env.slice(-4) : null,
      unreadable: Boolean(row && !readable),
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

export async function saveApiKey(provider: Provider, key: string): Promise<void> {
  const data = { ciphertext: encryptSecret(key), last4: key.slice(-4) };
  await prisma.apiCredential.upsert({ where: { provider }, create: { provider, ...data }, update: data });
}

export async function deleteApiKey(provider: Provider): Promise<void> {
  await prisma.apiCredential.deleteMany({ where: { provider } });
}

// The first number found under a key matching `pattern`, anywhere in the
// response — the usage endpoints' exact field names aren't pinned down.
export function findNumber(value: unknown, pattern: RegExp): number | null {
  if (!value || typeof value !== "object") return null;
  for (const [k, v] of Object.entries(value)) {
    if (pattern.test(k) && typeof v === "number") return v;
    if (pattern.test(k) && typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  }
  for (const v of Object.values(value)) {
    const found = findNumber(v, pattern);
    if (found !== null) return found;
  }
  return null;
}

const nl = (n: number) => n.toLocaleString("nl-NL");

// A free call that shows the key works, and how much is left.
export async function testConnection(provider: Provider): Promise<{ ok: boolean; message: string }> {
  const key = await getApiKey(provider);
  if (!key) return { ok: false, message: "Er is nog geen sleutel ingesteld." };
  try {
    if (provider === "ahrefs") {
      const res = await fetch("https://api.ahrefs.com/v3/subscription-info/limits-and-usage", {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401 || res.status === 403) return { ok: false, message: "Ahrefs weigert deze sleutel." };
      if (!res.ok) return { ok: false, message: `Ahrefs gaf een fout (${res.status}).` };
      const body: unknown = await res.json();
      const limit = findNumber(body, /units_limit/i);
      const used = findNumber(body, /units_usage/i);
      if (limit === null || used === null) {
        // Usage figures only (no key): to see which fields Ahrefs sends.
        console.log("Ahrefs limits-and-usage without unit fields:", JSON.stringify(body).slice(0, 600));
        return { ok: true, message: "Verbinding werkt." };
      }
      return {
        ok: true,
        message: `Verbinding werkt · ${nl(Math.max(0, limit - used))} van ${nl(limit)} units over deze maand`,
      };
    }
    const res = await fetch(`https://www.seometricschecker.com/api/balance.php?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, message: `SEO Metrics Checker gaf een fout (${res.status}).` };
    const body: unknown = await res.json();
    const credits = findNumber(body, /^credits$/i);
    if (credits === null) {
      console.log("SEO Metrics Checker balance without credits:", JSON.stringify(body).slice(0, 300));
      return { ok: false, message: "SEO Metrics Checker weigert deze sleutel." };
    }
    return { ok: true, message: `Verbinding werkt · ${nl(credits)} credits over` };
  } catch {
    return { ok: false, message: "Geen verbinding. Probeer het zo nog eens." };
  }
}
