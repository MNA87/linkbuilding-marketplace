import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Prices agreed with one customer (Admin → Klanten → klant):
// - a fixed price per site/product, which always goes first;
// - else a discount on every site;
// - else the standard price.
// And whether writing the article is included, so "Laat ons schrijven"
// adds nothing on top.

export type PriceSource = "standard" | "fixed" | "discount";

export type CustomerTerms = {
  discountPercent: Prisma.Decimal | null;
  writingIncluded: boolean;
  fixed: Map<string, Prisma.Decimal>;
};

export const STANDARD_TERMS: CustomerTerms = { discountPercent: null, writingIncluded: false, fixed: new Map() };

export function priceForCustomer(
  standard: Prisma.Decimal,
  websiteProductId: string,
  terms: CustomerTerms
): { price: Prisma.Decimal; source: PriceSource } {
  const fixed = terms.fixed.get(websiteProductId);
  if (fixed) return { price: fixed, source: "fixed" };
  if (terms.discountPercent && terms.discountPercent.gt(0)) {
    const price = standard
      .times(new Prisma.Decimal(100).minus(terms.discountPercent))
      .dividedBy(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { price, source: "discount" };
  }
  return { price: standard, source: "standard" };
}

export async function customerTerms(companyId: string | null | undefined): Promise<CustomerTerms> {
  if (!companyId) return STANDARD_TERMS;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      discountPercent: true,
      writingIncluded: true,
      customerPrices: { select: { websiteProductId: true, price: true } },
    },
  });
  if (!company) return STANDARD_TERMS;
  return {
    discountPercent: company.discountPercent,
    writingIncluded: company.writingIncluded,
    fixed: new Map(company.customerPrices.map((p) => [p.websiteProductId, p.price])),
  };
}

// What "Laat ons schrijven" costs this customer on top of the placement.
export async function writingFeeFor(companyId: string | null | undefined): Promise<Prisma.Decimal> {
  const terms = await customerTerms(companyId);
  if (terms.writingIncluded) return new Prisma.Decimal(0);
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { writingPrice: true } });
  return settings?.writingPrice ?? new Prisma.Decimal(25);
}

// "€90 (vaste prijs, standaard €129)": where a customer's price comes from.
export function priceSourceLabel(source: PriceSource, terms: CustomerTerms): string {
  if (source === "fixed") return "vaste prijs";
  if (source === "discount") return `${terms.discountPercent?.toNumber()}% korting`;
  return "standaard";
}
