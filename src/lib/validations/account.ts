import { z } from "zod";
import { postcode, vatNumber } from "./billing";

// Optional; digits with the usual separators, stored as typed.
export const phone = z
  .string()
  .trim()
  .max(30)
  .refine(
    (v) => v === "" || (/^\+?[\d\s\-()]+$/.test(v) && v.replace(/\D/g, "").length >= 9),
    "Ongeldig telefoonnummer (bijv. 06 12345678)"
  )
  .transform((v) => v || null);

const address = (what: string) => z.string().trim().min(3, `Vul ${what} in`).max(200);
const city = (what: string) => z.string().trim().min(2, `Vul ${what} in`).max(100);

const person = z.object({
  name: z.string().trim().min(2, "Naam moet minimaal 2 tekens zijn").max(200),
  address: address("je adres"),
  postcode,
  city: city("je plaats"),
  phone,
});

const company = z.object({
  companyName: z.string().trim().min(2, "Vul de bedrijfsnaam in").max(200),
  vatNumber: vatNumber.transform((v) => v || null),
});

const companyAddress = z.object({
  billingAddress: address("het adres van je bedrijf"),
  billingPostcode: postcode,
  billingCity: city("de plaats van je bedrijf"),
});

const flags = z.object({ isBusiness: z.boolean(), sameAddress: z.boolean() });

export type AccountDetails = z.infer<typeof person> &
  (
    | { isBusiness: false }
    | ({ isBusiness: true } & z.infer<typeof company> &
        ({ sameAddress: true } | ({ sameAddress: false } & z.infer<typeof companyAddress>)))
  );

// "Mijn gegevens": the person first; ordering as a business adds the
// company, at the same address or its own. Only the parts that apply are
// checked. The first problem found is the error.
export function parseAccountDetails(input: unknown): { data: AccountDetails; error: null } | { data: null; error: string } {
  const fail = (e: z.ZodError) => ({ data: null, error: e.issues[0]?.message ?? "Ongeldige invoer" });
  const p = person.safeParse(input);
  if (!p.success) return fail(p.error);
  const f = flags.safeParse(input);
  if (!f.success) return fail(f.error);
  if (!f.data.isBusiness) return { data: { ...p.data, isBusiness: false }, error: null };

  const c = company.safeParse(input);
  if (!c.success) return fail(c.error);
  if (f.data.sameAddress) return { data: { ...p.data, ...c.data, isBusiness: true, sameAddress: true }, error: null };

  const a = companyAddress.safeParse(input);
  if (!a.success) return fail(a.error);
  return { data: { ...p.data, ...c.data, ...a.data, isBusiness: true, sameAddress: false }, error: null };
}

// What goes on the invoices (the Company row): the company with its own
// address, or — privately, or at the same address — the person's.
export function invoiceDetailsOf(d: AccountDetails) {
  const own = { billingAddress: d.address, billingPostcode: d.postcode, billingCity: d.city };
  if (!d.isBusiness) return { isBusiness: false, name: d.name, vatNumber: null, ...own };
  return {
    isBusiness: true,
    name: d.companyName,
    vatNumber: d.vatNumber,
    ...(d.sameAddress
      ? own
      : { billingAddress: d.billingAddress, billingPostcode: d.billingPostcode, billingCity: d.billingCity }),
  };
}

export const emailChangeSchema = z.object({
  newEmail: z.string().trim().email("Vul een geldig e-mailadres in").max(320),
  currentPassword: z.string().min(1, "Vul je huidige wachtwoord in"),
});
