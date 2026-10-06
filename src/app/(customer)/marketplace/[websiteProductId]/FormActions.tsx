"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Send } from "lucide-react";
import { removeCartItemAction } from "../../dashboard/cart/actions";

// Both buttons submit the form (so the browser's required-field checks still
// run); data-pay tells the submit handler which one was clicked.
export default function FormActions({
  loading,
  editing,
  discardOrderItemId,
  backHref,
  hasInput,
  onDiscard,
  separator = true,
  nextInSequence = false,
  paid = false,
}: {
  loading: boolean;
  editing: boolean;
  discardOrderItemId?: string;
  backHref: string;
  hasInput: boolean;
  onDiscard: () => void;
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

  async function goBack() {
    if (discardOrderItemId) {
      if (hasInput && !window.confirm("Wat je hebt ingevuld is nog niet opgeslagen en gaat verloren. Toch terug?")) {
        return;
      }
      setLeaving(true);
      await removeCartItemAction(discardOrderItemId).catch(() => null);
      onDiscard();
      // replace, not push: the item no longer exists, so the browser's own
      // back button mustn't lead to its (now missing) form again.
      router.replace(backHref);
      router.refresh();
      return;
    }
    setLeaving(true);
    router.push(backHref);
  }

  // On a phone the buttons stack full width, the main one on top.
  const wide = "w-full justify-center sm:w-auto";
  return (
    <div
      className={`flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 ${separator ? "pt-2 border-t border-line" : ""}`}
    >
      <button
        type="button"
        onClick={goBack}
        disabled={busy}
        className={`${wide} inline-flex items-center gap-1 px-2 py-2 text-sm text-inkSoft hover:text-ink disabled:opacity-60 transition-colors`}
      >
        <ArrowLeft size={16} />
        {leaving ? "Bezig..." : "Terug"}
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
          // Next to Afrekenen it's the quieter choice; on its own it's the main one.
          className={`${wide} inline-flex items-center rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60 transition ${
            nextInSequence ? "btn-pay shadow-sm" : "border border-line bg-surface text-ink hover:bg-gray-50"
          }`}
        >
          {nextInSequence ? "Opslaan en volgende →" : editing ? "Opslaan" : "In winkelmandje"}
        </button>
      )}
      {!nextInSequence && !paid && (
        <button
          type="submit"
          data-pay="true"
          disabled={busy}
          className={`${wide} btn-pay inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60 transition`}
        >
          <CreditCard size={16} />
          {loading ? "Bezig..." : "Afrekenen"}
        </button>
      )}
    </div>
  );
}

export function wantsToPay(e: React.FormEvent): boolean {
  const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
  return submitter?.dataset.pay === "true";
}
