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

// Registering: the person, and a company only when ordering as a business
// (then the invoices carry its name). One password field — the eye shows
// what's typed, instead of asking for it twice.
export const registerSchema = z
  .object({
    // Publisher self-registration is off (see src/app/register/RegisterForm.tsx)
    // — enforced here too, not just by hiding the UI option, so a request that
    // bypasses the form can't still create a supplier account.
    accountType: z.enum(["customer"], {
      errorMap: () => ({ message: "Kies een accounttype" }),
    }),
    name: z.string().trim().min(2, "Naam moet minimaal 2 tekens zijn").max(200),
    email: z.string().trim().email("Vul een geldig e-mailadres in").max(320),
    phone,
    password: newPassword,
    isBusiness: z.boolean(),
    companyName: z.string().trim().max(200),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "Je moet akkoord gaan met de voorwaarden" }),
    }),
  })
  .refine((data) => !data.isBusiness || data.companyName.length >= 2, {
    message: "Vul de bedrijfsnaam in",
    path: ["companyName"],
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
