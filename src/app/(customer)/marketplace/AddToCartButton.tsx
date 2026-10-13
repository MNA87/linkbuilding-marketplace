"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { addEmptyToCartAction } from "./actions";

// The topic and number of years chosen above the list go along with it.
export default function AddToCartButton({
  websiteProductId,
  topicId = null,
  durationYears,
  inCart = 0,
}: {
  websiteProductId: string;
  // Still accepted from callers; no longer used since the confirmation banner
  // was removed. Kept so existing call sites don't need to change.
  domain?: string;
  topicId?: string | null;
  durationYears?: number;
  // How many of this site the customer already has in the cart.
  inCart?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await addEmptyToCartAction({ websiteProductId, topicId, durationYears });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      // Stay in the marketplace so they can keep browsing — filling in happens
      // later, from the cart or after payment. refresh() updates the cart
      // counter in the menu and the "× in je mandje" pill on this row.
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      // We stay on this page now, so re-enable the button — otherwise it
      // would stay stuck on "Bezig..." and you couldn't add the site again.
      setLoading(false);
    }
  }

  // Buying: the call-to-action colour, like "Bekijk aanbod" on the dashboard.
  return (
    <div className="text-right">
      <span className="relative inline-block">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          // Already in the cart → a white outline button with a check (like
          // Bol's "selected" state). Fixed min-width so it is exactly as wide
          // as a normal one, keeping the column aligned.
          className={`inline-flex min-w-[7.5rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 py-2 text-sm font-semibold md:rounded-md md:px-4 md:py-1.5 md:font-medium disabled:opacity-60 transition ${
            inCart > 0 ? "border border-[var(--btn-pay-bg)] bg-white text-[var(--btn-pay-bg)]" : "btn-pay"
          }`}
        >
          {loading ? (
            "Bezig..."
          ) : (
            <>
              {inCart > 0 && <Check size={15} strokeWidth={3} />}
              Voeg toe
            </>
          )}
        </button>
        {!loading && inCart > 0 && (
          // How many of this site are in the cart — a small badge in the top
          // corner, so it's visible without widening the button.
          <span className="pointer-events-none absolute -right-2 -top-2 inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-[var(--btn-pay-bg)] px-1 text-[11px] font-bold leading-none text-white tabular-nums">
            {inCart}
          </span>
        )}
      </span>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
