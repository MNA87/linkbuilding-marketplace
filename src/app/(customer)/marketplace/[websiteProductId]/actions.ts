"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { createOrderSchema } from "@/lib/validations/order";
import { extractLinkFromBody } from "@/lib/wordpress";
import { sanitizeArticleBody } from "@/lib/sanitizeArticle";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { durationYearsSchema, priceForYears, publishAtFromDay, publishOnField, yearlyPrice } from "@/lib/placementPeriod";

// Snapshots for the chosen period, from yearly prices.
function periodPrices(yearlySupplier: Prisma.Decimal, yearlyCustomer: Prisma.Decimal, years: number) {
  return {
    supplierPriceSnap: priceForYears(yearlySupplier, years),
    customerPriceSnap: priceForYears(yearlyCustomer, years),
    durationYears: years,
  };
}

// An item's snapshots are for its current period; switching period
// recalculates from the price per year.
function repriceItem(
  item: { supplierPriceSnap: Prisma.Decimal; customerPriceSnap: Prisma.Decimal; durationYears: number },
  years: number
) {
  return periodPrices(
    yearlyPrice(item.supplierPriceSnap, item.durationYears),
    yearlyPrice(item.customerPriceSnap, item.durationYears),
    years
  );
}

const publishAtFrom = (publishOn: string) => (publishOn ? publishAtFromDay(publishOn) : null);

export type AddToCartState = { error: string | null; success: boolean; orderId?: string };

// Adds an item to the customer's cart. A "cart" is just an Order with
// status NEW — there's one active cart per project, items get appended to
// it until checkout. Every customer company gets a single shared project
// (created lazily here) since the order form no longer asks for one.
export async function addToCartAction(input: unknown): Promise<AddToCartState> {
  const session = await getServerSession(authOptions);
  // Explicit role check — never rely on middleware alone for anything that
  // touches money or creates orders on someone's behalf.
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const sanitizedBody = sanitizeArticleBody(data.articleBody);

  // A link is optional — the customer can place one themselves in the
  // article text (select text, click the link icon), but an order without
  // one is perfectly valid too.
  const link = extractLinkFromBody(sanitizedBody);

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: data.websiteProductId },
    include: { website: { include: { company: true } } },
  });
  if (!websiteProduct || !websiteProduct.isAvailable || websiteProduct.website.status !== "ACTIVE") {
    return { error: "Dit product is niet (meer) beschikbaar.", success: false };
  }

  // Snapshot the chosen WordPress category now (like the price fields
  // below) — never trust a category id from the client without checking it
  // actually belongs to this site, since it decides where the article gets
  // filed on publish.
  let wpTermId: number | null = null;
  let wpCategoryNameSnap: string | null = null;
  if (data.wpCategoryId) {
    const wpCategory = await prisma.wpCategory.findUnique({ where: { id: data.wpCategoryId } });
    if (!wpCategory || wpCategory.websiteId !== websiteProduct.websiteId || wpCategory.kind !== "BLOG_POST") {
      return { error: "Ongeldige categorie.", success: false };
    }
    wpTermId = wpCategory.wpTermId;
    wpCategoryNameSnap = wpCategory.name;
  }

  // Never trust a price from the client — recompute server-side from the
  // current supplier price + margin rules, and freeze it on the item so a
  // later price change doesn't alter items already sitting in the cart.
  const { supplierPrice, customerPrice, marginPercent } = await computePriceForWebsiteProduct(
    websiteProduct.id
  );

  const order = await prisma.$transaction(async (tx) => {
    let project = await tx.project.findFirst({ where: { customerCompanyId: session.user.companyId! } });
    if (!project) {
      project = await tx.project.create({
        data: { name: "Bestellingen", customerCompanyId: session.user.companyId! },
      });
    }

    const existingCart = await tx.order.findFirst({
      where: { customerId: session.user.id, projectId: project.id, status: "NEW" },
    });

    const itemData = {
      websiteProductId: websiteProduct.id,
      ...periodPrices(new Prisma.Decimal(supplierPrice), new Prisma.Decimal(customerPrice), data.durationYears),
      publishAt: publishAtFrom(data.publishOn),
      marginSnap: marginPercent,
      targetUrl: link?.targetUrl ?? null,
      anchorText: link?.anchorText ?? null,
      nofollow: data.nofollow,
      wpTermId,
      wpCategoryNameSnap,
      comments: data.comments || null,
      contentSource: "CUSTOMER" as const,
      articleTitle: data.articleTitle,
      articleBody: sanitizedBody,
      articleImageKey: data.articleImageKey || null,
    };

    if (existingCart) {
      await tx.orderItem.create({ data: { ...itemData, orderId: existingCart.id } });
      return existingCart;
    }

    return tx.order.create({
      data: { customerId: session.user.id, projectId: project.id, items: { create: itemData } },
    });
  });

  return { error: null, success: true, orderId: order.id };
}

const homepageLinkSchema = z.object({
  wpCategoryId: z.string().cuid().optional().or(z.literal("")),
  anchorText: z.string().trim().min(1, "Ankertekst is verplicht").max(200),
  targetUrl: z.string().trim().url("Vul een geldige URL in"),
  nofollow: z.boolean().default(false),
  publishOn: publishOnField,
  durationYears: durationYearsSchema.default(1),
});

export type AddHomepageLinkState = { error: string | null; success: boolean; orderId?: string };

