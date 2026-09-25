"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { durationYearsSchema, priceForYears } from "@/lib/placementPeriod";
import { renewalYearlyPrices } from "@/lib/renewal";

// "Verlengen" on a link's page in Mijn orders: puts a renewal for a live
// placement in the cart. Paying for it moves the end date on (see
// extendRenewedPlacements); nothing new gets placed.
export async function renewPlacementAction(
  orderItemId: string,
  years: unknown
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }
  const parsedYears = durationYearsSchema.safeParse(years);
  if (!parsedYears.success) return { error: "Kies een looptijd van 1 tot 3 jaar.", success: false };

  const original = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true, placement: true, websiteProduct: true },
  });
  if (!original || original.order.customerId !== session.user.id) {
    return { error: "Niet toegestaan.", success: false };
  }
  if (original.placement?.status !== "published" || !original.placement.expiresAt) {
    return { error: "Deze plaatsing kan niet (meer) verlengd worden.", success: false };
  }

  const yearly = await renewalYearlyPrices(original);
  const renewal = {
    websiteProductId: original.websiteProductId,
    renewsOrderItemId: original.id,
    durationYears: parsedYears.data,
    supplierPriceSnap: priceForYears(yearly.supplier, parsedYears.data),
    customerPriceSnap: priceForYears(yearly.customer, parsedYears.data),
    marginSnap: yearly.margin,
  };

  await prisma.$transaction(async (tx) => {
    let project = await tx.project.findFirst({ where: { customerCompanyId: session.user.companyId! } });
    if (!project) {
      project = await tx.project.create({ data: { name: "Bestellingen", customerCompanyId: session.user.companyId! } });
    }
    const cart = await tx.order.findFirst({
      where: { customerId: session.user.id, projectId: project.id, status: "NEW" },
      include: { items: true },
    });

    // Already in the cart: just change the number of years.
    const existing = cart?.items.find((i) => i.renewsOrderItemId === original.id);
    if (existing) {
      await tx.orderItem.update({ where: { id: existing.id }, data: renewal });
    } else if (cart) {
      await tx.orderItem.create({ data: { ...renewal, orderId: cart.id } });
    } else {
      await tx.order.create({
        data: { customerId: session.user.id, projectId: project.id, items: { create: renewal } },
      });
    }
  });

  return { error: null, success: true };
}
