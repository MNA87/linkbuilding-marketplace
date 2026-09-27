"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Lock, Pencil } from "lucide-react";
import { checkoutCartAction } from "./actions";

type ConfirmItem = { id: string; domain: string };

// What "Klaar om af te rekenen?" lists when some of the items being paid
// for aren't filled in yet (they can be, after payment).
export type CheckoutConfirm = {
  ready: ConfirmItem[];
  unfilled: ConfirmItem[];
  total: string;
  fillHref: string;
};

export default function CheckoutButton({
  orderId,
  testMode,
  itemIds,
  disabled,
  onError,
  confirm,
  autoOpen = false,
}: {
  orderId: string;
  testMode?: boolean;
  itemIds?: string[];
  disabled?: boolean;
  // Shown in the cart's own message box at the top, not by the button.
  onError: (message: string | null) => void;
  confirm?: CheckoutConfirm;
  // Came here from an order form's "Afrekenen": show the overview at once.
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const setError = onError;
  const [loading, setLoading] = useState(false);
  const needsConfirm = Boolean(confirm && confirm.unfilled.length > 0);
  const [open, setOpen] = useState(autoOpen && needsConfirm && !disabled);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function checkout(acceptUnfilled: boolean) {
    setError(null);
    setLoading(true);
    try {
      const result = await checkoutCartAction(orderId, itemIds, { acceptUnfilled });
      if (result.needsConfirm) {
        setOpen(true);
        return;
      }
      if (result.error) {
        setOpen(false);
        setError(result.error);
        return;
      }
      if (result.testMode && result.orderId) {
        router.push(`/dashboard/orders/${result.orderId}?checkout=success&test=true`);
        // The menu's counts (cart, orders) come from the layout.
        router.refresh();
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setError("Er ging iets mis.");
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  // Not payable yet (nothing chosen): grey with a lock, so it doesn't pass
  // for a live button.
  const locked = disabled && !loading;
  const payLabel = testMode ? "Simuleer betaling" : "Afrekenen";

  return (
    <div>
      <button
        onClick={() => (needsConfirm ? setOpen(true) : checkout(false))}
        disabled={loading || disabled}
        className={`${
          locked ? "bg-gray-200 border border-gray-200 text-gray-500 cursor-not-allowed" : "btn-pay disabled:opacity-60"
        } w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition`}
      >
        {locked ? <Lock size={15} /> : <CreditCard size={16} />}
        {loading && !open ? "Bezig..." : payLabel}
      </button>

      {open && confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-confirm-title"
            className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl"
          >
            <h2 id="checkout-confirm-title" className="text-lg font-semibold text-ink">
              {confirm.unfilled.length === 1
                ? "1 item is nog niet ingevuld"
                : `${confirm.unfilled.length} items zijn nog niet ingevuld`}
            </h2>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line text-sm">
              {confirm.ready.map((i) => (
                <li key={i.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <Check size={17} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1 truncate text-ink">{i.domain}</span>
                  <span className="text-xs font-semibold text-emerald-700">Klaar</span>
                </li>
              ))}
              {confirm.unfilled.map((i) => (
                <li key={i.id} className="flex items-center gap-2.5 bg-amber-50 px-3.5 py-2.5">
                  <Pencil size={16} className="shrink-0 text-amber-700" />
                  <span className="min-w-0 flex-1 truncate text-ink">{i.domain}</span>
                  <span className="whitespace-nowrap text-xs font-semibold text-amber-800">Lever je na betaling aan</span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs leading-relaxed text-inkSoft">
              Je betaalt nu alles. Na betaling vind je {confirm.unfilled.length === 1 ? "dit item" : "deze items"} bij{" "}
              <strong className="font-semibold">Mijn orders</strong> om in te vullen. We sturen je ook een herinnering.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <Link
                href={confirm.fillHref}
                className="inline-flex items-center rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50"
              >
                Eerst invullen
              </Link>
              <button
                type="button"
                onClick={() => checkout(true)}
                disabled={loading}
                className="btn-pay inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {loading ? "Bezig..." : `${payLabel} · ${confirm.total}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
