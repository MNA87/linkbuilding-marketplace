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

// Who writes / how it's delivered per article in a bulk order.
//   write — "Laat ons schrijven": the links, we write the article.
//   self  — the customer delivers the article later (link known now).
//   later — fill in everything later.
const articleSchema = z.object({
  websiteProductId: z.string().min(1),
  projectId: z.string().min(1),
  type: z.enum(["write", "self", "later"]),
  anchor: z.string().trim().max(200).optional().default(""),
  url: z.string().trim().max(500).optional().default(""),
  anchor2: z.string().trim().max(200).optional().default(""),
  url2: z.string().trim().max(500).optional().default(""),
  // "" = zo snel mogelijk; otherwise a day between tomorrow and a year out.
  publishOn: publishOnField,
});

const bulkSchema = z.object({ articles: z.array(articleSchema).min(1).max(200) });

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
  const { articles } = parsed.data;

  // Projects must belong to this company.
  const projectIds = Array.from(new Set(articles.map((a) => a.projectId)));
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, customerCompanyId: company.id },
    select: { id: true },
  });
  if (projects.length !== projectIds.length) {
    return { error: "Eén of meer projecten zijn niet van jou.", success: false };
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

  // A "write" article needs at least one real link.
  for (const a of articles) {
    if (a.type === "write" && !(a.anchor.trim() && tidyUrl(a.url))) {
      return { error: "Vul bij 'Wij schrijven' minstens één ankertekst en doel-URL in.", success: false };
    }
  }

  // Price every distinct site once (the price agreed with this customer).
  const priceByWp = new Map<string, Awaited<ReturnType<typeof computePriceForWebsiteProduct>>>();
  for (const id of wpIds) {
    priceByWp.set(id, await computePriceForWebsiteProduct(id, company.id));
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
    // self / later: awaiting content. The link (if given) is kept so the
    // article can be written around it later.
    return {
      ...base,
      writeForMe: false,
      deliverLater: a.type === "later",
      anchorText: a.anchor.trim() || null,
      targetUrl: tidyUrl(a.url) || null,
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const orderIds: string[] = [];
    for (const projectId of projectIds) {
      const groupItems = articles.filter((a) => a.projectId === projectId).map(itemData);
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
