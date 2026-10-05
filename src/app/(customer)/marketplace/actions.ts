"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopicNotOfferedError, computePriceForWebsiteProduct } from "@/lib/pricing";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { DEFAULT_DURATION_YEARS, DURATION_YEARS, priceForYears, yearsFor } from "@/lib/placementPeriod";

export type AddEmptyToCartState = { error: string | null; success: boolean; orderItemId?: string };

// The topic (Casino, Lening, ...; empty = Algemeen) and the number of
// years chosen above the list come along.
const inputSchema = z.object({
  websiteProductId: z.string().cuid(),
  topicId: z.string().max(64).optional().nullable(),
  durationYears: z.coerce
    .number()
    .int()
    .refine((n) => (DURATION_YEARS as readonly number[]).includes(n))
    .optional(),
});

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

  const topic = parsed.data.topicId
    ? await prisma.topic.findUnique({ where: { id: parsed.data.topicId } })
    : null;
  if (parsed.data.topicId && !topic) return { error: "Dit onderwerp bestaat niet (meer).", success: false };

  let price;
  try {
    price = await computePriceForWebsiteProduct(websiteProduct.id, session.user.companyId, topic?.id ?? null);
  } catch (e) {
    if (e instanceof TopicNotOfferedError) return { error: e.message, success: false };
    throw e;
  }
  const { supplierPrice, customerPrice, marginPercent } = price;
  const years = yearsFor(websiteProduct.periodic, parsed.data.durationYears ?? DEFAULT_DURATION_YEARS);

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

    // Starts on the period picked above the list, priced for it; the order
    // form lets the customer change it.
    const itemData = {
      websiteProductId: websiteProduct.id,
      periodic: websiteProduct.periodic,
      durationYears: years,
      supplierPriceSnap: priceForYears(new Prisma.Decimal(supplierPrice), years),
      customerPriceSnap: priceForYears(new Prisma.Decimal(customerPrice), years),
      marginSnap: marginPercent,
      topicId: topic?.id ?? null,
      topicNameSnap: topic?.name ?? null,
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
