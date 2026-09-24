import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

// The cart's content changed, so a checkout started earlier (the customer
// went to Stripe and came back) must not be payable any more for the old
// content.
export async function expireOpenPayments(orderId: string): Promise<void> {
  const openPayments = await prisma.payment.findMany({ where: { orderId, status: "pending" } });
  for (const payment of openPayments) {
    if (payment.provider === "stripe" && payment.providerRef) {
      try {
        await getStripe().checkout.sessions.expire(payment.providerRef);
      } catch {
        // Already expired or completed, or Stripe not configured — nothing to stop.
      }
    }
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "expired" } });
  }
}

// Paying for only some items moves the rest into a cart of their own (see
// checkoutCartAction). If that checkout is then abandoned the customer has
// two carts — fold them back into one the next time the cart is shown.
export async function consolidateCarts(customerId: string): Promise<void> {
  const carts = await prisma.order.findMany({
    where: { customerId, status: "NEW", items: { some: {} } },
    orderBy: { createdAt: "asc" },
  });
  if (carts.length < 2) return;
  const [target, ...others] = carts;
  for (const order of carts) await expireOpenPayments(order.id);
  await prisma.orderItem.updateMany({
    where: { orderId: { in: others.map((o) => o.id) } },
    data: { orderId: target.id },
  });
}

