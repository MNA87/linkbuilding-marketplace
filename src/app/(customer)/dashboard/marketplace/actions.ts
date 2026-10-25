"use server";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { writingFeeFor } from "@/lib/customerPricing";
import { vatTreatment } from "@/lib/vatRules";
import { publishAtFromDay, publishOnField } from "@/lib/placementPeriod";
import { MAX_BRIEF_LINKS, type BriefLink } from "@/lib/writingService";
import { googleDocId } from "@/lib/googleDoc";
import { htmlHasText, looksLikeSite } from "@/lib/bulkArticle";
import { sanitizeArticleBody } from "@/lib/sanitizeArticle";
import { extractLinkFromBody } from "@/lib/wordpress";
import { billingDetailsComplete } from "@/lib/invoices";
import { checkoutCartAction } from "@/app/(customer)/dashboard/cart/actions";

// Who writes / how it's delivered per article in a bulk order.
//   write — "Laat ons schrijven": the links, we write the article.
//   self  — the customer delivers the article: a Google Doc link or pasted
//           text (selfText), or neither (fill in later under Mijn orders).
//   later — fill in everything after the order.
const articleSchema = z.object({
  // The cart item this row stands for (created by addBulkItemAction).
  orderItemId: z.string().min(1),
  // Optional: a row without a project is simply unlabelled.
  projectId: z.string().trim().optional().default(""),
  type: z.enum(["write", "self", "later"]),
  anchor: z.string().trim().max(200).optional().default(""),
  url: z.string().trim().max(500).optional().default(""),
  anchor2: z.string().trim().max(200).optional().default(""),
  url2: z.string().trim().max(500).optional().default(""),
  // "Zelf aanleveren": a Google Doc link, or an own article (title + body +
  // optional image key).
  docUrl: z.string().trim().max(500).optional().default(""),
  title: z.string().trim().max(300).optional().default(""),
  body: z.string().max(100000).optional().default(""),
  imageKey: z.string().trim().max(300).optional().default(""),
  // "" = zo snel mogelijk; otherwise a day between tomorrow and a year out.
  publishOn: publishOnField,
});

// First line of the pasted text becomes the title (the admin can refine it).
function titleFromBody(html: string): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, 120) || "Aangeleverd artikel";
}

const bulkSchema = z.object({
  articles: z.array(articleSchema).min(1).max(200),
});

// A half-filled row, kept loose on purpose: a draft may be partial or hold a
// not-yet-chosen type. It's only ever read back into the form, never trusted
// as final — the strict checks run at checkout (placeBulkCartAction).
const draftArticleSchema = z.object({
  orderItemId: z.string().min(1),
  projectId: z.string().max(64).optional().default(""),
  type: z.enum(["write", "self", "later", ""]).optional().default(""),
  anchor: z.string().max(200).optional().default(""),
  url: z.string().max(500).optional().default(""),
  secondLink: z.boolean().optional().default(false),
  anchor2: z.string().max(200).optional().default(""),
  url2: z.string().max(500).optional().default(""),
  selfText: z.boolean().optional().default(false),
  docUrl: z.string().max(500).optional().default(""),
  title: z.string().max(300).optional().default(""),
  body: z.string().max(100000).optional().default(""),
  imageKey: z.string().max(300).optional().default(""),
  publishOn: z.string().max(40).optional().default(""),
});
const draftSchema = z.object({ articles: z.array(draftArticleSchema).max(200) });

export type PlaceBulkOrderState = { error: string | null; success: boolean; orderId?: string; orderCount?: number; articleCount?: number };

// Wat de betaal-variant (reguliere klant) teruggeeft: dezelfde velden als de
// winkelmandje-checkout (Stripe-url / testmodus / op rekening), plus
// needsBilling wanneer de factuurgegevens nog ontbreken.
export type BulkCheckoutState = {
  error: string | null;
  checkoutUrl?: string;
  testMode?: boolean;
  onAccount?: boolean;
  orderId?: string;
  needsConfirm?: boolean;
  needsBilling?: boolean;
};

// Quick-create a project (the agency's client) straight from the bulk flow,
// so you never have to leave the page to add a new client. Only the name is
// asked here; target website / notes can be filled later under Projecten.
// Returns the new project so the caller can slot it into the list without a
// refresh.
export async function createBulkProjectAction(
  name: unknown
): Promise<{ error: string | null; project?: { id: string; name: string } }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan." };
  }

  const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
  if (!company) {
    return { error: "Niet toegestaan." };
  }

  const trimmed = typeof name === "string" ? name.trim() : "";
  if (trimmed.length < 2) return { error: "Naam moet minimaal 2 tekens zijn." };
  if (trimmed.length > 200) return { error: "Naam is te lang." };

  const project = await prisma.project.create({
    data: { name: trimmed, customerCompanyId: session.user.companyId },
    select: { id: true, name: true },
  });
  return { error: null, project };
}

