import { Prisma } from "@prisma/client";
import { z } from "zod";

// "Laat ons schrijven": instead of supplying an article, the customer gives
// 1-2 links (anchor text + URL) and the platform writes the article around
// them, for writingFeeSnap on top of the placement price.
export type BriefLink = { anchor: string; url: string };

export const MAX_BRIEF_LINKS = 2;

export const briefLinksSchema = z
  .array(
    z.object({
      anchor: z.string().trim().min(1, "Vul een ankertekst in").max(120, "Ankertekst is te lang"),
      url: z
        .string()
        .trim()
        .url("Vul een geldige URL in (met https://)")
        // It ends up as a link in a published article: web pages only.
        .refine((u) => /^https?:\/\//i.test(u), "Vul een geldige URL in (met https://)"),
    })
  )
  .min(1, "Vul minstens één link in")
  .max(MAX_BRIEF_LINKS);

export function parseBriefLinks(value: unknown): BriefLink[] {
  const parsed = briefLinksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

// What the customer pays for an item: the placement plus, if chosen, the
// writing service.
export function itemPrice(item: {
  customerPriceSnap: Prisma.Decimal;
  writingFeeSnap: Prisma.Decimal;
}): Prisma.Decimal {
  return item.customerPriceSnap.plus(item.writingFeeSnap);
}

// Whether an item in the cart still has to be filled in before it can be
// paid for — the cart's "nog invullen" and the fill-in sequence use this.
export function itemNeedsContent(
  item: {
    renewsOrderItemId: string | null;
    targetUrl: string | null;
    articleTitle: string | null;
    writeForMe: boolean;
    briefLinks: Prisma.JsonValue;
  },
  productType: string
): boolean {
  if (item.renewsOrderItemId) return false;
  if (productType === "HOMEPAGE_LINK") return !item.targetUrl;
  if (item.writeForMe) return parseBriefLinks(item.briefLinks).length === 0;
  return !item.articleTitle;
}
