import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import CategoryMarginRow from "./CategoryMarginRow";
import ManualPriceRow from "./ManualPriceRow";

export const metadata: Metadata = { title: "Prijzen" };

export default async function AdminPricingPage() {
  const [categories, pricingRules, websiteProducts] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.pricingRule.findMany(),
    prisma.websiteProduct.findMany({
      include: { website: true, product: true },
      orderBy: { website: { domain: "asc" } },
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Prijzen & marges</h1>
      <p className="text-sm text-inkSoft mb-6">
        Standaardmarge per categorie (valt terug op 30% als er geen regel is), of een handmatige klantprijs per
        product — die wint altijd van het percentage.
      </p>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Categorie</th>
              <th className="px-4 py-2 font-medium">Standaardmarge (%)</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const rule = pricingRules.find((r) => r.categoryId === c.id && !r.websiteProductId);
              return (
                <CategoryMarginRow
                  key={c.id}
                  categoryId={c.id}
                  categoryName={c.name}
                  currentMargin={rule?.defaultMarginPercent.toNumber() ?? 30}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="font-medium text-ink mb-3">Handmatige prijs per product</h2>
      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brandSoft/50 text-inkSoft text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Website</th>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Inkoopprijs</th>
              <th className="px-4 py-2 font-medium">Handmatige klantprijs</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {websiteProducts.map((wp) => {
              const rule = pricingRules.find((r) => r.websiteProductId === wp.id);
              return (
                <ManualPriceRow
                  key={wp.id}
                  websiteProductId={wp.id}
                  domain={wp.website.domain}
                  productName={wp.product.name}
                  supplierPrice={wp.supplierPrice.toFixed(2)}
                  currentManualPrice={rule?.manualCustomerPrice?.toFixed(2) ?? ""}
                />
              );
            })}
            {websiteProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-inkSoft">
                  Nog geen producten.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
