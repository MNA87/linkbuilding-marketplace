"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import CheckoutButton from "./CheckoutButton";
import { removeCartItemAction } from "./actions";
import { VAT_RATE, vatTotals } from "@/lib/vat";

export type CartItemView = {
  id: string;
  websiteProductId: string;
  productName: string; // "Blogartikel", "Homepage-link", "Verlenging …"
  domain: string;
  title: string | null; // article title or anchor text
  hasContent: boolean;
  isRenewal: boolean;
  period: string; // "1 jaar", "+2 jaar"
  online: string; // "Direct na betaling", "25-9-2026 t/m 25-9-2027"
  price: number;
};

export type CartView = { id: string; items: CartItemView[] };

const euro = (n: number) => `€${n.toFixed(2)}`;

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

  async function remove(ids: string[]) {
    setError(null);
    setRemoved((prev) => new Set(Array.from(prev).concat(ids)));
    const failed: string[] = [];
    for (const id of ids) {
      const result = await removeCartItemAction(id).catch(() => null);
      if (!result?.success) failed.push(id);
    }
    if (failed.length) {
      setRemoved((prev) => new Set(Array.from(prev).filter((id) => !failed.includes(id))));
      setError("Verwijderen lukte niet. Probeer het opnieuw.");
    }
    router.refresh();
  }

  const visible = carts
    .map((cart) => ({ ...cart, items: cart.items.filter((i) => !removed.has(i.id)) }))
    .filter((cart) => cart.items.length > 0);

  if (visible.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-lg p-8 text-center text-inkSoft text-sm">
        Je winkelmandje is leeg.{" "}
        <Link href="/marketplace" className="text-brand hover:underline">
          Bekijk de marketplace
        </Link>
        .
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}
      {visible.map((cart) => {
        const totals = vatTotals(
          cart.items.map((i) => i.price),
          VAT_RATE
        );
        return (
          <div key={cart.id} className="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_18rem] mb-6">
            <div className="min-w-0">
              <div className="bg-surface border border-line rounded-lg overflow-hidden">
                {/* Table on wider screens */}
                <table className="hidden md:table w-full text-sm">
                  <thead className="bg-brandSoft/50 text-inkSoft text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Product</th>
                      <th className="px-4 py-2 font-medium">Website</th>
                      <th className="px-4 py-2 font-medium">Periode</th>
                      <th className="px-4 py-2 font-medium">Online</th>
                      <th className="px-4 py-2 font-medium text-right">Prijs</th>
                      <th className="px-4 py-2 font-medium sr-only">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map((item) => (
                      <tr key={item.id} className="border-t border-line align-top">
                        <td className="px-4 py-3">
                          <div className="text-ink font-medium">{item.productName}</div>
                          <ItemTitle item={item} />
                        </td>
                        <td className="px-4 py-3 text-ink">{item.domain}</td>
                        <td className="px-4 py-3 text-inkSoft whitespace-nowrap">{item.period}</td>
                        <td className="px-4 py-3 text-inkSoft">{item.online}</td>
                        <td className="px-4 py-3 text-right text-ink font-medium whitespace-nowrap">{euro(item.price)}</td>
                        <td className="px-4 py-3">
                          <ItemActions item={item} onRemove={() => remove([item.id])} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Cards on phones */}
                <ul className="md:hidden divide-y divide-line">
                  {cart.items.map((item) => (
                    <li key={item.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-ink font-medium">
                            {item.productName} · {item.domain}
                          </div>
                          <ItemTitle item={item} />
                          <div className="text-xs text-inkSoft mt-1">
                            {item.period} · {item.online}
                          </div>
                        </div>
                        <div className="text-ink font-medium whitespace-nowrap">{euro(item.price)}</div>
                      </div>
                      <div className="mt-2">
                        <ItemActions item={item} onRemove={() => remove([item.id])} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Alle items uit je winkelmandje verwijderen?")) remove(cart.items.map((i) => i.id));
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-inkSoft hover:text-red-600"
              >
                <Trash2 size={14} />
                Mandje leegmaken
              </button>

              {billingForm && <div className="mt-6">{billingForm}</div>}
            </div>

            <aside className="bg-surface border border-line rounded-lg p-5 lg:sticky lg:top-4">
              <h2 className="font-medium text-ink mb-4">Je bestelling</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-inkSoft">
                  <dt>
                    Subtotaal ({cart.items.length} {cart.items.length === 1 ? "item" : "items"})
                  </dt>
                  <dd>{euro(totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between text-inkSoft">
                  <dt>BTW {VAT_RATE}%</dt>
                  <dd>{euro(totals.vat)}</dd>
                </div>
                <div className="flex justify-between text-ink font-semibold text-base pt-3 mt-1 border-t border-line">
                  <dt>Totaal</dt>
                  <dd>{euro(totals.total)}</dd>
                </div>
              </dl>
              <div className="mt-5">
                {billingForm && (
                  <p className="text-xs text-amber-700 mb-2">Vul eerst je factuurgegevens in (onder je items).</p>
                )}
                <CheckoutButton orderId={cart.id} testMode={testMode} />
              </div>
            </aside>
          </div>
        );
      })}
    </>
  );
}

function ItemTitle({ item }: { item: CartItemView }) {
  if (item.isRenewal) return null;
  if (!item.hasContent) {
    return (
      <Link
        href={`/marketplace/${item.websiteProductId}?orderItemId=${item.id}`}
        className="text-xs text-amber-700 font-medium hover:underline"
      >
        Nog invullen →
      </Link>
    );
  }
  return item.title ? <div className="text-xs text-inkSoft truncate max-w-[16rem]">{item.title}</div> : null;
}

function ItemActions({ item, onRemove }: { item: CartItemView; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {!item.isRenewal && (
        <Link
          href={`/marketplace/${item.websiteProductId}?orderItemId=${item.id}`}
          aria-label="Bewerken"
          title="Bewerken"
          className="p-1.5 rounded-md text-inkSoft hover:bg-brandSoft hover:text-ink"
        >
          <Pencil size={15} />
        </Link>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Verwijderen"
        title="Verwijderen"
        className="p-1.5 rounded-md text-inkSoft hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
