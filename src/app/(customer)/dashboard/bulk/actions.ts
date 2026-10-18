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
import { sanitizeArticleBody } from "@/lib/sanitizeArticle";
import { extractLinkFromBody } from "@/lib/wordpress";
import { expireOpenPayments } from "@/lib/cart";

// Remove one cart item for a site (the "−" in the bulk Kiezen table). Adding is
// the shared marketplace addEmptyToCartAction; removing the last one also clears
// the empty cart order (unless a checkout was ever started for it).
export async function removeOneFromCartAction(websiteProductId: unknown): Promise<{ error: string | null }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") return { error: "Niet toegestaan." };
  const wpId = typeof websiteProductId === "string" ? websiteProductId : "";
  if (!wpId) return { error: "Ongeldige invoer." };

  const item = await prisma.orderItem.findFirst({
    where: { websiteProductId: wpId, order: { customerId: session.user.id, status: "NEW" } },
    orderBy: { id: "desc" },
    include: { order: true },
  });
  if (!item) return { error: null };

  await prisma.orderItem.delete({ where: { id: item.id } });
  await expireOpenPayments(item.order.id);
  const [remaining, payments] = await Promise.all([
    prisma.orderItem.count({ where: { orderId: item.order.id } }),
    prisma.payment.count({ where: { orderId: item.order.id } }),
  ]);
  if (remaining === 0 && payments === 0) {
    await prisma.order.delete({ where: { id: item.order.id } });
  }
  return { error: null };
}

// Who writes / how it's delivered per article in a bulk order.
//   write — "Laat ons schrijven": the links, we write the article.
//   self  — the customer delivers the article: a Google Doc link or pasted
//           text (selfText), or neither (fill in later under Mijn orders).
//   later — fill in everything after the order.
const articleSchema = z.object({
  websiteProductId: z.string().min(1),
  // Optional: a row without a project lands on the company's default project.
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
  // "" = Algemeen; otherwise prices (and records) this onderwerp per item.
  topicId: z.string().trim().optional().default(""),
  articles: z.array(articleSchema).min(1).max(200),
});

