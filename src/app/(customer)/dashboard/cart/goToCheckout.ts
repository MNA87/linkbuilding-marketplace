import { checkoutCartAction } from "./actions";

// Straight to Stripe after "Opslaan en naar betalen". If that can't happen
// (e.g. another item in the cart has no content yet), the cart page is the
// right fallback: it shows exactly which item still needs filling in.
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
  push("/dashboard/cart");
}
