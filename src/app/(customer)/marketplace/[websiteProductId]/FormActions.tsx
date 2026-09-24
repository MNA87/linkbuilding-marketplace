"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";
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
}: {
  loading: boolean;
  editing: boolean;
  discardOrderItemId?: string;
  backHref: string;
  hasInput: boolean;
  onDiscard: () => void;
  // The line above the buttons; off when they sit in a box of their own.
  separator?: boolean;
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

  return (
    <div className={`flex flex-wrap items-center justify-end gap-3 ${separator ? "pt-2 border-t border-line" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2 py-2 text-sm text-inkSoft hover:text-ink disabled:opacity-60 transition-colors"
        >
          <ArrowLeft size={16} />
          {leaving ? "Bezig..." : "Terug"}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 transition"
        >
          {editing ? "Opslaan" : "In winkelmandje"}
        </button>
        <button
          type="submit"
          data-pay="true"
          disabled={busy}
          className="btn-pay inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold shadow-sm disabled:opacity-60 transition"
        >
          <CreditCard size={16} />
          {loading ? "Bezig..." : "Afrekenen"}
        </button>
      </div>
    </div>
  );
}

export function wantsToPay(e: React.FormEvent): boolean {
  const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
  return submitter?.dataset.pay === "true";
}
