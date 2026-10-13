import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CheckoutSteps from "@/components/CheckoutSteps";
import OrderForm from "./OrderForm";
import HomepageLinkForm from "./HomepageLinkForm";
import { blogUrlTemplate } from "@/lib/wpSlug";
import { pixabayConfigured } from "@/lib/pixabay";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { writingFeeFor } from "@/lib/customerPricing";
import {
  amsterdamDay,
  DEFAULT_DURATION_YEARS,
  sanitizePlacementChoice,
  scheduleBounds,
  yearlyPrice,
} from "@/lib/placementPeriod";
import { itemNeedsContent, parseBriefLinks } from "@/lib/writingService";
import { isAwaitingContent } from "@/lib/awaitingContent";
import { CircleCheck } from "lucide-react";

// The order / fill-in screen for one website product. Shared by the full page
// (/marketplace/[id]) and by the popup that intercepts that same route, so the
// form, prices, periods and validation are identical in both. `inModal` only
// tweaks the outer spacing — the popup frame already gives the width.
export default async function OrderPanel({
  websiteProductId,
  orderItemId,
  nieuw,
  stap,
  van,
  inModal = false,
}: {
  websiteProductId: string;
  orderItemId?: string;
  nieuw?: string;
  stap?: string;
  van?: string;
  inModal?: boolean;
}) {
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
  const skipBlogCategory =
    websiteProduct.product.type === "BLOG_POST" &&
    wpPermalinkStructure !== null &&
    !wpPermalinkStructure.includes("%category%");
  const wpCategoryRows = skipBlogCategory
    ? []
    : await prisma.wpCategory.findMany({
        where: { websiteId: websiteProduct.websiteId, kind: websiteProduct.product.type },
        orderBy: { name: "asc" },
      });
  const wpCategories = wpCategoryRows.map((c) => ({ id: c.id, name: c.name }));

  const orderItemWithOrder = orderItemId
    ? await prisma.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true, placement: true } })
    : null;
  const paid =
    orderItemWithOrder !== null &&
    orderItemWithOrder.order.status !== "NEW" &&
    isAwaitingContent(orderItemWithOrder, orderItemWithOrder.order.status, websiteProduct.product.type);
  const marketplaceHref = `/marketplace?type=${websiteProduct.product.type}`;
  if (orderItemId && !orderItemWithOrder) redirect(marketplaceHref);
  if (
    orderItemId &&
    (!orderItemWithOrder ||
      orderItemWithOrder.order.customerId !== session.user.id ||
      (orderItemWithOrder.order.status !== "NEW" && !paid) ||
      orderItemWithOrder.websiteProductId !== websiteProductId)
  ) {
    notFound();
  }
  const orderItem = orderItemWithOrder;
  const isHomepageLink = websiteProduct.product.type === "HOMEPAGE_LINK";
  const discardOrderItemId =
    nieuw === "1" &&
    orderItem &&
    !(isHomepageLink ? orderItem.targetUrl : orderItem.articleTitle || orderItem.writeForMe)
      ? orderItem.id
      : undefined;
  const backHref = paid
    ? `/dashboard/orders/${orderItemWithOrder!.orderId}`
    : orderItemId && nieuw !== "1"
      ? "/dashboard/cart"
      : marketplaceHref;

  const periodic = orderItem ? orderItem.periodic : websiteProduct.periodic;
  const pricePerYear = orderItem
    ? yearlyPrice(orderItem.customerPriceSnap, orderItem.durationYears).toNumber()
    : Number((await computePriceForWebsiteProduct(websiteProduct.id, session.user.companyId)).customerPrice);
  const { min: scheduleMin, max: scheduleMax } = scheduleBounds();
  const placementDraft = sanitizePlacementChoice(
    {
      publishOn: orderItem?.publishAt ? amsterdamDay(orderItem.publishAt) : "",
      durationYears: periodic ? (orderItem?.durationYears ?? DEFAULT_DURATION_YEARS) : DEFAULT_DURATION_YEARS,
    },
    { min: scheduleMin, max: scheduleMax }
  );
  const writingPrice = (await writingFeeFor(session.user.companyId)).toNumber();
  let sequence: { step: number; total: number; nextHref?: string } | null = null;
  const step = Number(stap);
  if (orderItem && Number.isInteger(step) && step >= 1) {
    const siblings = await prisma.orderItem.findMany({
      where: { orderId: orderItem.orderId, id: { not: orderItem.id } },
      include: { websiteProduct: { include: { product: true } } },
      orderBy: { id: "asc" },
    });
    const empty = siblings.filter((s) => !s.renewsOrderItemId && itemNeedsContent(s, s.websiteProduct.product.type));
    const next = empty.find((s) => s.id > orderItem.id) ?? empty[0];
    const total = Math.max(Number(van) || 0, step + empty.length);
    sequence = {
      step,
      total,
      nextHref: next
        ? `/marketplace/${next.websiteProductId}?orderItemId=${next.id}&stap=${step + 1}&van=${total}`
        : undefined,
    };
  }

  const placementProps = { yearlyPrice: pricePerYear, periodic, scheduleMin, scheduleMax };

  const wpCategoryId =
    orderItem?.wpTermId != null
      ? (
          await prisma.wpCategory.findFirst({
            where: {
              websiteId: websiteProduct.websiteId,
              wpTermId: orderItem.wpTermId,
              kind: websiteProduct.product.type,
            },
          })
        )?.id ?? ""
      : "";

  return (
    <div className={inModal ? "" : "max-w-5xl"}>
      {!paid && <CheckoutSteps current={2} />}
      <h1 className="font-serif text-2xl text-ink mb-1">
        {paid ? "Invullen" : "Bestellen"}: {websiteProduct.website.domain}
      </h1>
      <p className="text-sm text-inkSoft mb-6">
        {websiteProduct.product.name}
        {orderItem?.topicNameSnap && ` · ${orderItem.topicNameSnap}`}
        {paid && ` · Order #${orderItemWithOrder!.order.orderNumber}`}
        {sequence && sequence.total > 1 && (
          <span className="ml-2 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-800">
            {paid ? "Link" : "Item"} {sequence.step} van {sequence.total}
          </span>
        )}
      </p>
      {paid && (
        <div className="-mt-2 mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CircleCheck size={18} className="mt-px shrink-0 text-emerald-600" />
          <div>
            <strong className="font-semibold">
              Betaald
              {orderItemWithOrder!.order.paidAt &&
                ` op ${orderItemWithOrder!.order.paidAt.toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "long",
                  timeZone: "Europe/Amsterdam",
                })}`}
              .
            </strong>{" "}
            Vul hieronder je {websiteProduct.product.type === "HOMEPAGE_LINK" ? "link" : "artikel"} in. Zodra je het
            verstuurt, gaan we ermee aan de slag.
          </div>
        </div>
      )}
      {websiteProduct.product.type === "HOMEPAGE_LINK" ? (
        <HomepageLinkForm
          websiteProductId={websiteProduct.id}
          wpCategories={wpCategories}
          orderItemId={orderItemId}
          discardOrderItemId={discardOrderItemId}
          nextHref={sequence?.nextHref}
          backHref={backHref}
          siteDomain={websiteProduct.website.domain}
          paid={paid}
          initialDraft={{
            wpCategoryId,
            anchorText: orderItem?.anchorText ?? "",
            targetUrl: orderItem?.targetUrl ?? "",
            nofollow: orderItem?.nofollow ?? false,
            ...placementDraft,
          }}
          {...placementProps}
        />
      ) : (
        <OrderForm
          websiteProductId={websiteProduct.id}
          wpCategories={wpCategories}
          blogUrlTemplate={blogUrlTemplate(wpHomeUrl, wpPermalinkStructure, websiteProduct.website.articleUrlBase)}
          orderItemId={orderItemId}
          discardOrderItemId={discardOrderItemId}
          nextHref={sequence?.nextHref}
          backHref={backHref}
          siteDomain={websiteProduct.website.domain}
          paid={paid}
          initialDraft={{
            wpCategoryId,
            articleTitle: orderItem?.articleTitle ?? "",
            articleBody: orderItem?.articleBody ?? "",
            comments: orderItem?.comments ?? "",
            writeForMe: orderItem?.writeForMe ?? false,
            briefLinks: parseBriefLinks(orderItem?.briefLinks),
            ...placementDraft,
          }}
          {...placementProps}
          initialImageKey={orderItem?.articleImageKey ?? ""}
          photoSearchEnabled={pixabayConfigured()}
          writingPrice={writingPrice}
        />
      )}
    </div>
  );
}
