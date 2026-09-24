"use server";

import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { durationYearsSchema, priceForYears, yearlyPrice } from "@/lib/placementPeriod";

// "Verlengen" in Mijn links: puts a renewal for a live placement in the
// cart. Paying for it moves the end date on (see extendRenewedPlacements);
// nothing new gets placed.
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

  // The current price per year when the product is still on sale, else
  // what was paid per year last time.
  let yearlySupplier = yearlyPrice(original.supplierPriceSnap, original.durationYears);
  let yearlyCustomer = yearlyPrice(original.customerPriceSnap, original.durationYears);
  let margin = original.marginSnap;
  if (original.websiteProduct.isAvailable) {
    const current = await computePriceForWebsiteProduct(original.websiteProductId);
    yearlySupplier = new Prisma.Decimal(current.supplierPrice);
    yearlyCustomer = new Prisma.Decimal(current.customerPrice);
    margin = new Prisma.Decimal(current.marginPercent);
  }
  const renewal = {
    websiteProductId: original.websiteProductId,
    renewsOrderItemId: original.id,
    durationYears: parsedYears.data,
    supplierPriceSnap: priceForYears(yearlySupplier, parsedYears.data),
    customerPriceSnap: priceForYears(yearlyCustomer, parsedYears.data),
    marginSnap: margin,
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
