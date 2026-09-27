import { z } from "zod";
import { billingDetailsSchema } from "./billing";

// Optional; digits with the usual separators, stored as typed.
const phone = z
  .string()
  .trim()
  .max(30)
  .refine(
    (v) => v === "" || (/^\+?[\d\s\-()]+$/.test(v) && v.replace(/\D/g, "").length >= 9),
    "Ongeldig telefoonnummer (bijv. 06 12345678)"
  )
  .transform((v) => v || null);

// "Mijn gegevens": the person, and the company as it goes on the invoices.
export const accountDetailsSchema = billingDetailsSchema.extend({
  name: z.string().trim().min(2, "Naam moet minimaal 2 tekens zijn").max(200),
  phone,
  companyName: z.string().trim().min(2, "Bedrijfsnaam moet minimaal 2 tekens zijn").max(200),
});

export const emailChangeSchema = z.object({
  newEmail: z.string().trim().email("Vul een geldig e-mailadres in").max(320),
  currentPassword: z.string().min(1, "Vul je huidige wachtwoord in"),
});
