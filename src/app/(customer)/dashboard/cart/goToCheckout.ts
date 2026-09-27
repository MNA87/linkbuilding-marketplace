import { checkoutCartAction } from "./actions";

// Straight to Stripe after "Opslaan en naar betalen". When the cart holds
// items that aren't filled in yet, the cart shows which ones first
// (?afrekenen=1 opens "Klaar om af te rekenen?" there); on any other
// problem the cart page is the right fallback too.
export async function goToCheckout(orderId: string, push: (href: string) => void) {
  const result = await checkoutCartAction(orderId).catch(() => null);
  if (result?.checkoutUrl) {
    window.location.href = result.checkoutUrl;
    return;
  }
  if (result?.testMode && result.orderId) {
    push(`/dashboard/orders/${result.orderId}?checkout=success&test=true`);
    return;
  }
  push(result?.needsConfirm ? "/dashboard/cart?afrekenen=1" : "/dashboard/cart");
}
