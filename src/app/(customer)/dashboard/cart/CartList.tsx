"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CartItemRow, { type CartItemView } from "./CartItemRow";
import CheckoutButton from "./CheckoutButton";
import { removeCartItemAction } from "./actions";
import { VAT_RATE, vatTotals } from "@/lib/vat";

export type CartView = { id: string; projectName: string; items: CartItemView[] };

// Removing an item hides it straight away (and with it the totals and the
// checkout button once a cart is empty) — the server round trip and page
// refresh happen in the background, so one click is always enough.
export default function CartList({
  carts,
  testMode,
  billingForm,
}: {
  carts: CartView[];
  testMode: boolean;
  billingForm: React.ReactNode;
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function remove(orderItemId: string) {
    setError(null);
    setRemoved((prev) => new Set(prev).add(orderItemId));
    const result = await removeCartItemAction(orderItemId).catch(() => null);
    if (!result?.success) {
      setRemoved((prev) => {
        const next = new Set(prev);
        next.delete(orderItemId);
        return next;
      });
      setError("Verwijderen lukte niet. Probeer het opnieuw.");
      return;
    }
    router.refresh();
  }

  const visible = carts
    .map((cart) => ({ ...cart, items: cart.items.filter((i) => !removed.has(i.id)) }))
    .filter((cart) => cart.items.length > 0);
  const itemCount = visible.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <>
      <p className="text-sm text-inkSoft mb-6">{itemCount} item(s) klaar om af te rekenen</p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      {visible.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-8 text-center text-inkSoft text-sm">
          Je winkelmandje is leeg.{" "}
          <Link href="/marketplace" className="text-brand hover:underline">
            Bekijk de marketplace
          </Link>
          .
        </div>
      ) : (
        billingForm
      )}

      <div className="space-y-6">
        {visible.map((cart) => {
          const totals = vatTotals(
            cart.items.map((i) => i.price),
            VAT_RATE
          );
          return (
            <div key={cart.id} className="bg-surface border border-line rounded-lg p-4">
              <div className="font-medium text-ink mb-3">{cart.projectName}</div>
              <div className="space-y-2 mb-4">
                {cart.items.map((item) => (
                  <CartItemRow key={item.id} item={item} onRemove={() => remove(item.id)} />
                ))}
              </div>
              <div className="flex items-end justify-between gap-4 pt-3 border-t border-line">
                <div className="text-sm text-inkSoft space-y-0.5">
                  <div>Subtotaal excl. BTW: &euro;{totals.subtotal.toFixed(2)}</div>
                  <div>
                    BTW {VAT_RATE}%: &euro;{totals.vat.toFixed(2)}
                  </div>
                  <div>
                    Totaal: <span className="text-ink font-medium">&euro;{totals.total.toFixed(2)}</span>
                  </div>
                </div>
                <CheckoutButton orderId={cart.id} testMode={testMode} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