// A relaxed https-prefixer — the strict URL check happens where links are
// actually required (a "write" article).
function tidyUrl(url: string): string {
  const v = url.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// The company's default project ("Bestellingen"), created on demand — the same
// fallback the regular order flow uses. A bulk order lives in one cart order on
// this project; the per-row client is a label on each item (OrderItem.projectId).
async function defaultProjectId(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<string> {
  const existing = await tx.project.findFirst({
    where: { customerCompanyId: companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.project.create({
    data: { name: "Bestellingen", customerCompanyId: companyId },
    select: { id: true },
  });
  return created.id;
}

const addItemSchema = z.object({
  websiteProductId: z.string().min(1),
  topicId: z.string().trim().optional().nullable(),
});

export type AddBulkItemState = { error: string | null; orderItemId?: string };

// The "+" on the bulk Blog-links list: drops an empty placeholder item straight
// into the cart (so the top-bar cart badge reacts right away, exactly like the
// regular marketplace "Voeg toe"). The article content is filled in afterwards
// and written onto the item at checkout (placeBulkCartAction). One cart order
// per customer holds the whole bulk order.
export async function addBulkItemAction(input: unknown): Promise<AddBulkItemState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan." };
  }
  const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
  if (!company) {
    return { error: "Niet toegestaan." };
  }

  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return { error: "Ongeldige invoer" };

  const wp = await prisma.websiteProduct.findUnique({
    where: { id: parsed.data.websiteProductId },
    include: { website: true, product: true },
  });
  if (!wp || !wp.isAvailable || wp.website.status !== "ACTIVE" || (wp.product.type !== "BLOG_POST" && wp.product.type !== "HOMEPAGE_LINK")) {
    return { error: "Deze site is niet (meer) beschikbaar." };
  }

  // Onderwerp-prijzen gelden alleen voor blog links; homepage links hebben hun
  // eigen prijs los van het onderwerp.
  const isBlog = wp.product.type === "BLOG_POST";
  const topic = isBlog && parsed.data.topicId
    ? await prisma.topic.findUnique({ where: { id: parsed.data.topicId }, select: { id: true, name: true } })
    : null;
  if (isBlog && parsed.data.topicId && !topic) return { error: "Dit onderwerp bestaat niet (meer)." };

  let price;
  try {
    price = await computePriceForWebsiteProduct(wp.id, session.user.companyId, topic?.id ?? null);
  } catch {
    return { error: "Deze site plaatst dit onderwerp niet." };
  }

  const orderItemId = await prisma.$transaction(async (tx) => {
    const projectId = await defaultProjectId(tx, company.id);
    const cart = await tx.order.findFirst({
      where: { customerId: session.user.id, projectId, status: "NEW" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const itemData = {
      websiteProductId: wp.id,
      periodic: wp.periodic,
      supplierPriceSnap: price.supplierPrice,
      customerPriceSnap: price.customerPrice,
      marginSnap: price.marginPercent,
      topicId: topic?.id ?? null,
      topicNameSnap: topic?.name ?? null,
    };
    if (cart) {
      const item = await tx.orderItem.create({ data: { ...itemData, orderId: cart.id } });
      return item.id;
    }
    const order = await tx.order.create({
      data: { customerId: session.user.id, projectId, items: { create: itemData } },
      include: { items: true },
    });
    return order.items[0].id;
  });

  return { error: null, orderItemId };
}

// Autosave: write each half-filled row onto its cart item (draftContent) so the
// bulk order can be resumed later on any device. Called while editing, so it's
// deliberately light — no pricing, no strict validation. Only touches items that
// belong to this customer and are still in a NEW order.
export async function saveBulkDraftAction(input: unknown): Promise<{ error: string | null }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan." };
  }
  const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
  if (!company) return { error: "Niet toegestaan." };

  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { error: "Ongeldige invoer" };
  if (parsed.data.articles.length === 0) return { error: null };

  const byId = new Map(parsed.data.articles.map((a) => [a.orderItemId, a]));
  const items = await prisma.orderItem.findMany({
    where: { id: { in: Array.from(byId.keys()) }, order: { customerId: session.user.id, status: "NEW" } },
    select: { id: true },
  });

  await prisma.$transaction(
    items.map((item) => {
      const { orderItemId: _omit, ...draft } = byId.get(item.id)!;
      void _omit;
      return prisma.orderItem.update({
        where: { id: item.id },
        data: { draftContent: draft as unknown as Prisma.InputJsonValue },
      });
    })
  );

  return { error: null };
}

// Builds the content fields for one article onto its (existing) cart item. The
// price and onderwerp were frozen when the item was added to the cart, so they
// are left untouched here; every content field is set explicitly — including
// the ones a given type doesn't use, so a change of mind never leaves stale
// content behind.
function itemContentData(
  a: z.infer<typeof articleSchema>,
  writingFee: Prisma.Decimal | number
): Prisma.OrderItemUncheckedUpdateInput {
  const base: Prisma.OrderItemUncheckedUpdateInput = {
    projectId: a.projectId || null,
    draftContent: Prisma.DbNull,
    publishAt: a.publishOn ? publishAtFromDay(a.publishOn) : null,
    // Reset every content field first; the branch below fills in what applies.
    writeForMe: false,
    writingFeeSnap: 0,
    briefLinks: Prisma.DbNull,
    contentSource: null,
    articleTitle: null,
    articleBody: null,
    articleImageKey: null,
    articleDocUrl: null,
    anchorText: null,
    targetUrl: null,
    deliverLater: false,
  };

  if (a.type === "write") {
    const brief: BriefLink[] = [
      { anchor: a.anchor.trim(), url: tidyUrl(a.url) },
      ...(a.anchor2.trim() && tidyUrl(a.url2) ? [{ anchor: a.anchor2.trim(), url: tidyUrl(a.url2) }] : []),
    ].slice(0, MAX_BRIEF_LINKS);
    return {
      ...base,
      writeForMe: true,
      writingFeeSnap: writingFee,
      briefLinks: brief as unknown as Prisma.InputJsonValue,
      anchorText: brief[0].anchor,
      targetUrl: brief[0].url,
    };
  }
  if (a.type === "self" && htmlHasText(a.body)) {
    const sanitized = sanitizeArticleBody(a.body);
    const link = extractLinkFromBody(sanitized);
    return {
      ...base,
      contentSource: "CUSTOMER",
      articleTitle: a.title.trim() || titleFromBody(a.body),
      articleBody: sanitized,
      articleImageKey: a.imageKey.trim() || null,
      anchorText: link?.anchorText ?? null,
      targetUrl: link?.targetUrl ?? null,
    };
  }
  if (a.type === "self" && a.docUrl.trim()) {
    return { ...base, articleDocUrl: a.docUrl.trim() };
  }
  // self (nothing yet) or later: awaiting content, delivered per article later.
  return { ...base, deliverLater: true };
}

// A homepage link: just the link (anchor + target URL) placed on the homepage,
// or delivered later. No article and no writing fee. The row's "type" carries
// "write" (link now) or "later"; the product type (HOMEPAGE_LINK) decides that
// this branch runs, not the article machinery.
function homepageContentData(a: z.infer<typeof articleSchema>): Prisma.OrderItemUncheckedUpdateInput {
  const hasLink = Boolean(a.anchor.trim() && tidyUrl(a.url));
  return {
    projectId: a.projectId || null,
    draftContent: Prisma.DbNull,
    publishAt: a.publishOn ? publishAtFromDay(a.publishOn) : null,
    writeForMe: false,
    writingFeeSnap: 0,
    briefLinks: Prisma.DbNull,
    contentSource: null,
    articleTitle: null,
    articleBody: null,
    articleImageKey: null,
    articleDocUrl: null,
    anchorText: hasLink ? a.anchor.trim() : null,
    targetUrl: hasLink ? tidyUrl(a.url) : null,
    deliverLater: a.type === "later" || !hasLink,
  };
}

// Gedeeld tussen de twee afrond-varianten (op rekening / betalen): valideer de
// rijen en schrijf de artikelinhoud op de winkelmandje-regels — zónder de order
// af te ronden. De aanroeper beslist daarna hoe er afgerekend wordt. De prijzen
// en het onderwerp blijven zoals gesnapshot toen de regel in het mandje kwam.
async function writeBulkCartContent(
  companyId: string,
  customerId: string,
  input: unknown
): Promise<{ error: string } | { orderId: string; itemCount: number }> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  const { articles } = parsed.data;

  // Find the cart order from the rows themselves: every sent row must be an
  // item of one and the same NEW order owned by this customer. This is robust
  // even if more than one NEW order happens to exist.
  const sentIds = articles.map((a) => a.orderItemId);
  const sentItems = await prisma.orderItem.findMany({
    where: { id: { in: sentIds } },
    select: { id: true, orderId: true, order: { select: { customerId: true, status: true } } },
  });
  const orderId = sentItems[0]?.orderId;
  const stale =
    sentItems.length !== new Set(sentIds).size ||
    !orderId ||
    !sentItems.every((i) => i.orderId === orderId && i.order.customerId === customerId && i.order.status === "NEW");
  if (stale) {
    return { error: "Je winkelmandje is gewijzigd. Ververs de pagina en probeer opnieuw." };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { id: true, websiteProduct: { select: { product: { select: { type: true } } } } } } },
  });
  if (!order || order.items.length === 0) {
    return { error: "Je winkelmandje is leeg." };
  }
  const byItemId = new Map(articles.map((a) => [a.orderItemId, a]));

  // Any chosen project must belong to this company.
  const chosenProjectIds = Array.from(new Set(articles.map((a) => a.projectId).filter((id) => id)));
  if (chosenProjectIds.length > 0) {
    const projects = await prisma.project.findMany({
      where: { id: { in: chosenProjectIds }, customerCompanyId: companyId },
      select: { id: true },
    });
    if (projects.length !== chosenProjectIds.length) {
      return { error: "Eén of meer projecten zijn niet van jou." };
    }
  }

  // De server is hier de baas, niet de UI: elke regel moet in dezelfde staat
  // kloppen die de klant koos. "Laat ons schrijven" heeft de links nodig;
  // "Zelf aanleveren" een echte tekst óf een geldige Google Doc-link. Is er
  // niks ingevuld, dan weigeren we — we maken er nooit zelf "Later aanleveren"
  // van; dat moet de klant bewust kiezen.
  for (const a of articles) {
    if (a.type === "write" && !(a.anchor.trim() && looksLikeSite(a.url))) {
      return { error: "Vul bij 'Laat ons schrijven' minstens één ankertekst en doel-URL in." };
    }
    if (a.type === "self") {
      const hasBody = htmlHasText(a.body);
      const hasDoc = a.docUrl.trim().length > 0;
      if (!hasBody && !hasDoc) {
        return { error: "Vul bij 'Zelf aanleveren' een tekst of Google Doc-link in, of kies 'Later aanleveren'." };
      }
      if (!hasBody && !googleDocId(a.docUrl.trim())) {
        return { error: "Eén of meer Google Doc-links zijn ongeldig." };
      }
    }
  }

  const writingFee = await writingFeeFor(companyId);

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      const a = byItemId.get(item.id);
      // An item the page didn't send (shouldn't happen) is finalised as a
      // "later aanleveren" placeholder rather than left in limbo.
      const isHomepage = item.websiteProduct?.product?.type === "HOMEPAGE_LINK";
      const data: Prisma.OrderItemUncheckedUpdateInput = a
        ? (isHomepage ? homepageContentData(a) : itemContentData(a, writingFee))
        : { deliverLater: true, draftContent: Prisma.DbNull };
      await tx.orderItem.update({ where: { id: item.id }, data });
    }
  });

  return { orderId: order.id, itemCount: order.items.length };
}

