import { z } from "zod";

const squash = (v: string) => v.replace(/[\s.]/g, "").toUpperCase();

// Dutch VAT id: NL + 9 digits + B + 2 digits (e.g. NL123456789B01).
const vatNumber = z
  .string()
  .transform(squash)
  .refine((v) => v === "" || /^NL\d{9}B\d{2}$/.test(v), "Ongeldig BTW-nummer (bijv. NL123456789B01)");

// Dutch postcode, stored as "1234 AB".
const postcode = z
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
  sellerEmail: z.string().trim().max(200).refine((v) => v === "" || z.string().email().safeParse(v).success, "Ongeldig e-mailadres"),
});
