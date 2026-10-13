"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { addEmptyToCartAction } from "./actions";

// The topic and number of years chosen above the list go along with it.
export default function AddToCartButton({
  websiteProductId,
  domain,
  topicId = null,
  durationYears,
  inCart = 0,
}: {
  websiteProductId: string;
  domain: string;
  topicId?: string | null;
  durationYears?: number;
  // How many of this site the customer already has in the cart.
  inCart?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      // Stay in the marketplace so they can keep browsing, with a short
      // confirmation ("<site> toegevoegd"). Filling in happens later, from
      // the cart or after payment — no need to interrupt the shopping. The
      // current filters are kept; refresh() makes the cart count update.
      const params = new URLSearchParams(searchParams.toString());
      params.set("toegevoegd", domain);
      params.set("t", String(Date.now()));
      router.push(`/marketplace?${params.toString()}`, { scroll: false });
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
      <div className="flex items-center justify-end gap-2">
        {inCart > 0 && (
          // How many of this site you already have in the cart — so you see it
          // per row in a long list, without scrolling up to the cart counter.
          <span
            title={`${inCart}× in je mandje`}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--pay-soft,#ccfbf1)] px-2 py-1 text-xs font-bold text-[var(--btn-pay-bg)]"
          >
            <Check size={13} strokeWidth={3} />
            {inCart}×
          </span>
        )}
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="inline-block whitespace-nowrap btn-pay rounded-[10px] px-3.5 py-2 text-sm font-semibold md:rounded-md md:px-4 md:py-1.5 md:font-medium disabled:opacity-60 transition"
        >
          {loading ? "Bezig..." : "Voeg toe"}
        </button>
      </div>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
