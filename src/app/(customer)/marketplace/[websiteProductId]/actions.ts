"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { createOrderSchema } from "@/lib/validations/order";
import { extractLinkFromBody } from "@/lib/wordpress";
import { sanitizeArticleBody } from "@/lib/sanitizeArticle";

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
    if (!wpCategory || wpCategory.websiteId !== websiteProduct.websiteId) {
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
      supplierPriceSnap: supplierPrice,
      customerPriceSnap: customerPrice,
      marginSnap: marginPercent,
      targetUrl: link?.targetUrl ?? null,
      anchorText: link?.anchorText ?? null,
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
