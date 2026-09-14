import { z } from "zod";

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
  domainRating: z.coerce.number().int().min(0).max(100),
  domainAuthority: z.coerce.number().int().min(0).max(100),
  organicTraffic: z.coerce.number().int().min(0),
  referringDomains: z.coerce.number().int().min(0),
});

export type EditWebsiteInput = z.infer<typeof editWebsiteSchema>;
