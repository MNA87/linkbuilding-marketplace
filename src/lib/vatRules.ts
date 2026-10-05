import { isEuCountry, isNonEuCountry } from "@/lib/countries";

// Which VAT an order carries, by where the customer is based (to be
// confirmed with the accountant — see the point on Admin → Planning):
// - Netherlands, or no business: 21% Dutch VAT;
// - a business elsewhere in the EU with a checked VAT number: 0%, "btw
//   verlegd" (the customer pays VAT in their own country);
// - a business outside the EU: 0%, no Dutch VAT on the service;
// - anything unsure (EU without a checked number, "Ander land"): 21%.

export const NL_VAT_RATE = 21;

export type VatNote = "reverse" | "outside_eu";

// none: no check (yet) · valid: VIES says valid · mismatch: valid, but VIES
// gives another company name (still btw verlegd, you get a note) ·
// approved: you looked and it's fine · unreachable: VIES didn't answer,
// tried again at checkout and every hour (21% until then) · invalid: VIES
// says the number doesn't exist, or you rejected it.
export type VatStatus = "none" | "valid" | "mismatch" | "approved" | "unreachable" | "invalid";

// A number VIES said is valid: no waiting for anyone.
export const isVatAccepted = (status: string) => status === "valid" || status === "mismatch" || status === "approved";

export type VatTreatment = { rate: number; note: VatNote | null };

export function vatTreatment(company: {
  country: string;
  isBusiness: boolean;
  vatNumber: string | null;
  vatStatus: string;
}): VatTreatment {
  if (!company.isBusiness || company.country === "NL") return { rate: NL_VAT_RATE, note: null };
  if (isEuCountry(company.country)) {
    return company.vatNumber && isVatAccepted(company.vatStatus)
      ? { rate: 0, note: "reverse" }
      : { rate: NL_VAT_RATE, note: null };
  }
  if (isNonEuCountry(company.country)) return { rate: 0, note: "outside_eu" };
  return { rate: NL_VAT_RATE, note: null };
}

// The line on the invoice when no Dutch VAT is charged.
export function vatNoteText(note: VatNote | null | undefined): string | null {
  if (note === "reverse") return "BTW verlegd (art. 196 Btw-richtlijn) — de afnemer voldoet de btw.";
  if (note === "outside_eu") return "Btw niet van toepassing — dienst aan een ondernemer buiten de EU.";
  return null;
}

// What the customer sees about their VAT number.
export function vatStatusText(status: string): { ok: boolean; text: string } | null {
  if (isVatAccepted(status))
    return { ok: true, text: "Btw-nummer gecontroleerd: btw verlegd, je betaalt geen Nederlandse btw." };
  if (status === "unreachable")
    return {
      ok: false,
      text: "De EU-controle (VIES) is even niet bereikbaar. We proberen het automatisch opnieuw; lukt het, dan betaal je geen Nederlandse btw. Nu afrekenen kan ook, met 21% btw.",
    };
  if (status === "invalid")
    return { ok: false, text: "Dit btw-nummer is volgens de EU (VIES) niet geldig. Je betaalt 21% btw." };
  return null;
}
