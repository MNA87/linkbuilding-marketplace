import { z } from "zod";

// The figures (DR, traffic, ...) aren't part of it: they are fetched
// automatically (src/lib/websiteMetrics.ts), never typed in here.
export const editWebsiteSchema = z.object({
  websiteId: z.string().cuid(),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Vul een geldig domein in")
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Vul een geldig domein in (bv. voorbeeld.nl)"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  categoryId: z.string().cuid("Kies een categorie"),
  countryId: z.string().cuid("Kies een land"),
  languageId: z.string().cuid("Kies een taal"),
});

export type EditWebsiteInput = z.infer<typeof editWebsiteSchema>;
