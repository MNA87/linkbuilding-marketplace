"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { fulfillPaidOrder } from "@/lib/orderFulfillment";

export type ReconcileResult = {
  error: string | null;
  checked: number;
  fixed: number;
  details: string[];
};

// Catches orders stuck on "pending" because a Stripe webhook was never
// delivered (network blip, endpoint briefly down, etc.) — checks Stripe's
// own record of each pending Payment and, if Stripe says it's actually
// paid, runs the exact same fulfillment the webhook would have.
export async function reconcilePaymentsAction(): Promise<ReconcileResult> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", checked: 0, fixed: 0, details: [] };
  }

  const stalePayments = await prisma.payment.findMany({
    where: {
      status: "pending",
      provider: "stripe",
      createdAt: { lt: new Date(Date.now() - 15 * 60_000) },
    },
    include: { order: true },
  });

  const details: string[] = [];
  let fixed = 0;
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { error: "Stripe is niet geconfigureerd.", checked: 0, fixed: 0, details: [] };
  }

  for (const payment of stalePayments) {
    if (!payment.providerRef) continue;
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(payment.providerRef);
      if (checkoutSession.payment_status === "paid" && payment.order.status === "NEW") {
        await fulfillPaidOrder(
          payment.orderId,
          checkoutSession.id,
          typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : null
        );
        fixed++;
        details.push(`Order ${payment.orderId.slice(-8)}: alsnog gemarkeerd als betaald.`);
      } else if (checkoutSession.status === "expired") {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "expired" } });
        details.push(`Order ${payment.orderId.slice(-8)}: sessie verlopen, gemarkeerd als expired.`);
      }
    } catch (err) {
      details.push(`Order ${payment.orderId.slice(-8)}: kon Stripe niet raadplegen (${(err as Error).message}).`);
    }
  }

  return { error: null, checked: stalePayments.length, fixed, details };
}
