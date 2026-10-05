import { z } from "zod";
import { phone } from "./account";

// What a chosen password needs, as shown while typing it.
export const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "Minstens 10 tekens", test: (v) => v.length >= 10 },
  { label: "Een hoofdletter", test: (v) => /[A-Z]/.test(v) },
  { label: "Een kleine letter", test: (v) => /[a-z]/.test(v) },
  { label: "Een cijfer", test: (v) => /[0-9]/.test(v) },
];

// The rules for every password a user chooses (register, reset, change).
const newPassword = z
  .string()
  .min(10, "Wachtwoord moet minimaal 10 tekens zijn")
  .max(200)
  .regex(/[a-z]/, "Wachtwoord moet een kleine letter bevatten")
  .regex(/[A-Z]/, "Wachtwoord moet een hoofdletter bevatten")
  .regex(/[0-9]/, "Wachtwoord moet een cijfer bevatten");

export const loginSchema = z.object({
  email: z.string().trim().email("Vul een geldig e-mailadres in"),
  password: z.string().min(1, "Wachtwoord is verplicht"),
});

// Where a new customer is based (on the invoice) and how they found us.
export const COUNTRIES = [
  { code: "NL", name: "Nederland" },
  { code: "BE", name: "België" },
  { code: "DE", name: "Duitsland" },
  { code: "FR", name: "Frankrijk" },
  { code: "GB", name: "Verenigd Koninkrijk" },
  { code: "ES", name: "Spanje" },
  { code: "OTHER", name: "Ander land" },
] as const;

export const REFERRAL_SOURCES = ["Google", "LinkedIn", "Via een bekende", "Social media", "Anders"] as const;

// Registering, kept short: who you are, your company and how to reach you.
// The invoice address is asked when the first order is paid (see the cart).
export const registerSchema = z
  .object({
    // Publisher self-registration is off (see src/app/register/RegisterForm.tsx)
    // — enforced here too, not just by hiding the UI option, so a request that
    // bypasses the form can't still create a supplier account.
    accountType: z.enum(["customer"], {
      errorMap: () => ({ message: "Kies een accounttype" }),
    }),
    firstName: z.string().trim().min(1, "Vul je voornaam in").max(100),
    lastName: z.string().trim().min(1, "Vul je achternaam in").max(100),
    email: z.string().trim().email("Vul een geldig e-mailadres in").max(320),
    password: newPassword,
    confirmPassword: z.string(),
    companyName: z.string().trim().min(2, "Vul de bedrijfsnaam in").max(200),
    phone: z.string().trim().min(1, "Vul je telefoonnummer in").pipe(phone),
    country: z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]], {
      errorMap: () => ({ message: "Kies je land" }),
    }),
    referralSource: z.enum(REFERRAL_SOURCES, { errorMap: () => ({ message: "Kies waar je ons van kent" }) }),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "Je moet akkoord gaan met de voorwaarden" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "De wachtwoorden zijn niet gelijk",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Vul een geldig e-mailadres in"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vul je huidige wachtwoord in"),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "Kies een ander wachtwoord dan je huidige",
    path: ["password"],
  });
