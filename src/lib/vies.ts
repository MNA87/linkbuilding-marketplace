import type { VatStatus } from "@/lib/vatRules";

// Checking an EU VAT number with VIES, the EU's own register. Most countries
// also give the company's name and address; the "requestIdentifier" is the
// official proof you checked it (given when you pass your own VAT number).

const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";

export type ViesAnswer =
  | { ok: true; valid: boolean; name: string | null; address: string | null; requestIdentifier: string | null }
  | { ok: false };

// "BE0123456789" → country "BE", number "0123456789".
export function splitVatNumber(vat: string): { countryCode: string; number: string } {
  const clean = vat.replace(/[\s.-]/g, "").toUpperCase();
  return { countryCode: clean.slice(0, 2), number: clean.slice(2) };
}

const blank = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s !== "---" ? s : null;
};

export async function checkVies(vat: string, requesterVat?: string | null): Promise<ViesAnswer> {
  const { countryCode, number } = splitVatNumber(vat);
  const requester = requesterVat ? splitVatNumber(requesterVat) : null;
  try {
    const res = await fetch(VIES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        countryCode,
        vatNumber: number,
        ...(requester ? { requesterMemberStateCode: requester.countryCode, requesterNumber: requester.number } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.valid !== "boolean") return { ok: false };
    return {
      ok: true,
      valid: data.valid,
      name: blank(data.name),
      address: blank(data.address),
      requestIdentifier: blank(data.requestIdentifier),
    };
  } catch {
    return { ok: false };
  }
}

// Legal forms and filler that differ between how a company writes its name
// and how the register has it.
const LEGAL_FORMS = new Set(
  "bv nv vof cv bvba bv-bvba srl sprl sa sas sarl sasu eurl gmbh ug ag kg ohg ek ltd limited llc plc inc sl sa spa srls ab as asa aps oy oyj kft sro zoo sp ehf the de het la le les".split(
    " "
  )
);

const words = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !LEGAL_FORMS.has(w));

// Whether the name in VIES is the company the customer filled in: the same
// words, one name inside the other, or most words shared.
export function namesMatch(entered: string, register: string): boolean {
  const a = words(entered);
  const b = words(register);
  if (a.length === 0 || b.length === 0) return false;
  const ja = a.join(" ");
  const jb = b.join(" ");
  if (ja === jb || jb.includes(ja) || ja.includes(jb)) return true;
  const shared = a.filter((w) => b.includes(w)).length;
  return shared / Math.max(a.length, b.length) >= 0.6;
}

// What the answer means for the customer's VAT status. A valid number is
// enough (as Stripe and Paddle do it): no name (Germany, Spain) is fine, and
// a different name still counts, with a note for you (mismatch).
export function statusFromVies(answer: ViesAnswer, companyName: string): VatStatus {
  if (!answer.ok) return "unreachable";
  if (!answer.valid) return "invalid";
  if (answer.name && !namesMatch(companyName, answer.name)) return "mismatch";
  return "valid";
}
