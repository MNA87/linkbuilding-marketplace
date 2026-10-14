"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct, TopicNotOfferedError } from "@/lib/pricing";
import { writingFeeFor } from "@/lib/customerPricing";
import { createOrderSchema, updateOrderContentSchema } from "@/lib/validations/order";
import { briefLinksSchema } from "@/lib/writingService";
import { extractLinkFromBody } from "@/lib/wordpress";
import { isAwaitingContent } from "@/lib/awaitingContent";
import { maybeAutoPublishOrder } from "@/lib/orderFulfillment";
import { sendContentReceivedEmail } from "@/lib/email";
import { sanitizeArticleBody } from "@/lib/sanitizeArticle";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  durationYearsSchema,
  priceForYears,
  publishAtFromDay,
  publishOnField,
  yearsFor,
} from "@/lib/placementPeriod";

// Snapshots for the chosen period, from yearly prices.
function periodPrices(yearlySupplier: Prisma.Decimal, yearlyCustomer: Prisma.Decimal, years: number) {
  return {
    supplierPriceSnap: priceForYears(yearlySupplier, years),
    customerPriceSnap: priceForYears(yearlyCustomer, years),
    durationYears: years,
  };
}

const publishAtFrom = (publishOn: string) => (publishOn ? publishAtFromDay(publishOn) : null);

type EditableItem = Prisma.OrderItemGetPayload<{ include: { order: true; websiteProduct: { include: { product: true } } } }>;

// Who may change an item's content: its own customer, while it's in the
// cart — or, paid for before it was filled in, until it has its content
// ("Nu betalen, later aanleveren"). "paid": what was paid for is fixed then.
async function editableItem(orderItemId: string, customerId: string): Promise<{ item: EditableItem; paid: boolean } | null> {
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true, websiteProduct: { include: { product: true } }, placement: true },
  });
  if (!item || item.order.customerId !== customerId) return null;
  if (item.order.status === "NEW") return { item, paid: false };
  if (isAwaitingContent(item, item.order.status, item.websiteProduct.product.type)) return { item, paid: true };
  return null;
}

// Content sent in for a paid item: it goes its normal way from here
// (queued or published if auto-publish allows), and the admins hear of it.
async function contentReceived(item: EditableItem) {
  await maybeAutoPublishOrder(item.orderId);
  const admins = await prisma.user.findMany({ where: { role: { name: "admin" } }, select: { email: true } });
  const domain = (await prisma.website.findUnique({ where: { id: item.websiteProduct.websiteId }, select: { domain: true } }))
    ?.domain;
  for (const { email } of admins) {
    await sendContentReceivedEmail(email, item.order.orderNumber, domain ?? "", item.id);
  }
}

// The article part of an item: the customer's own title/text (with the link
// taken from the text), or — "Laat ons schrijven" — just their links plus
// the writing fee, with the article left for the platform to write.
async function articleFields(
  data: {
  writeForMe: boolean;
  briefLinks?: { anchor: string; url: string }[];
  articleTitle: string;
  articleBody: string;
  articleImageKey?: string;
  comments?: string;
  articleMode?: "text" | "googledoc" | "later";
  articleDocUrl?: string;
  },
  companyId: string | null | undefined
) {
  if (data.writeForMe) {
    const links = briefLinksSchema.parse((data.briefLinks ?? []).filter((l) => l.anchor.trim() || l.url.trim()));
    return {
      writeForMe: true,
      briefLinks: links,
      writingFeeSnap: await writingFeeFor(companyId),
      targetUrl: links[0].url,
      anchorText: links[0].anchor,
      contentSource: null,
      articleTitle: null,
      articleBody: null,
      articleDocUrl: null,
      articleImageKey: null,
      comments: data.comments || null,
    };
  }
  const mode = data.articleMode ?? "text";
  // "Later aanleveren": paid/placed empty, filled in later. Google Doc: just
  // the link, which the admin reads in before publishing. Both leave the
  // typed article empty, so the auto-publish check (title + body) won't fire.
  if (mode === "later" || mode === "googledoc") {
    return {
      writeForMe: false,
      briefLinks: Prisma.JsonNull,
      writingFeeSnap: new Prisma.Decimal(0),
      targetUrl: null,
      anchorText: null,
      contentSource: null,
      articleTitle: null,
      articleBody: null,
      articleDocUrl: mode === "googledoc" ? data.articleDocUrl || null : null,
      articleImageKey: null,
      comments: data.comments || null,
    };
  }
  const sanitizedBody = sanitizeArticleBody(data.articleBody);
  const link = extractLinkFromBody(sanitizedBody);
  return {
    writeForMe: false,
    briefLinks: Prisma.JsonNull,
    writingFeeSnap: new Prisma.Decimal(0),
    targetUrl: link?.targetUrl ?? null,
    anchorText: link?.anchorText ?? null,
    contentSource: "CUSTOMER" as const,
    articleTitle: data.articleTitle,
    articleBody: sanitizedBody,
    articleDocUrl: null,
    articleImageKey: data.articleImageKey || null,
    comments: data.comments || null,
  };
}