// Bureau: schrijft de inhoud en rondt de bulk-order af op rekening
// (verzamelfactuur) — geen betaling. De cart is de enige bron van waarheid, dus
// de top-bar mandje-badge bleef al die tijd synchroon.
export async function placeBulkCartAction(input: unknown): Promise<PlaceBulkOrderState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
  if (!company || !company.bulkOrdering) {
    return { error: "Bulk bestellen staat niet aan voor dit account.", success: false };
  }

  const prepared = await writeBulkCartContent(company.id, session.user.id, input);
  if ("error" in prepared) return { error: prepared.error, success: false };

  const vat = vatTreatment(company);
  await prisma.order.update({
    where: { id: prepared.orderId },
    data: { status: "PAID", paidAt: new Date(), onAccount: true, vatRate: vat.rate, vatNote: vat.note },
  });

  return { error: null, success: true, orderId: prepared.orderId, orderCount: 1, articleCount: prepared.itemCount };
}

// Reguliere klant: schrijft de inhoud en stuurt daarna naar de bestaande
// Stripe-checkout (iDEAL/creditcard). Ontbreken de factuurgegevens nog, dan
// gaat de klant eerst naar het winkelmandje, waar het factuurformulier én de
// betaling al staan. "Later aanleveren" mag (acceptUnfilled): je betaalt nu en
// levert die regels na betaling aan onder Mijn orders.
export async function placeBulkCheckoutAction(input: unknown): Promise<BulkCheckoutState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan." };
  }

  const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
  if (!company) return { error: "Niet toegestaan." };

  const prepared = await writeBulkCartContent(company.id, session.user.id, input);
  if ("error" in prepared) return { error: prepared.error };

  if (!billingDetailsComplete(company)) {
    return { error: null, needsBilling: true, orderId: prepared.orderId };
  }

  return await checkoutCartAction(prepared.orderId, undefined, { acceptUnfilled: true });
}
