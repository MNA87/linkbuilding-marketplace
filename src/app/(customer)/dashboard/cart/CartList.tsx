"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Clock, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import CheckoutButton from "./CheckoutButton";
import EmptyCart from "./EmptyCart";
import { showErrorBox } from "@/lib/formValidation";
import { removeCartItemAction } from "./actions";
import { vatTotals } from "@/lib/vat";
import type { VatTreatment } from "@/lib/vatRules";

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
  autoConfirm = false,
  offerSites,
  vat,
}: {
  carts: CartView[];
  // The VAT for this customer: 21%, or none for a business abroad
  // (src/lib/vatRules.ts).
  vat: VatTreatment;
  // How many sites offer each kind — for the empty cart's two cards.
  offerSites: Record<"BLOG_POST" | "HOMEPAGE_LINK", number>;
  testMode: boolean;
  billingForm: React.ReactNode;
  // From an order form's "Afrekenen" with unfilled items: open the
  // "Klaar om af te rekenen?" overview straight away.
  autoConfirm?: boolean;
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  // What will be paid for: everything, to start with, so the total shows
  // the whole cart. Unticking an item leaves it behind for later.
  const [unselected, setUnselected] = useState<Set<string>>(() => new Set());
  const toggle = (ids: string[], on: boolean) =>
    setUnselected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.delete(id);
        else next.add(id);
      }
      return next;
    });
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
    return <EmptyCart sites={offerSites} />;
  }

  return (
    <>
      {error && (
        <div
          ref={showErrorBox}
          className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"
        >
          {error}
        </div>
      )}
      {visible.map((cart, cartIndex) => {
        const chosen = cart.items.filter((i) => !unselected.has(i.id));
        const allChosen = chosen.length === cart.items.length;
        const totals = vatTotals(
          chosen.map((i) => i.price),
          vat.rate
        );
        // Items still waiting for their content. They can be paid for all
        // the same (and filled in afterwards) — the checkout shows which.
        const unfilled = cart.items.filter((i) => !isReady(i));
        const chosenUnfilled = chosen.filter((i) => !isReady(i));
        const fillHref = (items: CartItemView[]) =>
          `/marketplace/${items[0].websiteProductId}?orderItemId=${items[0].id}${
            items.length > 1 ? `&stap=1&van=${items.length}` : ""
          }`;
        return (
          <div key={cart.id} className="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_18rem] mb-6">
            <div className="min-w-0">
              <ul className="space-y-2.5">
                {cart.items.map((item) => {
                  const ready = isReady(item);
                  const off = unselected.has(item.id);
                  const editHref = `/marketplace/${item.websiteProductId}?orderItemId=${item.id}`;
                  return (
                    <li
                      key={item.id}
                      // "Later aanleveren" is a deliberate choice, not an error —
                      // so no amber warning tint; the calm status badge says it.
                      className={`flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 sm:gap-4 sm:p-4 ${
                        off ? "opacity-55" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`${item.productName} op ${item.domain} afrekenen`}
                        checked={!off}
                        onChange={(e) => toggle([item.id], e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-[var(--btn-pay-bg,#0d9488)]"
                      />
                      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brandSoft/60 text-inkSoft sm:flex">
                        <FileText size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink">{item.domain}</div>
                        <div className="truncate text-xs text-inkSoft">
                          {item.productName} · {item.period}
                          {/* "Direct na betaling" only applies once it's filled in;
                              for a "volgt later" item the timing is set later. */}
                          {ready && ` · ${item.online}`}
                        </div>
                      </div>
                      {ready ? (
                        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
                          <Check size={12} strokeWidth={3} /> Ingevuld
                        </span>
                      ) : (
                        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-brand/30 bg-brandSoft px-2.5 py-0.5 text-xs font-semibold text-brand sm:inline-flex">
                          <Clock size={12} /> Artikel volgt later
                        </span>
                      )}
                      <div className="w-16 shrink-0 text-right font-semibold text-ink tabular-nums sm:w-20">
                        {euro(item.price)}
                      </div>
                      {item.isRenewal ? (
                        <span className="w-[72px] shrink-0" />
                      ) : ready ? (
                        <Link
                          href={editHref}
                          className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-brandSoft"
                        >
                          Bewerken
                        </Link>
                      ) : (
                        // Still possible to fill it in now, but calm — not an amber
                        // call-to-action, since delivering later is a valid choice.
                        <Link
                          href={editHref}
                          className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-brandSoft"
                        >
                          Invullen →
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => remove([item.id])}
                        aria-label="Verwijderen"
                        title="Verwijderen"
                        className="shrink-0 rounded-md p-1.5 text-inkSoft hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--btn-pay-bg,#0d9488)] hover:underline"
                  >
                    <Plus size={15} />
                    Nog een link toevoegen
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Alle items uit je winkelmandje verwijderen?"))
                        remove(cart.items.map((i) => i.id));
                    }}
                    className="inline-flex items-center gap-1.5 text-sm text-inkSoft hover:text-red-600"
                  >
                    <Trash2 size={14} />
                    Mandje leegmaken
                  </button>
                </div>
                {unfilled.length > 0 && (
                  // More than one: fill them in one after another ("Item 1 van 2").
                  <Link
                    href={fillHref(unfilled)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-brandSoft"
                  >
                    <Pencil size={14} />
                    {unfilled.length === 1 ? "1 artikel nu invullen" : `${unfilled.length} artikelen nu invullen`}
                  </Link>
                )}
              </div>

              {billingForm && <div className="mt-6">{billingForm}</div>}
            </div>

            <aside className="bg-surface border border-line rounded-lg p-5 lg:sticky lg:top-4">
              <h2 className="font-medium text-ink mb-4">Je bestelling</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-inkSoft">
                  <dt>
                    Subtotaal ({allChosen ? cart.items.length : `${chosen.length} van ${cart.items.length}`}{" "}
                    {cart.items.length === 1 ? "item" : "items"})
                  </dt>
                  <dd>{euro(totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between text-inkSoft">
                  <dt>
                    {vat.note === "reverse"
                      ? "BTW verlegd"
                      : vat.note === "outside_eu"
                        ? "Geen Nederlandse btw (buiten de EU)"
                        : `BTW ${vat.rate}%`}
                  </dt>
                  <dd>{euro(totals.vat)}</dd>
                </div>
                <div className="flex justify-between text-ink font-semibold text-base pt-3 mt-1 border-t border-line">
                  <dt>Totaal</dt>
                  <dd>{euro(totals.total)}</dd>
                </div>
              </dl>
              {chosenUnfilled.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="flex items-center justify-between text-xs text-inkSoft">
                    <span>Ingevuld</span>
                    <span>
                      {chosen.length - chosenUnfilled.length} van {chosen.length}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-line/70">
                    <span
                      className="block h-full rounded bg-[var(--btn-pay-bg,#0d9488)]"
                      style={{ width: `${((chosen.length - chosenUnfilled.length) / chosen.length) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-inkSoft">
                    Je kunt nu afrekenen; de rest vul je later aan vanuit Mijn orders.
                  </p>
                </div>
              )}
              <div className="mt-5">
                {billingForm && (
                  <p className="text-xs text-amber-700 mb-2">
                    Vul eerst je gegevens voor de factuur in (onder je items).
                  </p>
                )}
                {!allChosen && chosen.length > 0 && (
                  <p className="text-xs text-inkSoft mb-2">De andere items blijven in je mandje staan.</p>
                )}
                <CheckoutButton
                  orderId={cart.id}
                  testMode={testMode}
                  itemIds={chosen.map((i) => i.id)}
                  disabled={chosen.length === 0}
                  onError={setError}
                  autoOpen={autoConfirm && cartIndex === 0}
                  confirm={
                    chosenUnfilled.length > 0
                      ? {
                          ready: chosen.filter(isReady).map((i) => ({ id: i.id, domain: i.domain })),
                          unfilled: chosenUnfilled.map((i) => ({ id: i.id, domain: i.domain })),
                          total: euro(totals.total).replace(".", ","),
                          fillHref: fillHref(chosenUnfilled),
                        }
                      : undefined
                  }
                />
              </div>
            </aside>
          </div>
        );
      })}
    </>
  );
}

// Filled in, so it can be paid for (a renewal has nothing to fill in).
function isReady(item: CartItemView): boolean {
  return item.isRenewal || item.hasContent;
}
