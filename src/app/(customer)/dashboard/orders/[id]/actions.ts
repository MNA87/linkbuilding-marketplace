"use server";

import { getServerSession } from "next-auth";
import { OrderStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { durationYearsSchema, hasPeriod, priceForYears } from "@/lib/placementPeriod";
import { renewalYearlyPrices } from "@/lib/renewal";
import { messageBodySchema } from "@/lib/orderMessages";
import { isRateLimited } from "@/lib/rateLimit";

const CANCELLABLE_STATUSES: OrderStatus[] = ["PAID", "SENT_TO_PUBLISHER", "ACCEPTED", "IN_PROGRESS"];

export async function requestRefundAction(orderId: string): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan.", success: false };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.customerId !== session.user.id) {
    return { error: "Niet toegestaan.", success: false };
  }
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return { error: "Deze order kan niet meer geannuleerd worden (al gepubliceerd of afgerond).", success: false };
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "REFUND_REQUESTED" } });
  return { error: null, success: true };
}

// "Verlengen" on a homepage link in Mijn orders: puts a renewal for a live
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
    include: { order: true, placement: true, websiteProduct: { include: { product: true } } },
  });
  if (!original || original.order.customerId !== session.user.id) {
    return { error: "Niet toegestaan.", success: false };
  }
  if (!hasPeriod(original.websiteProduct.product.type)) {
    return { error: "Een blogartikel blijft voor altijd online; verlengen is niet nodig.", success: false };
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

// A question or reaction from the customer about this order (Admin → Berichten).
export async function sendCustomerMessageAction(
  orderId: string,
  body: string
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") return { error: "Niet toegestaan.", success: false };
  const parsed = messageBodySchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig bericht.", success: false };
  if (isRateLimited(`message:${session.user.id}`, 10, 10 * 60_000)) {
    return { error: "Je hebt veel berichten kort na elkaar gestuurd. Probeer het over een paar minuten opnieuw.", success: false };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true, status: true } });
  if (!order || order.customerId !== session.user.id || order.status === "NEW") {
    return { error: "Niet toegestaan.", success: false };
  }

  await prisma.orderMessage.create({ data: { orderId, fromAdmin: false, body: parsed.data } });
  return { error: null, success: true };
}

// Opening the order counts as reading our answers.
export async function markCustomerMessagesReadAction(orderId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") return;
  await prisma.orderMessage.updateMany({
    where: { orderId, fromAdmin: true, readAt: null, order: { customerId: session.user.id } },
    data: { readAt: new Date() },
  });
}
