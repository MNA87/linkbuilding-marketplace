import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { customerTerms, priceForCustomer } from "@/lib/customerPricing";
import { REMINDER_DAYS_BEFORE, periodItemWhere } from "@/lib/placementPeriod";
import { isAwaitingContent } from "@/lib/awaitingContent";
import { itemPrice } from "@/lib/writingService";
import { linkStatus, orderStatus, type LinkStage } from "@/lib/customerOrders";

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

// De nieuwste actieve websites met beschikbaar aanbod — voor het "Openstaand
// aanbod / Nieuwe sites"-blok op het dashboard. Per site de goedkoopste
// beschikbare variant (type + vanaf-prijs + product om naar te linken) en de
// laatste DR.
export type NewSite = { websiteId: string; productId: string; domain: string; niche: string; dr: number | null; da: number | null; traffic: number | null; type: LinkType; fromPrice: Prisma.Decimal };

export async function newestSites(companyId?: string | null, limit = 3): Promise<NewSite[]> {
  const [websites, terms] = await Promise.all([
    prisma.website.findMany({
      where: { status: "ACTIVE", websiteProducts: { some: { isAvailable: true } } },
      orderBy: { createdAt: "desc" },
      take: limit * 3,
      select: {
        id: true,
        domain: true,
        category: { select: { name: true } },
        metrics: { orderBy: { fetchedAt: "desc" }, take: 1, select: { domainRating: true, domainAuthority: true, organicTraffic: true } },
        websiteProducts: {
          where: { isAvailable: true },
          select: { id: true, supplierPrice: true, product: { select: { type: true } } },
        },
      },
    }),
    customerTerms(companyId),
  ]);

  const out: NewSite[] = [];
  for (const w of websites) {
    let best: { price: Prisma.Decimal; productId: string; type: LinkType } | null = null;
    for (const p of w.websiteProducts) {
      const price = priceForCustomer(p.supplierPrice, p.id, terms).price;
      if (!best || price.lt(best.price)) best = { price, productId: p.id, type: p.product.type as LinkType };
    }
    if (!best) continue;
    out.push({
      websiteId: w.id,
      productId: best.productId,
      domain: w.domain,
      niche: w.category?.name ?? "—",
      dr: w.metrics[0]?.domainRating ?? null,
      da: w.metrics[0]?.domainAuthority ?? null,
      traffic: w.metrics[0]?.organicTraffic ?? null,
      type: best.type,
      fromPrice: best.price,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// De laatste orders van de klant voor het dashboard — één regel per order
// (zoals in Mijn orders), met de samengevatte status, het domein, hoeveel
// links de order telt en het bedrag. Verlengingen (renewsOrderItemId) tellen
// niet als eigen order; orders in het mandje (status NEW) ook niet.
export type RecentOrder = {
  id: string;
  orderNumber: number;
  kind: LinkType;
  domain: string;
  extra: number;
  stage: LinkStage;
  stageLabel: string;
  amount: number;
  date: Date;
  project: string;
  // Actiegerichte extra's: waar de link live staat, de verwachte online-datum
  // (bij ingepland), en of de order op inhoud van de klant wacht.
  liveUrl: string | null;
  plannedLabel: string | null;
  needsContent: boolean;
};

export async function recentOrders(customerId: string, limit = 4): Promise<RecentOrder[]> {
  const orders = await prisma.order.findMany({
    where: {
      customerId,
      status: { not: "NEW" },
      items: { some: { renewsOrderItemId: null } },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
    include: {
      items: {
        include: { websiteProduct: { include: { website: true, product: true } }, placement: true, project: { select: { name: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  const now = new Date();
  const rows = orders.map((order) => {
    const links = order.items
      .filter((i) => !i.renewsOrderItemId)
      .map((item) =>
        linkStatus(
          {
            ...item,
            orderStatus: order.status,
            periodic: item.periodic,
            needsContent: isAwaitingContent(item, order.status, item.websiteProduct.product.type),
          },
          now
        )
      );
    const summary = orderStatus(links.map((l) => l.stage));
    const first = order.items.find((i) => !i.renewsOrderItemId);
    // Project(en) van de order: één naam, "Meerdere" als het er meer zijn, of
    // "—" als er geen project aan hangt.
    const projectNames = Array.from(
      new Set(order.items.filter((i) => !i.renewsOrderItemId && i.project).map((i) => i.project!.name))
    );
    const project = projectNames.length === 0 ? "—" : projectNames.length === 1 ? projectNames[0] : "Meerdere";
    const active = order.items.filter((i) => !i.renewsOrderItemId);
    const liveUrl = active.map((i) => i.placement).find((p) => p && p.liveUrl && p.status !== "expired")?.liveUrl ?? null;
    const nextPublish = active
      .map((i) => i.publishAt)
      .filter((d): d is Date => d != null && d > now)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const shortDay = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });
    const plannedLabel = summary.stage === "ingepland" && nextPublish ? `~${shortDay(nextPublish)}` : null;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      kind: (first?.websiteProduct.product.type === "HOMEPAGE_LINK" ? "HOMEPAGE_LINK" : "BLOG_POST") as LinkType,
      domain: first?.websiteProduct.website.domain ?? "—",
      extra: Math.max(0, links.length - 1),
      stage: summary.stage,
      stageLabel: summary.label,
      amount: order.items.reduce((sum, i) => sum + itemPrice(i).toNumber(), 0),
      date: order.paidAt ?? order.createdAt,
      project,
      liveUrl,
      plannedLabel,
      needsContent: summary.stage === "wacht",
    };
  });

  rows.sort((a, b) => b.date.getTime() - a.date.getTime() || b.orderNumber - a.orderNumber);
  return rows.slice(0, limit);
}

// Factuur-overzicht voor het dashboard: openstaande (verzamel)facturen —
// aantal, totaalbedrag en de eerste vervaldatum — plus wat er dit jaar
// besteed is (som van de gewone facturen van dit kalenderjaar).
export async function invoiceSummary(companyId?: string | null): Promise<{
  openCount: number;
  openAmount: Prisma.Decimal;
  dueAt: Date | null;
  overdue: boolean;
  spentThisYear: Prisma.Decimal;
}> {
  const zero = new Prisma.Decimal(0);
  if (!companyId) return { openCount: 0, openAmount: zero, dueAt: null, overdue: false, spentThisYear: zero };
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const [open, spent] = await Promise.all([
    prisma.invoice.findMany({
      where: { customerCompanyId: companyId, type: "INVOICE", paidAt: null, dueAt: { not: null } },
      select: { amount: true, dueAt: true },
      orderBy: { dueAt: "asc" },
    }),
    prisma.invoice.aggregate({
      where: { customerCompanyId: companyId, type: "INVOICE", issuedAt: { gte: yearStart } },
      _sum: { amount: true },
    }),
  ]);
  const openAmount = open.reduce((s, i) => s.add(i.amount), zero);
  const dueAt = open[0]?.dueAt ?? null;
  return {
    openCount: open.length,
    openAmount,
    dueAt,
    overdue: dueAt != null && dueAt < now,
    spentThisYear: spent._sum.amount ?? zero,
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