// The chosen niche (topic) must be one the site actually offers; its price
// and name are snapshotted so a later change doesn't move an existing order.
type TopicPricing =
  | { ok: false; error: string }
  | {
      ok: true;
      price: Awaited<ReturnType<typeof computePriceForWebsiteProduct>>;
      topicId: string | null;
      topicNameSnap: string | null;
    };

async function topicPricing(
  websiteProductId: string,
  companyId: string | null | undefined,
  topicId: string
): Promise<TopicPricing> {
  const tid = topicId || null;
  let topicNameSnap: string | null = null;
  if (tid) {
    const topic = await prisma.topic.findUnique({ where: { id: tid } });
    if (!topic) return { ok: false, error: "Dit onderwerp bestaat niet (meer)." };
    topicNameSnap = topic.name;
  }
  try {
    const price = await computePriceForWebsiteProduct(websiteProductId, companyId, tid);
    return { ok: true, price, topicId: tid, topicNameSnap };
  } catch (e) {
    if (e instanceof TopicNotOfferedError) {
      return { ok: false, error: "Dit onderwerp wordt niet (meer) aangeboden op deze site." };
    }
    throw e;
  }
}

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

  // A link is optional — the customer can place one themselves in the
  // article text (select text, click the link icon), but an order without
  // one is perfectly valid too.
  const article = await articleFields(data, session.user.companyId);

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

  // Never trust a price from the client — recompute server-side for the
  // chosen niche, and freeze it on the item so a later price change doesn't
  // alter items already sitting in the cart.
  const priced = await topicPricing(websiteProduct.id, session.user.companyId, data.topicId ?? "");
  if (!priced.ok) return { error: priced.error, success: false };
  const { supplierPrice, customerPrice, marginPercent } = priced.price;

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
      // Bought for good ("Permanent"): always one "period", whatever a form sent.
      ...periodPrices(
        new Prisma.Decimal(supplierPrice),
        new Prisma.Decimal(customerPrice),
        yearsFor(websiteProduct.periodic, data.durationYears)
      ),
      periodic: websiteProduct.periodic,
      publishAt: publishAtFrom(data.publishOn),
      marginSnap: marginPercent,
      nofollow: data.nofollow,
      topicId: priced.topicId,
      topicNameSnap: priced.topicNameSnap,
      wpTermId,
      wpCategoryNameSnap,
      // A deliberate "Later aanleveren" (vs an item that still needs a choice).
      deliverLater: !data.writeForMe && data.articleMode === "later",
      ...article,
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
  // Bounded strings, not .cuid(): both ids are re-checked against the DB below
  // (the category must belong to this site; the topic must exist), and topic
  // ids aren't guaranteed to be cuids.
  wpCategoryId: z.string().max(64).optional().or(z.literal("")),
  topicId: z.string().max(64).optional().or(z.literal("")),
  anchorText: z.string().trim().min(1, "Ankertekst is verplicht").max(200),
  targetUrl: z.string().trim().url("Vul een geldige URL in"),
  nofollow: z.boolean().default(false),
  publishOn: publishOnField,
  durationYears: durationYearsSchema.default(1),
});

export type AddHomepageLinkState = { error: string | null; success: boolean; orderId?: string };

