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

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ websiteProductId: string }>;
  searchParams: Promise<{ orderItemId?: string }>;
}) {
  const { websiteProductId } = await params;
  const { orderItemId } = await searchParams;
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

  // Filling in the article for an item already sitting in the cart — see
  // AddToCartButton, which adds the item empty first — rather than creating
  // a brand new one.
  let initialDraft: {
    wpCategoryId: string;
    articleTitle: string;
    articleBody: string;
    comments: string;
  } | null = null;
  let initialImageKey = "";
  if (orderItemId) {
    const item = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    });
    if (!item || item.order.customerId !== session.user.id || item.order.status !== "NEW" || item.websiteProductId !== websiteProductId) {
      notFound();
    }
    // Only wpTermId (the WordPress site's own category id) is snapshotted on
    // the item — look the matching WpCategory row back up by it to get the
    // cuid the <select> below actually uses as its value.
    const wpCategory =
      item.wpTermId !== null
        ? await prisma.wpCategory.findFirst({
            where: { websiteId: websiteProduct.websiteId, wpTermId: item.wpTermId },
          })
        : null;
    initialDraft = {
      wpCategoryId: wpCategory?.id ?? "",
      articleTitle: item.articleTitle ?? "",
      articleBody: item.articleBody ?? "",
      comments: item.comments ?? "",
    };
    initialImageKey = item.articleImageKey ?? "";
  }

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
        orderItemId={orderItemId}
        initialDraft={initialDraft ?? undefined}
        initialImageKey={initialImageKey}
      />
    </div>
  );
}
