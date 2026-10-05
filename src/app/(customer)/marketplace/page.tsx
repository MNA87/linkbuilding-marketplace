import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTerms, priceForCustomer, topicStandardPrice } from "@/lib/customerPricing";
import {
  COLUMNS_COOKIE,
  DEFAULT_PER_PAGE,
  PER_PAGE_OPTIONS,
  filterRows,
  parseColumns,
  parseFilters,
  parseSort,
  sortRows,
  type FILTER_KEYS,
} from "@/lib/marketplace";
import MarketplaceTable, { type TableRow } from "./MarketplaceTable";

const TYPES = {
  BLOG_POST: { title: "Blog links" },
  HOMEPAGE_LINK: { title: "Homepage links" },
} as const;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}): Promise<Metadata> {
  const { type } = await searchParams;
  return { title: type === "HOMEPAGE_LINK" ? TYPES.HOMEPAGE_LINK.title : TYPES.BLOG_POST.title };
}

type Params = Partial<Record<(typeof FILTER_KEYS)[number], string>> & {
  type?: string;
  onderwerp?: string;
  sort?: string;
  page?: string;
  per?: string;
  site?: string;
};

// The offer as one table: a column per detail, a filter under each column,
// and above it the topic of the link (only sites that place it, at their
// price for it).
export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const activeType = params.type === "HOMEPAGE_LINK" ? "HOMEPAGE_LINK" : "BLOG_POST";
  const sort = parseSort(params.sort);
  const filters = parseFilters(params);
  const per = (PER_PAGE_OPTIONS as readonly number[]).includes(Number(params.per))
    ? Number(params.per)
    : DEFAULT_PER_PAGE;
  // Prices agreed with this customer, if any (see src/lib/customerPricing.ts).
  const terms = await customerTerms((await getServerSession(authOptions))?.user.companyId);

  const [topics, categories, countries, languages, websites] = await Promise.all([
    prisma.topic.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.country.findMany({ orderBy: { name: "asc" } }),
    prisma.language.findMany({ orderBy: { name: "asc" } }),
    prisma.website.findMany({
      where: { status: "ACTIVE" },
      include: {
        category: true,
        niches: { orderBy: { name: "asc" } },
        country: true,
        language: true,
        metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
        websiteProducts: {
          where: { isAvailable: true, product: { type: activeType } },
          include: { topicPrices: { select: { topicId: true, price: true } } },
        },
      },
    }),
  ]);
  const topic = topics.find((t) => t.id === params.onderwerp) ?? null;

  // The price an admin sets IS the price the customer pays — see the note in
  // src/lib/pricing.ts — unless another price was agreed with this customer.
  // A site sold per year shows its price per year.
  const offered = websites.flatMap((site) =>
    site.websiteProducts.map((wp) => {
      const m = site.metrics[0];
      const standard = topicStandardPrice(wp, topic?.id ?? null);
      const yearly = standard ? priceForCustomer(standard, wp.id, terms, topic?.id ?? null).price.toNumber() : null;
      const blogConfig = wp.config as { maxLinks?: unknown };
      return {
        id: wp.id,
        domain: site.domain,
        createdAt: site.createdAt,
        orders: 0,
        niches: [site.category, ...site.niches.filter((n) => n.id !== site.categoryId)].map((n) => ({
          id: n.id,
          name: n.name,
        })),
        countryId: site.countryId,
        languageId: site.languageId,
        domainRating: m?.domainRating ?? null,
        domainAuthority: m?.domainAuthority ?? null,
        trustFlow: m?.trustFlow ?? null,
        citationFlow: m?.citationFlow ?? null,
        traffic: m?.organicTraffic ?? null,
        maxLinks: site.maxLinks ?? (typeof blogConfig.maxLinks === "number" ? blogConfig.maxLinks : null),
        sponsored: site.sponsored,
        periodic: wp.periodic,
        yearly,
        price: yearly ?? 0,
        site,
        metric: m,
      };
    })
  );
  // With a topic: only the sites that place it.
  const available = offered.filter((r) => r.yearly !== null);
  const sorted = sortRows(filterRows(available, filters), sort);
  // A site opened from the dashboard (?site=) sits on top of the first page.
  const picked = params.site ? sorted.find((r) => r.id === params.site) : undefined;
  const ordered = picked ? [picked, ...sorted.filter((r) => r !== picked)] : sorted;
  const totalPages = Math.max(1, Math.ceil(ordered.length / per));
  const page = Math.min(totalPages, Math.max(1, Number(params.page) || 1));
  const pageItems = ordered.slice((page - 1) * per, page * per);

  const rows: TableRow[] = pageItems.map((r) => ({
    websiteProductId: r.id,
    domain: r.domain,
    niches: r.niches.map((n) => n.name),
    country: r.site.country.name,
    countryCode: r.site.country.code,
    language: r.site.language.name,
    description: r.site.description,
    domainRating: r.domainRating,
    domainAuthority: r.domainAuthority,
    trustFlow: r.trustFlow,
    citationFlow: r.citationFlow,
    traffic: r.traffic,
    referringDomains: r.metric?.referringDomains ?? null,
    ipAddress: r.metric?.ipAddress ?? null,
    behindCloudflare: r.metric?.behindCloudflare ?? false,
    aiCited: r.metric?.aiCited ?? null,
    maxLinks: r.maxLinks,
    sponsored: r.sponsored,
    periodic: r.periodic,
    exampleUrl: r.site.exampleUrl,
    price: r.price,
    yearly: r.yearly ?? 0,
  }));

  return (
    <MarketplaceTable
      title={TYPES[activeType].title}
      type={activeType}
      rows={rows}
      pickedId={picked?.id}
      count={{ shown: sorted.length, offered: offered.length, accepting: available.length }}
      topic={topic ? { id: topic.id, name: topic.name } : null}
      topics={topics.map((t) => ({ id: t.id, name: t.name }))}
      sort={sort}
      page={page}
      totalPages={totalPages}
      per={per}
      niches={categories.map((c) => ({ id: c.id, name: c.name }))}
      countries={countries.map((c) => ({ id: c.id, name: c.name }))}
      languages={languages.map((l) => ({ id: l.id, name: l.name }))}
      initialColumns={parseColumns((await cookies()).get(COLUMNS_COOKIE)?.value)}
    />
  );
}
