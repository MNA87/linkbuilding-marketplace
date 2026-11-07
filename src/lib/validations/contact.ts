import { z } from "zod";

// Het contactformulier op de publieke site (/contact). Gedeeld door het
// formulier (client) en de server action.
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Vul je naam in").max(100),
  email: z.string().trim().email("Vul een geldig e-mailadres in").max(200),
  company: z.string().trim().max(100).default(""),
  website: z.string().trim().max(200).default(""),
  subject: z.enum(["analyse", "uitbesteden", "bureau", "publisher", "anders"]),
  message: z.string().trim().min(10, "Vertel in minstens een paar woorden waar het over gaat").max(4000),
  // Honeypot: echte bezoekers laten dit veld leeg.
  fax: z.string().max(0).default(""),
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactSubject = ContactInput["subject"];

export const CONTACT_SUBJECTS: { value: ContactSubject; label: string }[] = [
  { value: "analyse", label: "Gratis linkbuilding‑analyse" },
  { value: "uitbesteden", label: "Linkbuilding uitbesteden" },
  { value: "bureau", label: "Samenwerken als bureau" },
  { value: "publisher", label: "Mijn site aanmelden als publisher" },
  { value: "anders", label: "Iets anders" },
];
