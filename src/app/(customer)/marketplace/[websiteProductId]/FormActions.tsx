"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";
import { removeCartItemAction } from "../../dashboard/cart/actions";

// Both buttons submit the form (so the browser's required-field checks still
// run); data-pay tells the submit handler which one was clicked.
export default function FormActions({
  price,
  loading,
  editing,
  discardOrderItemId,
  backHref,
}: {
  price: string;
  loading: boolean;
  editing: boolean;
  discardOrderItemId?: string;
  backHref: string;
}) {
  const router = useRouter();

  async function goBack() {
    if (discardOrderItemId) {
      await removeCartItemAction(discardOrderItemId).catch(() => null);
      router.push(backHref);
      router.refresh();
      return;
    }
    if (window.history.length > 1) router.back();
    else router.push(backHref);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
      <div className="text-sm text-inkSoft">
        Totaal: <span className="text-ink font-medium">&euro;{price}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1 px-2 py-2 text-sm text-inkSoft hover:text-ink transition-colors"
        >
          <ArrowLeft size={16} />
          Terug
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 transition"
        >
          {editing ? "Opslaan" : "In winkelmandje"}
        </button>
        <button
          type="submit"
          data-pay="true"
          disabled={loading}
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
