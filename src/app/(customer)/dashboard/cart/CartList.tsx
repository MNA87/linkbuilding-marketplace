"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, Clock, PenLine, Plus, Trash2 } from "lucide-react";
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

// An item that was added but has no content and wasn't deliberately set to
// "Later aanleveren" still needs a decision ("Actie nodig"). It blocks checkout
// until it's filled in, set to "Later aanleveren", or removed.
const needsAction = (i: CartItemView) => !i.isRenewal && !i.hasContent && !i.deliverLater;

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
        // "Actie nodig" items are left out of the selection entirely (and their
        // checkbox is disabled below), so an empty item is never paid for — it
        // just waits in the cart until it's filled in or removed.
        const chosen = cart.items.filter((i) => !unselected.has(i.id) && !needsAction(i));
        const payable = cart.items.filter((i) => !needsAction(i));
        const allChosen = chosen.length === payable.length;
        const actionNeededCount = cart.items.length - payable.length;
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
                  const actionNeeded = needsAction(item);
                  // The "done" wording per type (a renewal has nothing to add).
                  const doneText = item.isRenewal
                    ? "Toegevoegd"
                    : item.isHomepageLink
                      ? "Link toegevoegd"
                      : "Artikel toegevoegd";
                  // One source of truth for the status, shown as a pill on desktop
                  // and a small line under the domain on mobile (where the pill
                  // doesn't fit). `short` is the mobile wording.
                  const statusView = actionNeeded
                    ? { text: "Actie nodig", short: "Actie nodig", Icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-700" }
                    : later
                      ? { text: "Artikel volgt later", short: "Volgt later", Icon: Clock, cls: "border-brand/30 bg-brandSoft text-brand" }
                      : item.writeForMe
                        ? { text: "Wij schrijven", short: "Wij schrijven", Icon: PenLine, cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
                        : { text: doneText, short: "Toegevoegd", Icon: Check, cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
                  const StatusIcon = statusView.Icon;
                  const off = unselected.has(item.id);
                  const editHref = `/marketplace/${item.websiteProductId}?orderItemId=${item.id}`;
                  // Defined once, reused in the mobile and desktop layouts below.
                  // Every item (actie nodig included) edits via the same calm
                  // "Bewerken"; the amber status + tint carry the nudge.
                  const actionButton = item.isRenewal ? (
                    <span className="w-[72px] shrink-0" />
                  ) : (
                    <Link
                      href={editHref}
                      className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-brandSoft"
                    >
                      Bewerken
                    </Link>
                  );
                  const trashButton = (
                    <button
                      type="button"
                      onClick={() => remove([item.id])}
                      aria-label="Verwijderen"
                      title="Verwijderen"
                      className="shrink-0 rounded-md p-1.5 text-inkSoft hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  );
                  return (
                    <li
                      key={item.id}
                      // Mobile: price sits top-right next to the domain, with status
                      // and buttons on the line below. Desktop (sm+): one row.
                      // "Actie nodig" gets an amber tint; the rest stay calm.
                      className={`flex items-start gap-3 rounded-xl border p-3.5 sm:items-center sm:gap-4 sm:p-4 ${
                        actionNeeded ? "border-amber-200 bg-amber-50/40" : "border-line bg-surface"
                      } ${off ? "opacity-55" : ""}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={
                          actionNeeded
                            ? `${item.productName} op ${item.domain} — eerst invullen om af te rekenen`
                            : `${item.productName} op ${item.domain} afrekenen`
                        }
                        // "Actie nodig": never part of the order until it's
                        // filled in, so it's unticked and can't be ticked.
                        checked={!off && !actionNeeded}
                        disabled={actionNeeded}
                        onChange={(e) => toggle([item.id], e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[#4b5563] disabled:cursor-not-allowed sm:mt-0"
                      />
                      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                        {/* Domain + type/online, with the price top-right on mobile. */}
                        <div className="min-w-0 sm:flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-ink">{item.domain}</div>
                              {/* Type + when it goes online (only once it's ready). */}
                              <div className="truncate text-xs text-inkSoft">
                                {item.productName}
                                {!empty && ` · ${item.online}`}
                              </div>
                            </div>
                            <span className="shrink-0 font-semibold text-ink tabular-nums sm:hidden">
                              {euro(item.price)}
                            </span>
                          </div>
                          {/* Mobile: status on the left, buttons on the right. */}
                          <div className="mt-2.5 flex items-center justify-between gap-3 sm:hidden">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusView.cls}`}
                            >
                              <StatusIcon size={11} /> {statusView.short}
                            </span>
                            <div className="flex items-center gap-2">
                              {actionButton}
                              {trashButton}
                            </div>
                          </div>
                        </div>
                        {/* Desktop: status pill (fixed width so prices/buttons align),
                            price, action and remove — all on one row. */}
                        <div className="hidden items-center gap-4 sm:flex">
                          <span
                            className={`inline-flex w-48 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusView.cls}`}
                          >
                            <StatusIcon size={12} /> {statusView.text}
                          </span>
                          <div className="w-20 shrink-0 text-right font-semibold text-ink tabular-nums">
                            {euro(item.price)}
                          </div>
                          {actionButton}
                          {trashButton}
                        </div>
                      </div>
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
                    Subtotaal ({allChosen ? payable.length : `${chosen.length} van ${payable.length}`}{" "}
                    {payable.length === 1 ? "item" : "items"})
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
                {/* "Actie nodig" items aren't ticked and aren't counted (their
                    checkbox is disabled), so an empty item is never paid for —
                    you just check out whatever is ready. */}
                {actionNeededCount > 0 && (
                  <p className="text-xs text-inkSoft mb-2">
                    {actionNeededCount === 1
                      ? "1 item heeft nog actie nodig en wordt nog niet meegerekend"
                      : `${actionNeededCount} items hebben nog actie nodig en worden nog niet meegerekend`}
                    . Vul ze in om ze af te rekenen.
                  </p>
                )}
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