// A "homepage-link" product (ProductType.HOMEPAGE_LINK) is a startpagina-style
// directory listing, not an article — just a category, anchor text and a
// target URL. Like an article it goes out once the admin has checked it
// and clicked Publiceren (or at once when auto-publish is on, see
// maybeAutoPublishOrder).
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

  const priced = await topicPricing(websiteProduct.id, session.user.companyId, data.topicId ?? "");
  if (!priced.ok) return { error: priced.error, success: false };
  const { supplierPrice, customerPrice, marginPercent } = priced.price;

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
      ...periodPrices(
        new Prisma.Decimal(supplierPrice),
        new Prisma.Decimal(customerPrice),
        yearsFor(websiteProduct.periodic, data.durationYears)
      ),
      periodic: websiteProduct.periodic,
      publishAt: publishAtFrom(data.publishOn),
      marginSnap: marginPercent,
      targetUrl: data.targetUrl,
      anchorText: data.anchorText,
      nofollow: data.nofollow,
      topicId: priced.topicId,
      topicNameSnap: priced.topicNameSnap,
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

  const editable = await editableItem(data.orderItemId, session.user.id);
  if (!editable) {
    return { error: "Niet toegestaan.", success: false };
  }
  const { item, paid } = editable;

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

  // Paid: the niche, period and price are what was paid for — fixed.
  // Otherwise re-price for the chosen niche and period, and snapshot it.
  let pricingData: Prisma.OrderItemUncheckedUpdateInput = {};
  if (!paid) {
    const priced = await topicPricing(item.websiteProductId, session.user.companyId, data.topicId ?? "");
    if (!priced.ok) return { error: priced.error, success: false };
    pricingData = {
      ...periodPrices(
        new Prisma.Decimal(priced.price.supplierPrice),
        new Prisma.Decimal(priced.price.customerPrice),
        yearsFor(item.periodic, data.durationYears)
      ),
      marginSnap: priced.price.marginPercent,
      topicId: priced.topicId,
      topicNameSnap: priced.topicNameSnap,
    };
  }

  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      targetUrl: data.targetUrl,
      anchorText: data.anchorText,
      nofollow: data.nofollow,
      wpTermId,
      wpCategoryNameSnap,
      ...pricingData,
      publishAt: publishAtFrom(data.publishOn),
    },
  });
  if (paid) await contentReceived(item);

  return { error: null, success: true, orderId: item.orderId };
}

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

  const parsed = updateOrderContentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const data = parsed.data;

  const editable = await editableItem(data.orderItemId, session.user.id);
  if (!editable) {
    return { error: "Niet toegestaan.", success: false };
  }
  const { item, paid } = editable;
  // Paid: "Zelf schrijven" or "Laat ons schrijven" was part of the price.
  if (paid && data.writeForMe !== item.writeForMe) {
    return { error: "De keuze voor het artikel is al betaald en kan niet meer veranderen.", success: false };
  }

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

  const article = await articleFields(data, session.user.companyId);

  // Paid: the niche (and so the price) was part of what was paid for — fixed.
  // Otherwise re-price for the chosen niche and period, and snapshot it.
  let pricingData: Prisma.OrderItemUncheckedUpdateInput;
  if (paid) {
    pricingData = { writingFeeSnap: item.writingFeeSnap };
  } else {
    const priced = await topicPricing(item.websiteProductId, session.user.companyId, data.topicId ?? "");
    if (!priced.ok) return { error: priced.error, success: false };
    pricingData = {
      ...periodPrices(
        new Prisma.Decimal(priced.price.supplierPrice),
        new Prisma.Decimal(priced.price.customerPrice),
        yearsFor(item.periodic, data.durationYears)
      ),
      marginSnap: priced.price.marginPercent,
      topicId: priced.topicId,
      topicNameSnap: priced.topicNameSnap,
    };
  }

  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      nofollow: data.nofollow,
      wpTermId,
      wpCategoryNameSnap,
      // A deliberate "Later aanleveren" (vs an item that still needs a choice).
      deliverLater: !data.writeForMe && data.articleMode === "later",
      ...article,
      ...pricingData,
      publishAt: publishAtFrom(data.publishOn),
    },
  });
  if (paid) await contentReceived(item);

  return { error: null, success: true, orderId: item.orderId };
}
