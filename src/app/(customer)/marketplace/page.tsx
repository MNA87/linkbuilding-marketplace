import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import type { OrderStatus } from "@prisma/client";
import { ArrowRight, ArrowUpDown, Lock, ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { itemPrice } from "@/lib/writingService";
import { DESKTOP_COLUMNS, isNew, parseSort, popularIds, sortRows, type SortKey } from "@/lib/marketplace";
import MarketplaceToolbar from "./MarketplaceToolbar";
import SiteRow, { type SiteRowData } from "./SiteRow";

const PAGE_SIZE = 20;

const TYPES = {
  BLOG_POST: { title: "Blog links" },
  HOMEPAGE_LINK: { title: "Homepage links" },
} as const;

// Orders that count towards "Populair": paid and not cancelled.
const PAID: OrderStatus[] = ["PAID", "SENT_TO_PUBLISHER", "ACCEPTED", "IN_PROGRESS", "PUBLISHED", "VERIFICATION", "COMPLETED"];

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}): Promise<Metadata> {
  const { type } = await searchParams;
  return { title: type === "HOMEPAGE_LINK" ? TYPES.HOMEPAGE_LINK.title : TYPES.BLOG_POST.title };
}

type Params = {
  type?: string;
  category?: string;
  country?: string;
  language?: string;
  minDr?: string;
  maxPrice?: string;
  q?: string;
  sort?: string;
  page?: string;
};

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const activeType = params.type === "HOMEPAGE_LINK" ? "HOMEPAGE_LINK" : "BLOG_POST";
  const sort = parseSort(params.sort);
  const minDr = params.minDr ? Number(params.minDr) : undefined;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const [categories, countries, languages, websites, orderCounts, cartItems, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.country.findMany({ orderBy: { name: "asc" } }),
    prisma.language.findMany({ orderBy: { name: "asc" } }),
    prisma.website.findMany({
      where: {
        status: "ACTIVE",
        categoryId: params.category || undefined,
        countryId: params.country || undefined,
        languageId: params.language || undefined,
        domain: params.q ? { contains: params.q.trim(), mode: "insensitive" } : undefined,
      },
      include: {
        category: true,
        country: true,
        language: true,
        metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
        websiteProducts: { where: { isAvailable: true, product: { type: activeType } } },
      },
    }),
    prisma.orderItem.groupBy({
      by: ["websiteProductId"],
      where: { renewsOrderItemId: null, order: { status: { in: PAID } } },
      _count: { _all: true },
    }),
    session
      ? prisma.orderItem.findMany({
          where: { order: { customerId: session.user.id, status: "NEW" } },
          select: { websiteProductId: true, renewsOrderItemId: true, customerPriceSnap: true, writingFeeSnap: true },
        })
      : Promise.resolve([]),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { writingPrice: true } }),
  ]);

  const ordersByProduct = new Map(orderCounts.map((c) => [c.websiteProductId, c._count._all]));
  const inCart = new Set(cartItems.filter((i) => !i.renewsOrderItemId).map((i) => i.websiteProductId));
  const cartTotal = cartItems.reduce((sum, i) => sum + itemPrice(i).toNumber(), 0);

  // The price an admin sets on a product IS the price the customer pays —
  // see the matching note in src/lib/pricing.ts.
  const all = websites.flatMap((site) =>
    site.websiteProducts.map((wp) => {
      const m = site.metrics[0];
      return {
        id: wp.id,
        domain: site.domain,
        createdAt: site.createdAt,
        orders: ordersByProduct.get(wp.id) ?? 0,
        price: wp.supplierPrice.toNumber(),
        domainRating: m?.domainRating ?? null,
        traffic: m?.organicTraffic ?? null,
        row: {
          websiteProductId: wp.id,
          domain: site.domain,
          category: site.category.name,
          language: site.language.name,
          country: site.country.name,
          description: site.description,
          domainRating: m?.domainRating ?? null,
          domainAuthority: m?.domainAuthority ?? null,
          traffic: m?.organicTraffic ?? null,
          referringDomains: m?.referringDomains ?? null,
          price: wp.supplierPrice.toNumber(),
          popular: false,
          isNew: isNew(site.createdAt),
          inCart: inCart.has(wp.id),
        } satisfies SiteRowData,
      };
    })
  );
  const popular = popularIds(all);
  const filtered = all.filter(
    (r) => (minDr === undefined || (r.domainRating ?? 0) >= minDr) && (maxPrice === undefined || r.price <= maxPrice)
  );
  const sorted = sortRows(filtered, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const writingPrice = Number(settings?.writingPrice ?? 25);

  const hrefWith = (changes: Record<string, string>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("type", activeType);
    for (const [k, v] of Object.entries(changes)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    return `/marketplace?${sp.toString()}`;
  };
  // Clicking a column header sorts by it.
  const sortHeader = (label: string, key: SortKey) => (
    <Link
      href={hrefWith({ sort: key, page: "" })}
      className={`inline-flex items-center justify-center gap-1 hover:text-ink ${sort === key ? "text-ink" : ""}`}
    >
      {label}
      <ArrowUpDown size={11} />
    </Link>
  );

  return (
    <div className="max-w-6xl pb-4">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink">{TYPES[activeType].title}</h1>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-inkSoft">
          {sorted.length} {sorted.length === 1 ? "website" : "websites"}
        </span>
      </div>

      <MarketplaceToolbar
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        countries={countries.map((c) => ({ id: c.id, name: c.name }))}
        languages={languages.map((l) => ({ id: l.id, name: l.name }))}
      />

      <div className={`hidden md:grid ${DESKTOP_COLUMNS} gap-x-3 items-center px-5 pt-5 pb-1 text-xs font-medium text-inkSoft`}>
        <span>Website</span>
        <span className="text-center">{sortHeader("DR", "dr")}</span>
        <span className="text-center">{sortHeader("Verkeer/mnd", "verkeer")}</span>
        <span className="text-center">{sortHeader("Prijs", sort === "prijs-laag" ? "prijs-hoog" : "prijs-laag")}</span>
        <span />
        <span />
      </div>

      {pageItems.map((r) => (
        <SiteRow
          key={r.id}
          site={{ ...r.row, popular: popular.has(r.id) }}
          type={activeType}
          writingPrice={writingPrice}
        />
      ))}
      {sorted.length === 0 && (
        <div className="mt-4 bg-surface border border-line rounded-xl px-5 py-10 text-center text-sm text-inkSoft">
          Geen websites gevonden voor deze zoekopdracht.
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-5 text-sm">
          {page > 1 ? (
            <Link href={hrefWith({ page: String(page - 1) })} className="text-brand hover:underline">
              ← Vorige
            </Link>
          ) : (
            <span className="text-inkSoft/40">← Vorige</span>
          )}
          <span className="text-inkSoft">
            Pagina {page} van {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefWith({ page: String(page + 1) })} className="text-brand hover:underline">
              Volgende →
            </Link>
          ) : (
            <span className="text-inkSoft/40">Volgende →</span>
          )}
        </div>
      )}

      {cartItems.length > 0 && (
        <div className="sticky bottom-4 mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-lg">
          <ShoppingCart size={18} />
          <span className="text-sm">
            <b>
              {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
            </b>{" "}
            in je mandje · <b>€{cartTotal.toFixed(2)}</b> <span className="text-white/60">excl. BTW</span>
          </span>
          <span className="flex-1" />
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-white/60">
            <Lock size={12} />
            Veilig betalen met iDEAL · factuur met BTW
          </span>
          <Link href="/dashboard/cart" className="btn-pay inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold">
            Afrekenen <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </div>
  );
}
