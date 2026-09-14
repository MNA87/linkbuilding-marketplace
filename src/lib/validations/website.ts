import { z } from "zod";

export const createWebsiteSchema = z.object({
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
  productType: z.enum(["BLOG_POST", "HOMEPAGE_LINK"]),
  supplierPrice: z.coerce.number().positive("Vul een geldige prijs in").max(100000),
  minWords: z.coerce.number().int().min(0).max(20000).optional(),
  maxWords: z.coerce.number().int().min(0).max(20000).optional(),
  maxLinks: z.coerce.number().int().min(1).max(20).default(1),
  dofollow: z.coerce.boolean().default(true),
  permanent: z.coerce.boolean().default(true),
});

export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;

export const addWebsiteProductSchema = z.object({
  websiteId: z.string().cuid(),
  productType: z.enum(["BLOG_POST", "HOMEPAGE_LINK"]),
  supplierPrice: z.coerce.number().positive("Vul een geldige prijs in").max(100000),
  minWords: z.coerce.number().int().min(0).max(20000).optional(),
  maxWords: z.coerce.number().int().min(0).max(20000).optional(),
  maxLinks: z.coerce.number().int().min(1).max(20).default(1),
  dofollow: z.coerce.boolean().default(true),
  permanent: z.coerce.boolean().default(true),
});
