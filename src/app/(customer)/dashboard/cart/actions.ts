"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { expireOpenPayments } from "@/lib/cart";
import { fulfillPaidOrder } from "@/lib/orderFulfillment";
import { billingDetailsComplete } from "@/lib/invoices";
import { vatTotals } from "@/lib/vat";
import { vatTreatment } from "@/lib/vatRules";
import { retryUnreachableVatCheck } from "@/lib/vatCheck";
import { durationLabel } from "@/lib/placementPeriod";
import { itemNeedsContent, itemPrice } from "@/lib/writingService";

type ActionState = { error: string | null; success: boolean };
type CheckoutState = {
  error: string | null;
  checkoutUrl?: string;
  testMode?: boolean;
  orderId?: string;
  // Some items aren't filled in yet: the customer sees which first (the
  // cart's "Klaar om af te rekenen?") and then pays with acceptUnfilled.
  needsConfirm?: boolean;
};

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

  await expireOpenPayments(item.order.id);

  // Don't leave an empty cart order lying around — unless a checkout was
  // ever started for it: its payment records keep the order (they can't be
  // deleted). An empty cart order is simply not shown.
  const [remaining, payments] = await Promise.all([
    prisma.orderItem.count({ where: { orderId: item.order.id } }),
    prisma.payment.count({ where: { orderId: item.order.id } }),
  ]);
  if (remaining === 0 && payments === 0) {
    await prisma.order.delete({ where: { id: item.order.id } });
  }

  return { error: null, success: true };
}

