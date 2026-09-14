import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import MarketplaceFilters from "./MarketplaceFilters";

const DEFAULT_MARGIN_PERCENT = 30;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; country?: string; language?: string; minDr?: string; maxPrice?: string }>;
}) {
  const params = await searchParams;
  const [categories, countries, languages] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.country.findMany({ orderBy: { name: "asc" } }),
    prisma.language.findMany({ orderBy: { name: "asc" } }),
  ]);

  const minDr = params.minDr ? Number(params.minDr) : undefined;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : undefined;

  const websites = await prisma.website.findMany({
    where: {
      status: "ACTIVE",
      categoryId: params.category || undefined,
      countryId: params.country || undefined,
      languageId: params.language || undefined,
      ...(minDr !== undefined
        ? { metrics: { some: { domainRating: { gte: minDr } } } }
        : {}),
    },
    include: {
      category: true,
      country: true,
      language: true,
      metrics: { orderBy: { fetchedAt: "desc" }, take: 1 },
      websiteProducts: { where: { isAvailable: true }, include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pricingRules = await prisma.pricingRule.findMany();

  const rows = websites.flatMap((site) =>
    site.websiteProducts.map((wp) => {
      const rule =
        pricingRules.find((r) => r.websiteProductId === wp.id) ??
        pricingRules.find((r) => r.categoryId === site.categoryId);
      const customerPrice = rule?.manualCustomerPrice
        ? rule.manualCustomerPrice
        : wp.supplierPrice.mul(
            (rule?.defaultMarginPercent ?? new Decimal(DEFAULT_MARGIN_PERCENT)).div(100).add(1)
          );

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

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink mb-1">Marketplace</h1>
      <p className="text-sm text-inkSoft mb-6">{filtered.length} beschikbare plaatsingen.</p>

      <MarketplaceFilters
        categories={categories}
        countries={countries}
        languages={languages}
        current={params}
      />

      <div className="mt-6 bg-surface border border-line rounded-lg overflow-hidden">
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
            {filtered.map((row) => (
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
                  <Link
                    href={`/marketplace/${row.websiteProductId}`}
                    className="text-brand text-sm hover:underline"
                  >
                    Toevoegen
                  </Link>
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
    </div>
  );
}
