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
  // A just-added item is already in the cart (as "Actie nodig"); leaving the
  // form keeps it, so there's nothing to discard — freshAdd only picks the
  // quieter button's label ("Verder winkelen" vs "Opslaan").
  const freshAdd = nieuw === "1";
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

  // The niches (topics) this site offers, each with its price per year, so the
  // popup can prefill the niche (from the marketplace filter) and re-price it
  // when the customer changes it. Always includes Algemeen (no topic).
  const allTopics = await prisma.topic.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const nicheCandidates = [{ id: "", name: "Algemeen" }, ...allTopics.map((t) => ({ id: t.id, name: t.name }))];
  const nicheOptions: { id: string; name: string; yearly: number }[] = [];
  for (const c of nicheCandidates) {
    try {
      const p = await computePriceForWebsiteProduct(websiteProduct.id, session.user.companyId, c.id || null);
      nicheOptions.push({ id: c.id, name: c.name, yearly: Number(p.customerPrice) });
    } catch {
      // This site doesn't offer that niche — leave it out of the dropdown.
    }
  }
  const currentTopicId = orderItem?.topicId ?? "";

  // The customer's stored "Later aanleveren" choice. Reopening such an item
  // shows that choice again (no title/online-date asked). Not for a paid item:
  // there the customer is filling it in now, so it starts on "Zelf aanleveren".
  const deliverLater = !paid && (orderItem?.deliverLater ?? false);

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
      {/* The 1·2·3 steps stay in both views. The domain, product and price ride
          in the form's own clean header row — the same in the popup and on the
          full page — so there's no separate page heading to drift out of sync. */}
      {!paid && (
        <div className={inModal ? "mb-5" : "mb-6"}>
          <CheckoutSteps current={2} />
        </div>
      )}
      {sequence && sequence.total > 1 && (
        <p className="mb-4">
          <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-800">
            {paid ? "Link" : "Item"} {sequence.step} van {sequence.total}
          </span>
        </p>
      )}
      {paid && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
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
              {" · "}Order #{orderItemWithOrder!.order.orderNumber}.
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
          freshAdd={freshAdd}
          nextHref={sequence?.nextHref}
          backHref={backHref}
          siteDomain={websiteProduct.website.domain}
          paid={paid}
          nicheOptions={nicheOptions}
          currentTopicId={currentTopicId}
          headerDomain={websiteProduct.website.domain}
          productLabel={websiteProduct.product.name}
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
          freshAdd={freshAdd}
          nextHref={sequence?.nextHref}
          backHref={backHref}
          siteDomain={websiteProduct.website.domain}
          paid={paid}
          nicheOptions={nicheOptions}
          currentTopicId={currentTopicId}
          headerDomain={websiteProduct.website.domain}
          productLabel={websiteProduct.product.name}
          initialDraft={{
            wpCategoryId,
            articleTitle: orderItem?.articleTitle ?? "",
            articleBody: orderItem?.articleBody ?? "",
            comments: orderItem?.comments ?? "",
            writeForMe: orderItem?.writeForMe ?? false,
            briefLinks: parseBriefLinks(orderItem?.briefLinks),
            articleMode: orderItem?.articleDocUrl ? "googledoc" : deliverLater ? "later" : "text",
            articleDocUrl: orderItem?.articleDocUrl ?? "",
            docPublicConfirm: Boolean(orderItem?.articleDocUrl),
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
