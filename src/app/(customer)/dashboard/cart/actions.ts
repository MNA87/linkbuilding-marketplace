"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

type ActionState = { error: string | null; success: boolean };
type CheckoutState = { error: string | null; checkoutUrl?: string };

export async function removeCartItemAction(orderItemId: string): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan.", success: false };
  }

  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true } });
  if (!item || item.order.customerId !== session.user.id || item.order.status !== "NEW") {
    return { error: "Niet toegestaan.", success: false };
  }

  await prisma.orderItem.delete({ where: { id: orderItemId } });

  // Don't leave an empty cart order lying around.
  const remaining = await prisma.orderItem.count({ where: { orderId: item.order.id } });
  if (remaining === 0) {
    await prisma.order.delete({ where: { id: item.order.id } });
  }

  return { error: null, success: true };
}

export async function checkoutCartAction(orderId: string): Promise<CheckoutState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan." };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { websiteProduct: { include: { website: { include: { company: true } } } } } },
    },
  });
  if (!order || order.customerId !== session.user.id || order.status !== "NEW") {
    return { error: "Niet toegestaan." };
  }
  if (order.items.length === 0) {
    return { error: "Winkelmandje is leeg." };
  }

  // A cart can hold links from several different publishers — Stripe can
  // only route one destination per PaymentIntent, so we charge the full
  // amount to the platform here and split it into separate Transfers per
  // publisher afterward, once payment is confirmed (see the webhook).
  for (const item of order.items) {
    const company = item.websiteProduct.website.company;
    if (!company.stripeAccountId || !company.stripeAccountOnboarded) {
      return {
        error: `Publisher van ${item.websiteProduct.website.domain} heeft de uitbetaling nog niet ingesteld.`,
      };
    }
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: order.items.map((item) => ({
        price_data: {
          currency: "eur",
          unit_amount: Math.round(item.customerPriceSnap.toNumber() * 100),
          product_data: { name: `${item.websiteProduct.website.domain} — plaatsing` },
        },
        quantity: 1,
      })),
      payment_intent_data: {
        transfer_group: order.id,
        metadata: { orderId: order.id },
      },
      metadata: { orderId: order.id },
      success_url: `${appUrl}/dashboard/orders/${order.id}?checkout=success`,
      cancel_url: `${appUrl}/dashboard/cart?checkout=cancelled`,
    });

    const total = order.items.reduce((sum, i) => sum + i.customerPriceSnap.toNumber(), 0);
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "stripe",
        providerRef: checkoutSession.id,
        amount: total,
        status: "pending",
      },
    });

    return { error: null, checkoutUrl: checkoutSession.url ?? undefined };
  } catch (err) {
    console.error("Stripe checkout session failed", err);
    return { error: "Kon geen betaalpagina aanmaken. Probeer het later opnieuw." };
  }
}