// itemIds: pay for only these items of the cart; the others move to a
// cart of their own and stay there for later. Omitted = the whole cart.
// Items without content can be paid for too ("Nu betalen, later
// aanleveren") — but only once the customer has seen that (acceptUnfilled).
export async function checkoutCartAction(
  orderId: string,
  itemIds?: string[],
  options: { acceptUnfilled?: boolean } = {}
): Promise<CheckoutState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan." };
  }

  if (!options.acceptUnfilled) {
    const items = await prisma.orderItem.findMany({
      where: { orderId, order: { customerId: session.user.id, status: "NEW" } },
      include: { websiteProduct: { include: { product: true } } },
    });
    const paying = itemIds ? items.filter((i) => itemIds.includes(i.id)) : items;
    if (paying.some((i) => itemNeedsContent(i, i.websiteProduct.product.type))) {
      return { error: null, needsConfirm: true, orderId };
    }
  }

  if (itemIds) {
    const cart = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!cart || cart.customerId !== session.user.id || cart.status !== "NEW") {
      return { error: "Niet toegestaan." };
    }
    const chosen = new Set(itemIds);
    if (chosen.size === 0 || itemIds.some((id) => !cart.items.some((i) => i.id === id))) {
      return { error: "Kies minstens één item om af te rekenen." };
    }
    const rest = cart.items.filter((i) => !chosen.has(i.id));
    if (rest.length > 0) {
      await expireOpenPayments(cart.id);
      await prisma.$transaction(async (tx) => {
        const later = await tx.order.create({
          data: { customerId: cart.customerId, projectId: cart.projectId },
        });
        await tx.orderItem.updateMany({
          where: { id: { in: rest.map((i) => i.id) } },
          data: { orderId: later.id },
        });
      });
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          websiteProduct: { include: { website: { include: { company: true } }, product: true } },
          renewsOrderItem: { include: { placement: true } },
        },
      },
    },
  });
  if (!order || order.customerId !== session.user.id || order.status !== "NEW") {
    return { error: "Niet toegestaan." };
  }
  if (order.items.length === 0) {
    return { error: "Winkelmandje is leeg." };
  }
  // A placement that already went offline can't be renewed any more.
  const lapsed = order.items.find((i) => i.renewsOrderItemId && i.renewsOrderItem?.placement?.status !== "published");
  if (lapsed) {
    return {
      error: `De plaatsing op ${lapsed.websiteProduct.website.domain} is al verlopen en kan niet meer verlengd worden. Haal de verlenging uit je winkelmandje.`,
    };
  }

  // An invoice needs the customer's address (see src/lib/invoices.ts). A
  // VAT number VIES couldn't check before gets one more try now.
  if (session.user.companyId) await retryUnreachableVatCheck(session.user.companyId);
  const company = session.user.companyId
    ? await prisma.company.findUnique({ where: { id: session.user.companyId } })
    : null;
  if (!company || !billingDetailsComplete(company)) {
    return { error: "Vul eerst je gegevens voor de factuur in (onder je items)." };
  }

  // Fix the VAT on the order now: what's charged below and what ends up on
  // the invoice must be the same, even if the rate or the customer's
  // details change later. 21%, or none for a business abroad.
  const vat = vatTreatment(company);
  await prisma.order.update({ where: { id: order.id }, data: { vatRate: vat.rate, vatNote: vat.note } });
  const totals = vatTotals(order.items.map(itemPrice), vat.rate);

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  // Off while the platform only sells the operator's own sites — there's no
  // separate publisher to split a payout to, so there's nothing to gate on.
  // Flip this on once real third-party publishers are onboarded.
  const publisherPayoutsEnabled = process.env.PUBLISHER_PAYOUTS_ENABLED === "true";

  // A cart can hold links from several different publishers — Stripe can
  // only route one destination per PaymentIntent, so we charge the full
  // amount to the platform here and split it into separate Transfers per
  // publisher afterward, once payment is confirmed (see the webhook).
  // Skipped entirely in test mode below, since there's no real payout to
  // gate on a publisher's (nonexistent, without real Stripe) onboarding.
  if (stripeConfigured && publisherPayoutsEnabled) {
    for (const item of order.items) {
      const company = item.websiteProduct.website.company;
      if (!company.stripeAccountId || !company.stripeAccountOnboarded) {
        return {
          error: `Publisher van ${item.websiteProduct.website.domain} heeft de uitbetaling nog niet ingesteld.`,
        };
      }
    }
  }

  // Test mode: no STRIPE_SECRET_KEY configured at all (true on a fresh
  // deploy before the owner has added their own Stripe account) — lets the
  // full order lifecycle be exercised end to end without any payment
  // provider. This path stops being reachable the moment a real key is set,
  // since stripeConfigured becomes true and real Checkout takes over below.
  if (!stripeConfigured) {
    const total = totals.total;
    const fakeRef = `test_${order.id}`;
    await prisma.payment.create({
      data: { orderId: order.id, provider: "test", providerRef: fakeRef, amount: total, status: "pending" },
    });
    await fulfillPaidOrder(order.id, fakeRef, null);
    return { error: null, testMode: true, orderId: order.id };
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: order.items
        .map((item) => ({
          price_data: {
            currency: "eur",
            unit_amount: Math.round(itemPrice(item).toNumber() * 100),
            product_data: {
              name: item.renewsOrderItemId
                ? `${item.websiteProduct.website.domain} — verlenging ${durationLabel(item.durationYears)}`
                : `${item.websiteProduct.website.domain} — plaatsing${
                    item.topicNameSnap ? ` (${item.topicNameSnap})` : ""
                  }${
                    item.periodic ? ` ${durationLabel(item.durationYears)}` : ""
                  }${item.writeForMe ? " + artikel schrijven" : ""}`,
            },
          },
          quantity: 1,
        }))
        .concat(
          vat.rate > 0
            ? [
                {
                  price_data: {
                    currency: "eur",
                    unit_amount: Math.round(totals.vat * 100),
                    product_data: { name: `BTW ${vat.rate}%` },
                  },
                  quantity: 1,
                },
              ]
            : []
        ),
      payment_intent_data: {
        transfer_group: order.id,
        metadata: { orderId: order.id },
      },
      metadata: { orderId: order.id },
      success_url: `${appUrl}/dashboard/orders/${order.id}?checkout=success`,
      cancel_url: `${appUrl}/dashboard/cart?checkout=cancelled`,
    });

    const total = totals.total;
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
