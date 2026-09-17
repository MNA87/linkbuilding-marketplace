import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import AdminTestOrderForm from "./AdminTestOrderForm";

export const metadata: Metadata = { title: "Testorder aanmaken" };

export default async function AdminTestOrderPage() {
  const websiteProducts = await prisma.websiteProduct.findMany({
    where: { isAvailable: true, website: { status: "ACTIVE" } },
    include: {
      website: { include: { wpCategories: { where: { kind: "BLOG_POST" }, orderBy: { name: "asc" } } } },
      product: true,
    },
    orderBy: { website: { domain: "asc" } },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Testorder aanmaken</h1>
      <p className="text-sm text-inkSoft mb-6">
        Maakt een order aan die al PAID is — geen Stripe, geen echte klant — zodat je de publicatie- en mailflow
        kan testen. Verschijnt in Admin &rarr; Orders met een &quot;TEST&quot;-label.
      </p>
      <AdminTestOrderForm
        websiteProducts={websiteProducts.map((wp) => ({
          id: wp.id,
          domain: wp.website.domain,
          productName: wp.product.name,
          wpCategories: wp.website.wpCategories.map((c) => ({ id: c.id, name: c.name })),
        }))}
      />
    </div>
  );
}
