import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Vul een geldig e-mailadres in"),
  password: z.string().min(1, "Wachtwoord is verplicht"),
});

export const registerSchema = z
  .object({
    accountType: z.enum(["customer", "supplier"], {
      errorMap: () => ({ message: "Kies een accounttype" }),
    }),
    companyName: z.string().trim().min(2, "Bedrijfsnaam moet minimaal 2 tekens zijn").max(200),
    name: z.string().trim().min(2, "Naam moet minimaal 2 tekens zijn").max(200),
    email: z.string().trim().email("Vul een geldig e-mailadres in").max(320),
    password: z
      .string()
      .min(10, "Wachtwoord moet minimaal 10 tekens zijn")
      .max(200)
      .regex(/[a-z]/, "Wachtwoord moet een kleine letter bevatten")
      .regex(/[A-Z]/, "Wachtwoord moet een hoofdletter bevatten")
      .regex(/[0-9]/, "Wachtwoord moet een cijfer bevatten"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Vul een geldig e-mailadres in"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(10, "Wachtwoord moet minimaal 10 tekens zijn")
      .max(200)
      .regex(/[a-z]/, "Wachtwoord moet een kleine letter bevatten")
      .regex(/[A-Z]/, "Wachtwoord moet een hoofdletter bevatten")
      .regex(/[0-9]/, "Wachtwoord moet een cijfer bevatten"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Wachtwoorden komen niet overeen",
    path: ["confirmPassword"],
  });
