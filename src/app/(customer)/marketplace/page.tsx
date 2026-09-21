import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import MarketplaceFilters from "./MarketplaceFilters";
import AddToCartButton from "./AddToCartButton";

const PAGE_SIZE = 20;

export const metadata: Metadata = { title: "Marketplace" };

const TABS = [
  { type: "BLOG_POST", label: "Blog links" },
  { type: "HOMEPAGE_LINK", label: "Homepage links" },
] as const;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    category?: string;
    country?: string;
    language?: string;
    minDr?: string;
    maxPrice?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const activeType = params.type === "HOMEPAGE_LINK" ? "HOMEPAGE_LINK" : "BLOG_POST";
  const [categories, countries, languages] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.country.findMany({ orderBy: { name: "asc" } }),
    prisma.language.findMany({ orderBy: { name: "asc" } }),
  ]);

  const minDr = params.minDr ? Number(params.minDr) : undefined;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const websites = await prisma.website.findMany({
    where: {
      status: "ACTIVE",
      categoryId: params.category || undefined,
      countryId: params.country || undefined,
      languageId: params.language || undefined,
      domain: params.q ? { contains: params.q, mode: "insensitive" } : undefined,
      ...(minDr !== undefined
        ? { metrics: { some: { domainRating: { gte: minDr } } } }
        : {}),
    },
    include: {
      category: true,
      country: true,
      language: true,
      metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
      websiteProducts: {
        where: { isAvailable: true, product: { type: activeType } },
        include: { product: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // The price an admin sets on a product IS the price the customer pays —
  // see the matching note in src/lib/pricing.ts.
  const rows = websites.flatMap((site) =>
    site.websiteProducts.map((wp) => {
      const customerPrice = wp.supplierPrice;

      return {
        websiteProductId: wp.id,
        domain: site.domain,
        category: site.category.name,
        country: site.country.name,
        language: site.language.name,
        domainRating: site.metrics[0]?.domainRating ?? null,
        productName: wp.product.name,
        customerPrice,
      };
    })
  );

  const filtered = maxPrice !== undefined ? rows.filter((r) => r.customerPrice.lte(maxPrice)) : rows;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    sp.set("type", activeType);
    if (params.category) sp.set("category", params.category);
    if (params.country) sp.set("country", params.country);
    if (params.language) sp.set("language", params.language);
    if (params.minDr) sp.set("minDr", params.minDr);
    if (params.maxPrice) sp.set("maxPrice", params.maxPrice);
    if (params.q) sp.set("q", params.q);
    sp.set("page", String(p));
    return `/marketplace?${sp.toString()}`;
  };

  const tabHref = (type: string) => {
    const sp = new URLSearchParams();
    sp.set("type", type);
    if (params.category) sp.set("category", params.category);
    if (params.country) sp.set("country", params.country);
    if (params.language) sp.set("language", params.language);
    if (params.minDr) sp.set("minDr", params.minDr);
    if (params.maxPrice) sp.set("maxPrice", params.maxPrice);
    if (params.q) sp.set("q", params.q);
    return `/marketplace?${sp.toString()}`;
  };

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Marketplace</h1>
      <p className="text-sm text-inkSoft mb-6">Kies het type link en vind meteen de juiste website.</p>

      <div className="flex gap-1 border-b border-line mb-6">
        {TABS.map((tab) => (
          <Link
            key={tab.type}
            href={tabHref(tab.type)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeType === tab.type
                ? "border-brand text-brand"
                : "border-transparent text-inkSoft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <p className="text-sm text-inkSoft mb-4">{filtered.length} beschikbare plaatsingen.</p>

      <MarketplaceFilters
        categories={categories}
        countries={countries}
        languages={languages}
        current={params}
      />

      <div className="mt-6 bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Domein</th>
              <th className="px-4 py-2 font-medium">Categorie</th>
              <th className="px-4 py-2 font-medium">Land / Taal</th>
              <th className="px-4 py-2 font-medium">DR</th>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Prijs</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => (
              <tr key={row.websiteProductId} className="border-t border-line">
                <td className="px-4 py-3 text-ink font-medium">{row.domain}</td>
                <td className="px-4 py-3 text-inkSoft">{row.category}</td>
                <td className="px-4 py-3 text-inkSoft">
                  {row.country} / {row.language}
                </td>
                <td className="px-4 py-3 text-inkSoft">{row.domainRating ?? "-"}</td>
                <td className="px-4 py-3 text-inkSoft">{row.productName}</td>
                <td className="px-4 py-3 text-ink font-medium">
                  &euro;{row.customerPrice.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <AddToCartButton websiteProductId={row.websiteProductId} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-inkSoft">
                  Geen websites gevonden voor deze filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-brand hover:underline">
              &larr; Vorige
            </Link>
          ) : (
            <span className="text-inkSoft/40">&larr; Vorige</span>
          )}
          <span className="text-inkSoft">
            Pagina {page} van {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="text-brand hover:underline">
              Volgende &rarr;
            </Link>
          ) : (
            <span className="text-inkSoft/40">Volgende &rarr;</span>
          )}
        </div>
      )}
    </div>
  );
}
