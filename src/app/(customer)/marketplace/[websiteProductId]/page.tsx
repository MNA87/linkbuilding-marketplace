import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OrderForm from "./OrderForm";
import HomepageLinkForm from "./HomepageLinkForm";
import { blogUrlTemplate } from "@/lib/wpSlug";
import { pixabayConfigured } from "@/lib/pixabay";

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
  searchParams: Promise<{ orderItemId?: string; nieuw?: string }>;
}) {
  const { websiteProductId } = await params;
  const { orderItemId, nieuw } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: websiteProductId },
    include: {
      website: { include: { category: true, country: true, language: true } },
      product: true,
    },
  });
  if (!websiteProduct || !websiteProduct.isAvailable || websiteProduct.website.status !== "ACTIVE") {
    notFound();
  }

  const { wpPermalinkStructure, wpHomeUrl } = websiteProduct.website;
  // When the site's permalinks don't include the category, a blog category
  // choice changes nothing visible — the plugin files it under "Blog" itself.
  const skipBlogCategory =
    websiteProduct.product.type === "BLOG_POST" &&
    wpPermalinkStructure !== null &&
    !wpPermalinkStructure.includes("%category%");
  // Blog categories and homepage-link rubrieken are separate lists (see
  // WpCategory.kind) — this order form only ever needs one of them.
  const wpCategoryRows = skipBlogCategory
    ? []
    : await prisma.wpCategory.findMany({
        where: { websiteId: websiteProduct.websiteId, kind: websiteProduct.product.type },
        orderBy: { name: "asc" },
      });
  const wpCategories = wpCategoryRows.map((c) => ({ id: c.id, name: c.name }));

  // Filling in the item for something already sitting in the cart — see
  // AddToCartButton, which adds the item empty first — rather than creating
  // a brand new one.
  const orderItemWithOrder = orderItemId
    ? await prisma.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true } })
    : null;
  if (
    orderItemId &&
    (!orderItemWithOrder ||
      orderItemWithOrder.order.customerId !== session.user.id ||
      orderItemWithOrder.order.status !== "NEW" ||
      orderItemWithOrder.websiteProductId !== websiteProductId)
  ) {
    notFound();
  }
  const orderItem = orderItemWithOrder;
  const isHomepageLink = websiteProduct.product.type === "HOMEPAGE_LINK";
  // "Terug" right after "Voeg toe", before anything was saved, means "never
  // mind" — the empty item would otherwise sit in the cart and block checkout.
  const discardOrderItemId =
    nieuw === "1" && orderItem && !(isHomepageLink ? orderItem.targetUrl : orderItem.articleTitle)
      ? orderItem.id
      : undefined;
  const backHref = `/marketplace?type=${websiteProduct.product.type}`;

  // Only wpTermId (the WordPress site's own category id) is snapshotted on
  // the item — look the matching WpCategory row back up by it to get the
  // cuid the <select> below actually uses as its value.
  const wpCategoryId =
    orderItem?.wpTermId != null
      ? (
          await prisma.wpCategory.findFirst({
            where: { websiteId: websiteProduct.websiteId, wpTermId: orderItem.wpTermId, kind: websiteProduct.product.type },
          })
        )?.id ?? ""
      : "";

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Bestellen: {websiteProduct.website.domain}</h1>
      <p className="text-sm text-inkSoft mb-6">{websiteProduct.product.name}</p>
      {websiteProduct.product.type === "HOMEPAGE_LINK" ? (
        <HomepageLinkForm
          websiteProductId={websiteProduct.id}
          wpCategories={wpCategories}
          orderItemId={orderItemId}
          discardOrderItemId={discardOrderItemId}
          backHref={backHref}
          initialDraft={{
            wpCategoryId,
            anchorText: orderItem?.anchorText ?? "",
            targetUrl: orderItem?.targetUrl ?? "",
            nofollow: orderItem?.nofollow ?? false,
          }}
        />
      ) : (
        <OrderForm
          websiteProductId={websiteProduct.id}
          wpCategories={wpCategories}
          blogUrlTemplate={blogUrlTemplate(wpHomeUrl, wpPermalinkStructure)}
          orderItemId={orderItemId}
          discardOrderItemId={discardOrderItemId}
          backHref={backHref}
          initialDraft={{
            wpCategoryId,
            articleTitle: orderItem?.articleTitle ?? "",
            articleBody: orderItem?.articleBody ?? "",
            comments: orderItem?.comments ?? "",
          }}
          initialImageKey={orderItem?.articleImageKey ?? ""}
          photoSearchEnabled={pixabayConfigured()}
        />
      )}
    </div>
  );
}
