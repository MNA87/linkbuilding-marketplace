import { z } from "zod";
import { Prisma } from "@prisma/client";
import { PRODUCT_NAMES, PRODUCT_TYPES, type ProductTypeKey } from "@/lib/websiteProducts";

export { PRODUCT_NAMES, PRODUCT_TYPES, type ProductTypeKey };

// Admin → Websites: the "Gegevens" and "Prijzen" of a site, shared by the
// site's own tabs and by "Nieuwe website". The figures (DR, traffic, ...)
// aren't here: they're fetched automatically (src/lib/websiteMetrics.ts).


export const websiteDetailsSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) =>
      d
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
    )
    .pipe(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Vul een geldig domein in (bv. voorbeeld.nl)")),
  description: z.string().trim().max(2000, "Omschrijving is te lang"),
  countryId: z.string().min(1, "Kies een land"),
  languageId: z.string().min(1, "Kies een taal"),
  // The first is the main niche (Website.category), the rest extra niches.
  nicheIds: z.array(z.string().min(1)).min(1, "Kies minstens één niche").max(20),
  maxLinks: z.string().trim(),
  sponsored: z.boolean(),
  exampleUrl: z.string().trim().max(500),
});
export type WebsiteDetailsInput = z.input<typeof websiteDetailsSchema>;

export type WebsiteDetails = {
  domain: string;
  description: string | null;
  countryId: string;
  languageId: string;
  categoryId: string;
  extraNicheIds: string[];
  maxLinks: number | null;
  sponsored: boolean;
  exampleUrl: string | null;
};

export function normalizeDetails(input: unknown): { ok: true; data: WebsiteDetails } | { ok: false; error: string } {
  const parsed = websiteDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const d = parsed.data;
  const maxLinks = d.maxLinks === "" ? null : Number(d.maxLinks);
  if (maxLinks !== null && (!Number.isInteger(maxLinks) || maxLinks < 1 || maxLinks > 20)) {
    return { ok: false, error: "Max links: een getal van 1 tot 20." };
  }
  let exampleUrl: string | null = d.exampleUrl || null;
  if (exampleUrl) {
    if (!/^https?:\/\//i.test(exampleUrl)) exampleUrl = `https://${exampleUrl}`;
    try {
      new URL(exampleUrl);
    } catch {
      return { ok: false, error: "Vul een geldige link naar het voorbeeldartikel in." };
    }
  }
  const niches = d.nicheIds.filter((id, i) => d.nicheIds.indexOf(id) === i);
  return {
    ok: true,
    data: {
      domain: d.domain,
      description: d.description || null,
      countryId: d.countryId,
      languageId: d.languageId,
      categoryId: niches[0],
      extraNicheIds: niches.slice(1),
      maxLinks,
      sponsored: d.sponsored,
      exampleUrl,
    },
  };
}

// One column of the "Prijzen" table: a product, whether it's offered, its
// "Duur", and a price per topic ("" = Algemeen; an empty price = that topic
// isn't placed on this site).
export const priceColumnsSchema = z
  .array(
    z.object({
      type: z.enum(PRODUCT_TYPES),
      enabled: z.boolean(),
      periodic: z.boolean(),
      prices: z.record(z.string(), z.string()),
    })
  )
  .max(PRODUCT_TYPES.length);
export type PriceColumnInput = z.input<typeof priceColumnsSchema>[number];

export type PriceColumn = {
  type: ProductTypeKey;
  enabled: boolean;
  periodic: boolean;
  general: Prisma.Decimal | null;
  topics: { topicId: string; price: Prisma.Decimal | null }[];
};

function parseEuro(v: string | undefined): Prisma.Decimal | null | "invalid" {
  const s = (v ?? "").replace(/\s|€/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 100000 ? new Prisma.Decimal(n.toFixed(2)) : "invalid";
}

export function normalizePrices(
  input: unknown,
  topics: { id: string; name: string }[]
): { ok: true; columns: PriceColumn[] } | { ok: false; error: string } {
  const parsed = priceColumnsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige prijzen." };
  const columns: PriceColumn[] = [];
  for (const c of parsed.data) {
    const product = PRODUCT_NAMES[c.type];
    const general = parseEuro(c.prices[""]);
    if (general === "invalid") return { ok: false, error: `Ongeldige prijs voor Algemeen bij ${product}.` };
    if (c.enabled && !general) return { ok: false, error: `Vul de prijs voor Algemeen in bij ${product}.` };
    const topicPrices: PriceColumn["topics"] = [];
    for (const t of topics) {
      const price = parseEuro(c.prices[t.id]);
      if (price === "invalid") return { ok: false, error: `Ongeldige prijs voor ${t.name} bij ${product}.` };
      topicPrices.push({ topicId: t.id, price });
    }
    columns.push({ type: c.type, enabled: c.enabled, periodic: c.periodic, general, topics: topicPrices });
  }
  return { ok: true, columns };
}
