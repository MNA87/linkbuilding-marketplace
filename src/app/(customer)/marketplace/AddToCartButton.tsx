"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Check, ShoppingCart } from "lucide-react";
import { addEmptyToCartAction } from "./actions";

// The cart button on the marketplace list. A click drops the site straight in
// the cart (so the count goes up and the top-bar cart lights up right away) and
// opens the order popup to fill the link in. Closing the popup without saving
// removes that just-added item again. A site already in the cart shows a white
// outline button with a check (like Bol's "selected" state).
export default function AddToCartButton({
  websiteProductId,
  topicId,
  durationYears,
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const added = inCart > 0;

  // Create the (empty) cart item, then open its popup via the URL — keeping the
  // active filters/page so a refresh re-opens the same popup.
  async function addAndOpen() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await addEmptyToCartAction({ websiteProductId, topicId, durationYears });
      if (!res.success || !res.orderItemId) {
        setBusy(false);
        return;
      }
      const p = new URLSearchParams(searchParams.toString());
      p.set("invullen", websiteProductId);
      p.set("orderItemId", res.orderItemId);
      p.set("nieuw", "1");
      router.push(`${pathname}?${p.toString()}`);
      // Refresh so the cart count / bounce in the top bar react immediately.
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={addAndOpen}
        disabled={busy}
        aria-label={added ? "In winkelmandje — opnieuw toevoegen" : "Voeg toe aan winkelmandje"}
        // Fixed min-width so every row's button is equally wide and the column
        // stays aligned. Added → white outline + green check; otherwise a filled
        // teal "add" button, matching the rest of the site's one colour.
        className={`inline-flex min-w-[4.5rem] items-center justify-center gap-1.5 rounded-[10px] px-3.5 py-2 transition disabled:opacity-60 md:rounded-md md:px-4 md:py-1.5 ${
          added
            ? "border border-[var(--btn-pay-bg)] bg-white text-[var(--btn-pay-bg)]"
            : "bg-[var(--btn-pay-bg)] text-white hover:brightness-95"
        }`}
      >
        {added ? <Check size={17} strokeWidth={3} /> : <Plus size={17} strokeWidth={2.5} />}
        <ShoppingCart size={17} strokeWidth={2.25} />
      </button>
    </div>
  );
}
