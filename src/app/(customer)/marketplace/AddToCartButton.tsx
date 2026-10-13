"use client";

import { useRouter } from "next/navigation";
import { Plus, Check, ShoppingCart } from "lucide-react";

// Opens the order popup for this site (over the marketplace), where you fill
// the link in and add it / check out. Shown as a small cart button: a "+ cart"
// to add, or — when the site is already in the cart — a white outline button
// with a check and the cart (like Bol's "selected" state).
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
  const added = inCart > 0;

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={() => router.push(`/marketplace/${websiteProductId}`)}
        aria-label={added ? "In winkelmandje — opnieuw toevoegen" : "Voeg toe aan winkelmandje"}
        // Fixed min-width so every row's button is equally wide and the column
        // stays aligned. Added → white outline + green check; otherwise a filled
        // teal "add" button, matching the rest of the site's one colour.
        className={`inline-flex min-w-[4.5rem] items-center justify-center gap-1.5 rounded-[10px] px-3.5 py-2 transition md:rounded-md md:px-4 md:py-1.5 ${
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
