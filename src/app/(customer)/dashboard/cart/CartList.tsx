"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, Clock, FileText, PenLine, Plus, Trash2 } from "lucide-react";
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
  // The customer chose "Later aanleveren" (vs an empty item that still needs
  // a decision — "Actie nodig").
  deliverLater: boolean;
  // "Laat ons schrijven" — we write the article (shows "Wij schrijven").
  writeForMe: boolean;
  isHomepageLink: boolean;
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
      {visible.map((cart) => {
        const chosen = cart.items.filter((i) => !unselected.has(i.id));
        const allChosen = chosen.length === cart.items.length;
        const totals = vatTotals(
          chosen.map((i) => i.price),
          vat.rate
        );
        return (
          <div key={cart.id} className="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_18rem] mb-6">
            <div className="min-w-0">
              <ul className="space-y-2.5">
                {cart.items.map((item) => {
                  // Three states for an empty (unfilled) item: a deliberate
                  // "Artikel volgt later" (a finished choice), or "Actie nodig"
                  // — added but nothing chosen yet, so the customer must still act.
                  const empty = !item.isRenewal && !item.hasContent;
                  const later = empty && item.deliverLater;
                  const actionNeeded = empty && !item.deliverLater;
                  const actionLabel = item.isHomepageLink ? "Doel-URL nog invullen" : "Artikel nog aanleveren";
                  const off = unselected.has(item.id);
                  const editHref = `/marketplace/${item.websiteProductId}?orderItemId=${item.id}`;
                  return (
                    <li
                      key={item.id}
                      // "Actie nodig" gets an amber tint to nudge; a deliberate
                      // "volgt later" and a filled item stay calm.
                      className={`flex items-center gap-3 rounded-xl border p-3.5 sm:gap-4 sm:p-4 ${
                        actionNeeded ? "border-amber-200 bg-amber-50/40" : "border-line bg-surface"
                      } ${off ? "opacity-55" : ""}`}
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
                              for an empty item (volgt later / actie nodig) the
                              timing is decided later. */}
                          {!empty && ` · ${item.online}`}
                        </div>
                      </div>
                      {/* All status pills share one fixed width so the prices and
                          buttons line up straight down the list, whatever the label. */}
                      {actionNeeded ? (
                        <span className="hidden shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 sm:inline-flex sm:w-48">
                          <AlertTriangle size={12} /> {actionLabel}
                        </span>
                      ) : later ? (
                        <span className="hidden shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-brand/30 bg-brandSoft px-2.5 py-0.5 text-xs font-semibold text-brand sm:inline-flex sm:w-48">
                          <Clock size={12} /> Artikel volgt later
                        </span>
                      ) : item.writeForMe ? (
                        <span className="hidden shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 sm:inline-flex sm:w-48">
                          <PenLine size={12} /> Wij schrijven
                        </span>
                      ) : (
                        <span className="hidden shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 sm:inline-flex sm:w-48">
                          <Check size={12} strokeWidth={3} /> Ingevuld
                        </span>
                      )}
                      <div className="w-16 shrink-0 text-right font-semibold text-ink tabular-nums sm:w-20">
                        {euro(item.price)}
                      </div>
                      {/* "Actie nodig" gets a clear call-to-action; the rest are
                          editable (fill in now or change the niche) but calm. */}
                      {item.isRenewal ? (
                        <span className="w-[72px] shrink-0" />
                      ) : actionNeeded ? (
                        <Link
                          href={editHref}
                          className="shrink-0 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                        >
                          Invullen →
                        </Link>
                      ) : (
                        <Link
                          href={editHref}
                          className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-brandSoft"
                        >
                          Bewerken
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
              <div className="mt-5">
                {billingForm && (
                  <p className="text-xs text-amber-700 mb-2">
                    Vul eerst je gegevens voor de factuur in (onder je items).
                  </p>
                )}
                {!allChosen && chosen.length > 0 && (
                  <p className="text-xs text-inkSoft mb-2">De andere items blijven in je mandje staan.</p>
                )}
                {/* No "nog in te vullen" overview anymore: a "volgt later" item is
                    a finished choice, so the whole cart just checks out. */}
                <CheckoutButton
                  orderId={cart.id}
                  testMode={testMode}
                  itemIds={chosen.map((i) => i.id)}
                  disabled={chosen.length === 0}
                  onError={setError}
                />
              </div>
            </aside>
          </div>
        );
      })}
    </>
  );
}
