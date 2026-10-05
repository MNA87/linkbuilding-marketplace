import { z } from "zod";
import { countryName, isEuCountry, vatPrefix } from "@/lib/countries";

const squash = (v: string) => v.replace(/[\s.]/g, "").toUpperCase();

// Dutch VAT id: NL + 9 digits + B + 2 digits (e.g. NL123456789B01).
export const vatNumber = z
  .string()
  .transform(squash)
  .refine((v) => v === "" || /^NL\d{9}B\d{2}$/.test(v), "Ongeldig BTW-nummer (bijv. NL123456789B01)");

// Dutch postcode, stored as "1234 AB".
export const postcode = z
  .string()
  .transform(squash)
  .refine((v) => /^[1-9]\d{3}[A-Z]{2}$/.test(v), "Ongeldige postcode (bijv. 1234 AB)")
  .transform((v) => `${v.slice(0, 4)} ${v.slice(4)}`);

export const billingDetailsSchema = z.object({
  billingAddress: z.string().trim().min(3, "Vul je adres in").max(200),
  billingPostcode: postcode,
  billingCity: z.string().trim().min(2, "Vul je plaats in").max(100),
  vatNumber: vatNumber.transform((v) => v || null),
});

export const sellerDetailsSchema = z.object({
  sellerName: z.string().trim().min(2, "Vul de bedrijfsnaam in").max(200),
  sellerAddress: z.string().trim().min(3, "Vul het adres in").max(200),
  sellerPostcode: postcode,
  sellerCity: z.string().trim().min(2, "Vul de plaats in").max(100),
  sellerKvk: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => /^\d{8}$/.test(v), "KvK-nummer is 8 cijfers"),
  sellerVatNumber: vatNumber.refine((v) => v !== "", "Vul het BTW-nummer in"),
  sellerIban: z
    .string()
    .transform(squash)
    .refine((v) => v === "" || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v), "Ongeldig IBAN"),
  sellerEmail: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Ongeldig e-mailadres"),
});

// A postcode and VAT number for where the customer is based: the Dutch
// formats for the Netherlands, the country's own code for a VAT number in
// the rest of the EU, and just something sensible elsewhere.
export function checkPostcode(
  country: string,
  value: string
): { value: string; error: null } | { value: null; error: string } {
  if (country === "NL") {
    const r = postcode.safeParse(value);
    return r.success ? { value: r.data, error: null } : { value: null, error: r.error.issues[0].message };
  }
  const v = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9 -]{1,9}$/.test(v) ? { value: v, error: null } : { value: null, error: "Ongeldige postcode" };
}

export function checkVatNumber(
  country: string,
  value: string
): { value: string | null; error: null } | { value: null; error: string } {
  const v = squash(value).replace(/-/g, "");
  if (!v) return { value: null, error: null };
  if (country === "NL") {
    const r = vatNumber.safeParse(value);
    return r.success ? { value: r.data, error: null } : { value: null, error: r.error.issues[0].message };
  }
  if (isEuCountry(country)) {
    const prefix = vatPrefix(country);
    if (!v.startsWith(prefix))
      return { value: null, error: `Een btw-nummer uit ${countryName(country)} begint met ${prefix}` };
    return /^[A-Z]{2}[0-9A-Z]{2,12}$/.test(v)
      ? { value: v, error: null }
      : { value: null, error: "Ongeldig btw-nummer" };
  }
  return /^[A-Z0-9]{4,20}$/.test(v) ? { value: v, error: null } : { value: null, error: "Ongeldig btw-nummer" };
}
