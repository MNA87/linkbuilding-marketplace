"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { createOrderSchema } from "@/lib/validations/order";

export type AddToCartState = { error: string | null; success: boolean; orderId?: string };

// Adds an item to the customer's cart. A "cart" is just an Order with
// status NEW, scoped per project — there's one active cart per project,
// items get appended to it until checkout. This reuses the existing
// Order/OrderItem model instead of introducing a separate Cart table.
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

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: data.websiteProductId },
    include: { website: { include: { company: true } } },
  });
  if (!websiteProduct || !websiteProduct.isAvailable || websiteProduct.website.status !== "ACTIVE") {
    return { error: "Dit product is niet (meer) beschikbaar.", success: false };
  }

  if (data.projectId) {
    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project || project.customerCompanyId !== session.user.companyId) {
      return { error: "Ongeldig project.", success: false };
    }
  }

  // Never trust a price from the client — recompute server-side from the
  // current supplier price + margin rules, and freeze it on the item so a
  // later price change doesn't alter items already sitting in the cart.
  const { supplierPrice, customerPrice, marginPercent } = await computePriceForWebsiteProduct(
    websiteProduct.id
  );

  const order = await prisma.$transaction(async (tx) => {
    const projectId =
      data.projectId ??
      (
        await tx.project.create({
          data: { name: data.newProjectName!, customerCompanyId: session.user.companyId! },
        })
      ).id;

    const existingCart = await tx.order.findFirst({
      where: { customerId: session.user.id, projectId, status: "NEW" },
    });

    const itemData = {
      websiteProductId: websiteProduct.id,
      supplierPriceSnap: supplierPrice,
      customerPriceSnap: customerPrice,
      marginSnap: marginPercent,
      targetUrl: data.targetUrl,
      anchorText: data.anchorText,
      comments: data.comments || null,
      contentSource: data.contentSource,
      articleTitle: data.articleTitle || null,
      articleBody: data.articleBody || null,
      uploadedFileUrl: data.uploadedFileUrl || null,
    };

    if (existingCart) {
      await tx.orderItem.create({ data: { ...itemData, orderId: existingCart.id } });
      return existingCart;
    }

    return tx.order.create({
      data: { customerId: session.user.id, projectId, items: { create: itemData } },
    });
  });

  return { error: null, success: true, orderId: order.id };
}
