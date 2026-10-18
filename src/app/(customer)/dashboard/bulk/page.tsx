import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { scheduleBounds } from "@/lib/placementPeriod";
import BulkOrder, { type BulkSite, type BulkProject, type BulkCartItem } from "./BulkOrder";

export const metadata: Metadata = { title: "Blog links" };

// The agency bulk-order flow: pick articles per site, assign each to a project
// (the agency's own client), and place them in one go — on account, onto the
// monthly verzamelfactuur. Only for a customer whose company has bulk-besteller
// turned on (Admin → Klanten → klant). See docs/nice-to-have/agency-module.md.
export default async function BulkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ prijzen?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) redirect("/login");
  const { prijzen } = await searchParams;

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { bulkOrdering: true },
  });

  if (!company?.bulkOrdering) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-serif text-2xl text-ink">Blog links</h1>
        <div className="mt-4 rounded-xl border border-line bg-surface p-6 text-sm text-inkSoft">
          Bulk bestellen staat niet aan voor dit account. Neem contact met ons op als je als bureau meerdere links tegelijk
          wilt bestellen.
        </div>
      </div>
    );
  }

  const [projects, websites, topics, cartItems] = await Promise.all([
    prisma.project.findMany({
      where: { customerCompanyId: session.user.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    prisma.website.findMany({
      where: { status: "ACTIVE", websiteProducts: { some: { isAvailable: true, product: { type: "BLOG_POST" } } } },
      include: {
        category: { select: { id: true, name: true } },
        niches: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        country: { select: { name: true, code: true } },
        language: { select: { name: true } },
        metrics: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: {
            domainRating: true,
            domainAuthority: true,
            trustFlow: true,
            citationFlow: true,
            organicTraffic: true,
            referringDomains: true,
            ipAddress: true,
            behindCloudflare: true,
            aiCited: true,
          },
        },
        websiteProducts: {
          where: { isAvailable: true, product: { type: "BLOG_POST" } },
          select: { id: true, config: true, periodic: true },
          take: 1,
        },
      },
      orderBy: { domain: "asc" },
    }),
    prisma.topic.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    // What this customer has already built up in the cart (the bulk order in
    // progress). The +/- on the list adds/removes these items so the top-bar
    // cart badge reacts; the order is finalised on account at "Bestellen".
    prisma.orderItem.findMany({
      where: { order: { customerId: session.user.id, status: "NEW" } },
      select: { id: true, websiteProductId: true, customerPriceSnap: true, draftContent: true },
    }),
  ]);

  // "Prijzen voor": Algemeen, or a chosen onderwerp (crypto, …) at that topic's
  // price. A site that doesn't place the chosen onderwerp drops out of the list.
  const selectedTopic = prijzen ? topics.find((t) => t.id === prijzen) ?? null : null;

  // Prices of sites already in the cart stay as snapshotted when they were
  // added — so switching "Prijzen voor" never silently reprices or hides a
  // site that's already in the bulk order.
  const cartSnapByWp = new Map<string, number>();
  for (const ci of cartItems) {
    if (!cartSnapByWp.has(ci.websiteProductId)) cartSnapByWp.set(ci.websiteProductId, Number(ci.customerPriceSnap));
  }

  // Build the orderable list, pricing each site for this customer and the chosen
  // onderwerp. A site whose price can't be determined for this onderwerp is left
  // out — unless it's already in the cart, where it's shown at its snapshot price.
  const sites: BulkSite[] = [];
  for (const w of websites) {
    const wp = w.websiteProducts[0];
    if (!wp) continue;
    let price: number;
    try {
      price = Number((await computePriceForWebsiteProduct(wp.id, session.user.companyId, selectedTopic?.id ?? null)).customerPrice);
    } catch {
      const snap = cartSnapByWp.get(wp.id);
      if (snap === undefined) continue;
      price = snap;
    }
    const config = wp.config as { maxLinks?: unknown };
    const maxLinks = w.maxLinks ?? (typeof config.maxLinks === "number" ? config.maxLinks : 1);
    const m = w.metrics[0];
    const niches = [w.category?.name, ...w.niches.filter((n) => n.id !== w.categoryId).map((n) => n.name)].filter(
      (n): n is string => Boolean(n)
    );
    sites.push({
      id: wp.id,
      domain: w.domain,
      niche: w.category?.name ?? "—",
      niches,
      country: w.country?.name ?? "—",
      countryCode: w.country?.code ?? "",
      language: w.language?.name ?? "—",
      description: w.description ?? null,
      exampleUrl: w.exampleUrl ?? null,
      sponsored: w.sponsored,
      dr: m?.domainRating ?? null,
      da: m?.domainAuthority ?? null,
      trustFlow: m?.trustFlow ?? null,
      citationFlow: m?.citationFlow ?? null,
      traffic: m?.organicTraffic ?? null,
      referringDomains: m?.referringDomains ?? null,
      ipAddress: m?.ipAddress ?? null,
      behindCloudflare: m?.behindCloudflare ?? false,
      aiCited: m?.aiCited ?? null,
      maxLinks: Math.max(1, maxLinks),
      periodic: wp.periodic,
      price,
    });
  }

  const projectList: BulkProject[] = projects.map((p) => ({ id: p.id, name: p.name }));

  // Only cart items whose site is in the orderable list — anything else can't be
  // shown or finalised meaningfully (e.g. a site that went offline).
  const siteIds = new Set(sites.map((s) => s.id));
  const initialCart: BulkCartItem[] = cartItems
    .filter((ci) => siteIds.has(ci.websiteProductId))
    .map((ci) => ({
      orderItemId: ci.id,
      websiteProductId: ci.websiteProductId,
      draft: (ci.draftContent as BulkCartItem["draft"]) ?? null,
    }));

  return (
    <BulkOrder
      sites={sites}
      projects={projectList}
      schedule={scheduleBounds()}
      topics={topics}
      topicId={selectedTopic?.id ?? ""}
      initialCart={initialCart}
    />
  );
}
