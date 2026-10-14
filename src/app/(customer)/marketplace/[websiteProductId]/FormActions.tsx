"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Send } from "lucide-react";

// Both buttons submit the form (so the browser's required-field checks still
// run); data-cart tells the submit handler which one was clicked.
export default function FormActions({
  loading,
  editing,
  freshAdd = false,
  backHref,
  separator = true,
  nextInSequence = false,
  paid = false,
}: {
  loading: boolean;
  editing: boolean;
  // A just-added item (it's already in the cart as "Actie nodig"): the quieter
  // button then says "Verder winkelen", not "Opslaan".
  freshAdd?: boolean;
  backHref: string;
  // The line above the buttons; off when they sit in a box of their own.
  separator?: boolean;
  // Filling in several cart items in a row, and this isn't the last one:
  // saving moves on to the next, so there's no paying from here yet.
  nextInSequence?: boolean;
  // Already paid for, only the content to send in: one "Versturen".
  paid?: boolean;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const busy = loading || leaving;

  // Say where "Terug" goes, so it's never a surprise: the cart when you came
  // to fill in a basket item, Mijn orders after paying, otherwise the overview.
  const backLabel = backHref.startsWith("/dashboard/cart")
    ? "Terug naar winkelmandje"
    : backHref.startsWith("/dashboard/orders")
      ? "Terug naar mijn orders"
      : "Terug naar overzicht";

  // The item is already in the cart, so leaving never throws anything away —
  // just go back. What was typed but not saved stays in the local draft.
  function goBack() {
    setLeaving(true);
    router.push(backHref);
  }

  // On a phone the buttons stack full width, the main one on top.
  const wide = "w-full justify-center sm:w-auto";
  return (
    <div
      className={`flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 ${separator ? "pt-2 border-t border-line" : ""}`}
    >
      <button
        type="button"
        onClick={goBack}
        disabled={busy}
        className={`${wide} inline-flex items-center gap-1 px-2 py-2 text-sm text-inkSoft hover:text-ink disabled:opacity-60 transition-colors`}
      >
        <ArrowLeft size={16} />
        {leaving ? "Bezig..." : backLabel}
      </button>
      {paid ? (
        <button
          type="submit"
          disabled={busy}
          className={`${wide} btn-pay inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60 transition`}
        >
          <Send size={15} />
          {loading ? "Bezig..." : nextInSequence ? "Versturen en volgende →" : "Versturen"}
        </button>
      ) : (
        <button
          type="submit"
          disabled={busy}
          // Next to "Naar winkelwagen" it's the quieter choice; on its own it's the main one.
          className={`${wide} inline-flex items-center rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60 transition ${
            nextInSequence ? "btn-pay shadow-sm" : "border border-line bg-surface text-ink hover:bg-gray-50"
          }`}
        >
          {nextInSequence
            ? "Opslaan en volgende →"
            : editing && !freshAdd
              ? "Opslaan"
              : "Verder winkelen"}
        </button>
      )}
      {!nextInSequence && !paid && (
        <button
          type="submit"
          data-cart="true"
          disabled={busy}
          className={`${wide} btn-pay inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60 transition`}
        >
          <ChevronRight size={16} />
          {loading ? "Bezig..." : "Naar winkelwagen"}
        </button>
      )}
    </div>
  );
}

// True when the "Naar winkelwagen" button was the one that submitted the form
// (as opposed to "Verder winkelen").
export function goesToCart(e: React.FormEvent): boolean {
  const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
  return submitter?.dataset.cart === "true";
}
