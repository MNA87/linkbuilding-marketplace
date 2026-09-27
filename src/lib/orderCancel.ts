import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { issueCreditInvoiceForOrder } from "@/lib/invoices";

// Paid and not yet placed or finished: an admin can still cancel it.
export const ADMIN_CANCELLABLE_STATUSES: OrderStatus[] = ["PAID", "SENT_TO_PUBLISHER", "ACCEPTED", "IN_PROGRESS", "REFUND_REQUESTED"];

// Cancels a paid order and gives the money back: Stripe refund (after
// reversing any publisher transfers), payment marked refunded, order
// CANCELLED, nothing of it left queued for a site, and a credit invoice.
// A test payment (no Stripe) has nothing to refund.
export async function cancelAndRefundOrder(orderId: string): Promise<{ error: string | null }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order || !ADMIN_CANCELLABLE_STATUSES.includes(order.status)) {
    return { error: "Deze order kan niet (meer) geannuleerd worden." };
  }
  const payment = order.payments.find((p) => p.status === "paid");
  if (!payment?.providerRef) {
    return { error: "Geen betaling gevonden om terug te betalen." };
  }

  if (payment.provider !== "test") {
    try {
      const stripe = getStripe();
      // Money to publishers went out as separate Transfers (a cart can span
      // multiple publishers, so it was never tied to the PaymentIntent via
      // transfer_data) — reverse each one before refunding the customer, or
      // the platform balance goes negative by exactly that amount.
      const transfers = await stripe.transfers.list({ transfer_group: order.id, limit: 100 });
      for (const transfer of transfers.data) {
        await stripe.transfers.createReversal(transfer.id);
      }
      await stripe.refunds.create({ payment_intent: payment.providerRef });
    } catch (err) {
      console.error("Refund failed for order", orderId, err);
      return { error: "Terugbetalen via Stripe is mislukt. Probeer het opnieuw of doe het handmatig in Stripe." };
    }
  }

  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } }),
    prisma.payment.update({ where: { id: payment.id }, data: { status: "refunded" } }),
    // Nothing of a cancelled order may still go out to a site.
    prisma.orderItem.updateMany({ where: { orderId }, data: { readyToPublish: false } }),
  ]);

  // The money is back with the customer, so the invoice gets cancelled.
  // A failure here mustn't report the (already done) refund as failed.
  await issueCreditInvoiceForOrder(orderId).catch((err) =>
    console.error("Creditfactuur aanmaken mislukt voor order", orderId, err)
  );
  return { error: null };
}
