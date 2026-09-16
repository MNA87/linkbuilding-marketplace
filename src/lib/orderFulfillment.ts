import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendOrderConfirmationEmail, sendNewOrderNotificationEmail } from "@/lib/email";

// Shared by the Stripe webhook and the admin reconciliation job — both
// paths land here once a checkout is confirmed paid, so there's exactly
// one place that marks an order PAID, creates its invoice, splits the
// payout across publishers, and sends the notification emails.
export async function fulfillPaidOrder(
  orderId: string,
  checkoutSessionId: string,
  paymentIntentId: string | null
): Promise<void> {
  const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
  // Idempotency: this can be called more than once for the same order
  // (a retried webhook delivery, or reconciliation re-checking a session
  // the webhook already handled) — only run the one-time side effects the
  // first time it actually leaves NEW.
  const alreadyProcessed = existingOrder?.status !== "NEW";

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.payment.updateMany({
      where: { orderId, providerRef: checkoutSessionId },
      data: { status: "paid", providerRef: paymentIntentId ?? checkoutSessionId },
    }),
  ]);

  if (alreadyProcessed) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: {
        include: {
          websiteProduct: { include: { website: { include: { company: { include: { users: true } } } } } },
        },
      },
    },
  });
  if (!order) return;

  const totalAmount = order.items.reduce((sum, i) => sum + i.customerPriceSnap.toNumber(), 0).toFixed(2);
  const domains = order.items.map((i) => i.websiteProduct.website.domain).join(", ");

  if (order.customer.companyId) {
    await prisma.invoice.upsert({
      where: { orderId: order.id },
      create: {
        invoiceNumber: `INV-${new Date().getFullYear()}-${order.id.slice(-8).toUpperCase()}`,
        amount: totalAmount,
        customerCompanyId: order.customer.companyId,
        orderId: order.id,
      },
      update: {},
    });
  }

  // A cart can hold links from several publishers, so the charge went to
  // the platform in full (no transfer_data on the PaymentIntent) — split it
  // out per publisher now with separate Transfers, tied to the original
  // charge via source_transaction so it draws from those specific funds
  // rather than the platform's general balance.
  if (paymentIntentId) {
    try {
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const chargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : undefined;

      const byPublisher = new Map<string, { stripeAccountId: string; amount: number }>();
      for (const item of order.items) {
        const company = item.websiteProduct.website.company;
        if (!company.stripeAccountId) continue;
        const existing = byPublisher.get(company.id);
        const amount = item.supplierPriceSnap.toNumber();
        byPublisher.set(company.id, {
          stripeAccountId: company.stripeAccountId,
          amount: (existing?.amount ?? 0) + amount,
        });
      }

      for (const [companyId, { stripeAccountId, amount }] of Array.from(byPublisher)) {
        await stripe.transfers.create({
          amount: Math.round(amount * 100),
          currency: "eur",
          destination: stripeAccountId,
          transfer_group: order.id,
          source_transaction: chargeId,
          metadata: { orderId: order.id, companyId },
        });
      }
    } catch (err) {
      // Payment already succeeded — a transfer failure must not look like
      // an overall failure to the caller (the webhook would get retried by
      // Stripe; reconciliation would re-run the whole thing). Log loudly so
      // an admin can create the transfer manually from the Stripe dashboard.
      console.error(`Publisher transfer(s) failed for order ${order.id}`, err);
    }
  }

  await sendOrderConfirmationEmail(order.customer.email, order.id, domains, totalAmount);

  // Off while the platform only sells the operator's own sites — see the
  // matching flag in the cart checkout action.
  const publisherPayoutsEnabled = process.env.PUBLISHER_PAYOUTS_ENABLED === "true";
  if (publisherPayoutsEnabled) {
    const notifiedCompanies = new Set<string>();
    for (const item of order.items) {
      const company = item.websiteProduct.website.company;
      if (notifiedCompanies.has(company.id)) continue;
      notifiedCompanies.add(company.id);
      const publisherUser = company.users[0];
      if (publisherUser) {
        await sendNewOrderNotificationEmail(
          publisherUser.email,
          item.websiteProduct.website.domain,
          item.customerPriceSnap.toFixed(2)
        );
      }
    }
  }
}
