"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { z } from "zod";

export type AddEmptyToCartState = { error: string | null; success: boolean; orderItemId?: string };

const inputSchema = z.object({ websiteProductId: z.string().cuid() });

// The one-click "Voeg toe" on the marketplace list — puts a placeholder item
// straight in the cart (no article content yet) so the cart badge reacts
// immediately, the way an add-to-cart button is expected to behave. The
// customer fills in the actual article (title, text, image) afterwards from
// the cart itself; see updateCartItemContentAction in
// marketplace/[websiteProductId]/actions.ts.
export async function addEmptyToCartAction(input: unknown): Promise<AddEmptyToCartState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ongeldige invoer", success: false };
  }

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: parsed.data.websiteProductId },
    include: { website: true },
  });
  if (!websiteProduct || !websiteProduct.isAvailable || websiteProduct.website.status !== "ACTIVE") {
    return { error: "Dit product is niet (meer) beschikbaar.", success: false };
  }

  const { supplierPrice, customerPrice, marginPercent } = await computePriceForWebsiteProduct(
    websiteProduct.id
  );

  const orderItemId = await prisma.$transaction(async (tx) => {
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
    };

    if (existingCart) {
      const item = await tx.orderItem.create({ data: { ...itemData, orderId: existingCart.id } });
      return item.id;
    }

    const order = await tx.order.create({
      data: { customerId: session.user.id, projectId: project.id, items: { create: itemData } },
      include: { items: true },
    });
    return order.items[0].id;
  });

  return { error: null, success: true, orderItemId };
}
