"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

type ActionState = { error: string | null; success: boolean };

export async function denyRefundAction(orderId: string): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "REFUND_REQUESTED") {
    return { error: "Ongeldige order.", success: false };
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  return { error: null, success: true };
}

export async function approveRefundAction(orderId: string): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order || order.status !== "REFUND_REQUESTED") {
    return { error: "Ongeldige order.", success: false };
  }

  const payment = order.payments.find((p) => p.status === "paid");
  if (!payment?.providerRef) {
    return { error: "Geen betaling gevonden om te crediteren.", success: false };
  }

  const stripe = getStripe();
  try {
    // Money to publishers went out as separate Transfers (a cart can span
    // multiple publishers, so it was never tied to the PaymentIntent via
    // transfer_data) — reverse each one before refunding the customer, or
    // the platform balance goes negative by exactly that amount.
    const transfers = await stripe.transfers.list({ transfer_group: order.id, limit: 100 });
    for (const transfer of transfers.data) {
      await stripe.transfers.createReversal(transfer.id);
    }

    await stripe.refunds.create({ payment_intent: payment.providerRef });

    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } }),
      prisma.payment.update({ where: { id: payment.id }, data: { status: "refunded" } }),
    ]);

    return { error: null, success: true };
  } catch (err) {
    console.error("Refund failed for order", orderId, err);
    return { error: "Restitutie via Stripe is mislukt. Probeer het opnieuw of doe het handmatig in Stripe.", success: false };
  }
}