export type PlaceBulkOrderState = { error: string | null; success: boolean; orderId?: string; orderCount?: number; articleCount?: number };

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
  if (!company || !company.bulkOrdering) {
    return { error: "Bulk bestellen staat niet aan voor dit account." };
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

// Places an agency bulk order: one on-account order per project (its articles),
// all landing on the monthly verzamelfactuur. Only for a customer whose company
// has bulk-besteller turned on (Admin → Klanten → klant).
export async function placeBulkOrderAction(input: unknown): Promise<PlaceBulkOrderState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
  if (!company || !company.bulkOrdering) {
    return { error: "Bulk bestellen staat niet aan voor dit account.", success: false };
  }

  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const { articles, topicId } = parsed.data;
  const topic = topicId
    ? await prisma.topic.findUnique({ where: { id: topicId }, select: { id: true, name: true } })
    : null;
  if (topicId && !topic) {
    return { error: "Dit onderwerp bestaat niet (meer).", success: false };
  }

  // Any chosen project must belong to this company; a row without one gets the
  // company's default project later (created on demand), so project is optional.
  const chosenProjectIds = Array.from(new Set(articles.map((a) => a.projectId).filter((id) => id)));
  if (chosenProjectIds.length > 0) {
    const projects = await prisma.project.findMany({
      where: { id: { in: chosenProjectIds }, customerCompanyId: company.id },
      select: { id: true },
    });
    if (projects.length !== chosenProjectIds.length) {
      return { error: "Eén of meer projecten zijn niet van jou.", success: false };
    }
  }

  // The chosen sites must be available blog products.
  const wpIds = Array.from(new Set(articles.map((a) => a.websiteProductId)));
  const products = await prisma.websiteProduct.findMany({
    where: { id: { in: wpIds }, isAvailable: true, product: { type: "BLOG_POST" }, website: { status: "ACTIVE" } },
    select: { id: true, periodic: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  if (products.length !== wpIds.length) {
    return { error: "Eén of meer sites zijn niet (meer) beschikbaar.", success: false };
  }

  // "Laat ons schrijven" needs the links; a given Google Doc link must be valid.
  for (const a of articles) {
    if (a.type === "write" && !(a.anchor.trim() && tidyUrl(a.url))) {
      return { error: "Vul bij 'Laat ons schrijven' minstens één ankertekst en doel-URL in.", success: false };
    }
    if (a.type === "self" && !a.body.trim() && a.docUrl.trim() && !googleDocId(a.docUrl.trim())) {
      return { error: "Eén of meer Google Doc-links zijn ongeldig.", success: false };
    }
  }

  // Price every distinct site once, for the chosen onderwerp (the price agreed
  // with this customer). A site that doesn't place the onderwerp stops the order.
  const priceByWp = new Map<string, Awaited<ReturnType<typeof computePriceForWebsiteProduct>>>();
  for (const id of wpIds) {
    try {
      priceByWp.set(id, await computePriceForWebsiteProduct(id, company.id, topic?.id ?? null));
    } catch {
      return { error: "Eén of meer sites plaatsen dit onderwerp niet.", success: false };
    }
  }
  const writingFee = await writingFeeFor(company.id);
  const vat = vatTreatment(company);

  function itemData(a: z.infer<typeof articleSchema>) {
    const wp = productById.get(a.websiteProductId)!;
    const price = priceByWp.get(a.websiteProductId)!;
    const base = {
      websiteProductId: a.websiteProductId,
      periodic: wp.periodic,
      supplierPriceSnap: price.supplierPrice,
      customerPriceSnap: price.customerPrice,
      marginSnap: price.marginPercent,
      topicId: topic?.id ?? null,
      topicNameSnap: topic?.name ?? null,
      publishAt: a.publishOn ? publishAtFromDay(a.publishOn) : null,
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
    // "Zelf aanleveren" with an own article: title + text (+ optional image),
    // the link lifted from the body if present. Title falls back to the first
    // line of the text when left empty.
    if (a.type === "self" && a.body.trim()) {
      const sanitized = sanitizeArticleBody(a.body);
      const link = extractLinkFromBody(sanitized);
      return {
        ...base,
        writeForMe: false,
        contentSource: "CUSTOMER" as const,
        articleTitle: a.title.trim() || titleFromBody(a.body),
        articleBody: sanitized,
        articleImageKey: a.imageKey.trim() || null,
        anchorText: link?.anchorText ?? null,
        targetUrl: link?.targetUrl ?? null,
      };
    }
    // "Zelf aanleveren" with a Google Doc link: the admin reads it in later.
    if (a.type === "self" && a.docUrl.trim()) {
      return { ...base, writeForMe: false, articleDocUrl: a.docUrl.trim() };
    }
    // self (nothing yet) or later: awaiting content, delivered per article later.
    return { ...base, writeForMe: false, deliverLater: true };
  }

  const created = await prisma.$transaction(async (tx) => {
    // Rows without a project land on the company's default project, created on
    // demand (same "Bestellingen" fallback the regular order flow uses).
    let defaultProjectId: string | null = null;
    if (articles.some((a) => !a.projectId)) {
      const existing = await tx.project.findFirst({
        where: { customerCompanyId: company.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      defaultProjectId =
        existing?.id ??
        (await tx.project.create({ data: { name: "Bestellingen", customerCompanyId: company.id }, select: { id: true } })).id;
    }
    const projectOf = (a: z.infer<typeof articleSchema>) => a.projectId || defaultProjectId!;
    const groupProjectIds = Array.from(new Set(articles.map(projectOf)));

    const orderIds: string[] = [];
    for (const projectId of groupProjectIds) {
      const groupItems = articles.filter((a) => projectOf(a) === projectId).map(itemData);
      const order = await tx.order.create({
        data: {
          customerId: session.user.id,
          projectId,
          status: "PAID",
          onAccount: true,
          vatRate: vat.rate,
          vatNote: vat.note,
          items: { create: groupItems },
        },
        select: { id: true },
      });
      orderIds.push(order.id);
    }
    return orderIds;
  });

  return { error: null, success: true, orderId: created[0], orderCount: created.length, articleCount: articles.length };
}
