import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { customerTerms, priceForCustomer } from "@/lib/customerPricing";
import { REMINDER_DAYS_BEFORE, periodItemWhere } from "@/lib/placementPeriod";

export type LinkType = "BLOG_POST" | "HOMEPAGE_LINK";

// What there is to buy per link type: how many active sites offer it, and
// the lowest price per year among them (the price an admin sets on a product
// is the price the customer pays — see src/lib/pricing.ts — or the price
// agreed with this customer).
export async function offerSummary(
  companyId?: string | null
): Promise<Record<LinkType, { sites: number; fromPrice: Prisma.Decimal | null }>> {
  const [products, terms] = await Promise.all([
    prisma.websiteProduct.findMany({
      where: { isAvailable: true, website: { status: "ACTIVE" } },
      select: { id: true, websiteId: true, supplierPrice: true, product: { select: { type: true } } },
    }),
    customerTerms(companyId),
  ]);
  const summary = {
    BLOG_POST: { sites: new Set<string>(), fromPrice: null as Prisma.Decimal | null },
    HOMEPAGE_LINK: { sites: new Set<string>(), fromPrice: null as Prisma.Decimal | null },
  };
  for (const p of products) {
    const s = summary[p.product.type as LinkType];
    if (!s) continue;
    s.sites.add(p.websiteId);
    const price = priceForCustomer(p.supplierPrice, p.id, terms).price;
    if (!s.fromPrice || price.lt(s.fromPrice)) s.fromPrice = price;
  }
  return {
    BLOG_POST: { sites: summary.BLOG_POST.sites.size, fromPrice: summary.BLOG_POST.fromPrice },
    HOMEPAGE_LINK: { sites: summary.HOMEPAGE_LINK.sites.size, fromPrice: summary.HOMEPAGE_LINK.fromPrice },
  };
}

// A handful of concrete sites to show per type on the dashboard tiles —
// domain, its latest DR, the cheapest price for this customer, and the
// product to deep-link to. Highest-DR first, so the strongest sites lead.
export type OfferSite = { websiteId: string; productId: string; domain: string; dr: number | null; fromPrice: Prisma.Decimal };

export async function offerTopSites(
  companyId?: string | null,
  perType = 3
): Promise<Record<LinkType, OfferSite[]>> {
  const [products, terms] = await Promise.all([
    prisma.websiteProduct.findMany({
      where: { isAvailable: true, website: { status: "ACTIVE" } },
      select: {
        id: true,
        websiteId: true,
        supplierPrice: true,
        product: { select: { type: true } },
        website: {
          select: {
            domain: true,
            metrics: { orderBy: { fetchedAt: "desc" }, take: 1, select: { domainRating: true } },
          },
        },
      },
    }),
    customerTerms(companyId),
  ]);

  // Per type, keep the cheapest product per website.
  const byType: Record<LinkType, Map<string, OfferSite>> = {
    BLOG_POST: new Map(),
    HOMEPAGE_LINK: new Map(),
  };
  for (const p of products) {
    const bucket = byType[p.product.type as LinkType];
    if (!bucket) continue;
    const price = priceForCustomer(p.supplierPrice, p.id, terms).price;
    const existing = bucket.get(p.websiteId);
    if (!existing) {
      bucket.set(p.websiteId, {
        websiteId: p.websiteId,
        productId: p.id,
        domain: p.website.domain,
        dr: p.website.metrics[0]?.domainRating ?? null,
        fromPrice: price,
      });
    } else if (price.lt(existing.fromPrice)) {
      existing.fromPrice = price;
      existing.productId = p.id;
    }
  }
  const pick = (m: Map<string, OfferSite>) =>
    Array.from(m.values())
      .sort((a, b) => (b.dr ?? -1) - (a.dr ?? -1))
      .slice(0, perType);
  return { BLOG_POST: pick(byType.BLOG_POST), HOMEPAGE_LINK: pick(byType.HOMEPAGE_LINK) };
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
