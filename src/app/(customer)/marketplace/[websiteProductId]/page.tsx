import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import OrderForm from "./OrderForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ websiteProductId: string }>;
}): Promise<Metadata> {
  const { websiteProductId } = await params;
  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: websiteProductId },
    select: { website: { select: { domain: true } } },
  });
  return { title: websiteProduct ? `Bestellen: ${websiteProduct.website.domain}` : "Bestellen" };
}

export default async function OrderPage({ params }: { params: Promise<{ websiteProductId: string }> }) {
  const { websiteProductId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: websiteProductId },
    include: {
      website: { include: { category: true, country: true, language: true, wpCategories: { orderBy: { name: "asc" } } } },
      product: true,
    },
  });
  if (!websiteProduct || !websiteProduct.isAvailable || websiteProduct.website.status !== "ACTIVE") {
    notFound();
  }

  const { customerPrice } = await computePriceForWebsiteProduct(websiteProduct.id);

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Bestellen: {websiteProduct.website.domain}</h1>
      <p className="text-sm text-inkSoft mb-6">
        {websiteProduct.product.name} &middot; {websiteProduct.website.category.name} &middot; &euro;
        {customerPrice.toFixed(2)}
      </p>
      <OrderForm
        websiteProductId={websiteProduct.id}
        price={customerPrice.toFixed(2)}
        wpCategories={websiteProduct.website.wpCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
