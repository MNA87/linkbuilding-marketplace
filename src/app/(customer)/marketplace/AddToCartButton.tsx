"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

// Opens the order popup for this site (over the marketplace), where you fill
// the link in and add it / check out. A site you already have in the cart
// shows a white outline button with a check and a small count in the corner.
export default function AddToCartButton({
  websiteProductId,
  inCart = 0,
}: {
  websiteProductId: string;
  // Accepted from existing call sites; not all are used any more.
  domain?: string;
  topicId?: string | null;
  durationYears?: number;
  // How many of this site the customer already has in the cart.
  inCart?: number;
}) {
  const router = useRouter();

  return (
    <div className="text-right">
      <span className="relative inline-block">
        <button
          type="button"
          onClick={() => router.push(`/marketplace/${websiteProductId}`)}
          // Already in the cart → a white outline button with a check (like
          // Bol's "selected" state). Fixed min-width so it is exactly as wide
          // as a normal one, keeping the column aligned.
          className={`inline-flex min-w-[7.5rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 py-2 text-sm font-semibold md:rounded-md md:px-4 md:py-1.5 md:font-medium transition ${
            inCart > 0 ? "border border-[var(--btn-pay-bg)] bg-white text-[var(--btn-pay-bg)]" : "btn-pay"
          }`}
        >
          {inCart > 0 && <Check size={15} strokeWidth={3} />}
          Voeg toe
        </button>
        {inCart > 0 && (
          // How many of this site are in the cart — a small badge in the top
          // corner, so it's visible without widening the button.
          <span className="pointer-events-none absolute -right-2 -top-2 inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-[var(--btn-pay-bg)] px-1 text-[11px] font-bold leading-none text-white tabular-nums">
            {inCart}
          </span>
        )}
      </span>
    </div>
  );
}