// A "homepage-link" product (ProductType.HOMEPAGE_LINK) is a startpagina-style
// directory listing, not an article — just a category, anchor text and a
// target URL. It goes live immediately once paid (see maybeAutoPublishOrder),
// there's nothing here for an admin to review.
export async function addHomepageLinkAction(
  input: unknown
): Promise<AddHomepageLinkState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = homepageLinkSchema.extend({ websiteProductId: z.string().cuid() }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: data.websiteProductId },
    include: { website: true },
  });
  if (!websiteProduct || !websiteProduct.isAvailable || websiteProduct.website.status !== "ACTIVE") {
    return { error: "Dit product is niet (meer) beschikbaar.", success: false };
  }

  let wpTermId: number | null = null;
  let wpCategoryNameSnap: string | null = null;
  if (data.wpCategoryId) {
    const wpCategory = await prisma.wpCategory.findUnique({ where: { id: data.wpCategoryId } });
    if (!wpCategory || wpCategory.websiteId !== websiteProduct.websiteId || wpCategory.kind !== "HOMEPAGE_LINK") {
      return { error: "Ongeldige categorie.", success: false };
    }
    wpTermId = wpCategory.wpTermId;
    wpCategoryNameSnap = wpCategory.name;
  }

  const { supplierPrice, customerPrice, marginPercent } = await computePriceForWebsiteProduct(
    websiteProduct.id
  );

  const order = await prisma.$transaction(async (tx) => {
    let project = await tx.project.findFirst({ where: { customerCompanyId: session.user.companyId! } });
    if (!project) {
      project = await tx.project.create({
        data: { name: "Bestellingen", customerCompanyId: session.user.companyId! },
      });
    }

    const existingCart = await tx.order.findFirst({
      where: { customerId: session.user.id, projectId: project.id, status: "NEW" },
    });

    const itemData = {
      websiteProductId: websiteProduct.id,
      ...periodPrices(new Prisma.Decimal(supplierPrice), new Prisma.Decimal(customerPrice), data.durationYears),
      publishAt: publishAtFrom(data.publishOn),
      marginSnap: marginPercent,
      targetUrl: data.targetUrl,
      anchorText: data.anchorText,
      nofollow: data.nofollow,
      wpTermId,
      wpCategoryNameSnap,
    };

    if (existingCart) {
      await tx.orderItem.create({ data: { ...itemData, orderId: existingCart.id } });
      return existingCart;
    }

    return tx.order.create({
      data: { customerId: session.user.id, projectId: project.id, items: { create: itemData } },
    });
  });

  return { error: null, success: true, orderId: order.id };
}

export type UpdateHomepageLinkState = { error: string | null; success: boolean; orderId?: string };

export async function updateHomepageLinkContentAction(
  input: unknown
): Promise<UpdateHomepageLinkState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = homepageLinkSchema.extend({ orderItemId: z.string().cuid() }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const item = await prisma.orderItem.findUnique({
    where: { id: data.orderItemId },
    include: { order: true, websiteProduct: true },
  });
  if (!item || item.order.customerId !== session.user.id || item.order.status !== "NEW") {
    return { error: "Niet toegestaan.", success: false };
  }

  let wpTermId: number | null = null;
  let wpCategoryNameSnap: string | null = null;
  if (data.wpCategoryId) {
    const wpCategory = await prisma.wpCategory.findUnique({ where: { id: data.wpCategoryId } });
    if (!wpCategory || wpCategory.websiteId !== item.websiteProduct.websiteId || wpCategory.kind !== "HOMEPAGE_LINK") {
      return { error: "Ongeldige categorie.", success: false };
    }
    wpTermId = wpCategory.wpTermId;
    wpCategoryNameSnap = wpCategory.name;
  }

  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      targetUrl: data.targetUrl,
      anchorText: data.anchorText,
      nofollow: data.nofollow,
      wpTermId,
      wpCategoryNameSnap,
      ...repriceItem(item, data.durationYears),
      publishAt: publishAtFrom(data.publishOn),
    },
  });

  return { error: null, success: true, orderId: item.orderId };
}

const updateContentSchema = createOrderSchema.omit({ websiteProductId: true }).extend({
  orderItemId: z.string().cuid(),
});

export type UpdateCartItemContentState = { error: string | null; success: boolean; orderId?: string };

// Fills in the article content (title, text, image, category) for an item
// that's already sitting in the cart — see addEmptyToCartAction in
// marketplace/actions.ts, which adds the item first with no content so the
// cart badge reacts immediately on "Voeg toe".
export async function updateCartItemContentAction(input: unknown): Promise<UpdateCartItemContentState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = updateContentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const item = await prisma.orderItem.findUnique({
    where: { id: data.orderItemId },
    include: { order: true, websiteProduct: true },
  });
  if (!item || item.order.customerId !== session.user.id || item.order.status !== "NEW") {
    return { error: "Niet toegestaan.", success: false };
  }

  const sanitizedBody = sanitizeArticleBody(data.articleBody);
  const link = extractLinkFromBody(sanitizedBody);

  let wpTermId: number | null = null;
  let wpCategoryNameSnap: string | null = null;
  if (data.wpCategoryId) {
    const wpCategory = await prisma.wpCategory.findUnique({ where: { id: data.wpCategoryId } });
    if (!wpCategory || wpCategory.websiteId !== item.websiteProduct.websiteId || wpCategory.kind !== "BLOG_POST") {
      return { error: "Ongeldige categorie.", success: false };
    }
    wpTermId = wpCategory.wpTermId;
    wpCategoryNameSnap = wpCategory.name;
  }

  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      targetUrl: link?.targetUrl ?? null,
      anchorText: link?.anchorText ?? null,
      nofollow: data.nofollow,
      wpTermId,
      wpCategoryNameSnap,
      comments: data.comments || null,
      contentSource: "CUSTOMER",
      articleTitle: data.articleTitle,
      articleBody: sanitizedBody,
      articleImageKey: data.articleImageKey || null,
      ...repriceItem(item, data.durationYears),
      publishAt: publishAtFrom(data.publishOn),
    },
  });

  return { error: null, success: true, orderId: item.orderId };
}
