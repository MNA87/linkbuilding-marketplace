import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REMINDER_DAYS_BEFORE, periodItemWhere } from "@/lib/placementPeriod";

export type LinkType = "BLOG_POST" | "HOMEPAGE_LINK";

// What there is to buy per link type: how many active sites offer it, and
// the lowest price per year among them (the price an admin sets on a product
// is the price the customer pays — see src/lib/pricing.ts).
export async function offerSummary(): Promise<Record<LinkType, { sites: number; fromPrice: Prisma.Decimal | null }>> {
  const products = await prisma.websiteProduct.findMany({
    where: { isAvailable: true, website: { status: "ACTIVE" } },
    select: { websiteId: true, supplierPrice: true, product: { select: { type: true } } },
  });
  const summary = {
    BLOG_POST: { sites: new Set<string>(), fromPrice: null as Prisma.Decimal | null },
    HOMEPAGE_LINK: { sites: new Set<string>(), fromPrice: null as Prisma.Decimal | null },
  };
  for (const p of products) {
    const s = summary[p.product.type as LinkType];
    if (!s) continue;
    s.sites.add(p.websiteId);
    if (!s.fromPrice || p.supplierPrice.lt(s.fromPrice)) s.fromPrice = p.supplierPrice;
  }
  return {
    BLOG_POST: { sites: summary.BLOG_POST.sites.size, fromPrice: summary.BLOG_POST.fromPrice },
    HOMEPAGE_LINK: { sites: summary.HOMEPAGE_LINK.sites.size, fromPrice: summary.HOMEPAGE_LINK.fromPrice },
  };
}

// Live links whose paid period ends within the reminder window — the ones
// worth renewing now.
export function expiringSoonWhere(customerId: string, now = new Date()): Prisma.OrderItemWhereInput {
  const until = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);
  return {
    order: { customerId },
    ...periodItemWhere,
    placement: { status: "published", expiresAt: { gt: now, lte: until } },
  };
}
