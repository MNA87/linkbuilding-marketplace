"use client";

import { useRouter } from "next/navigation";
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
        <button type="button" onClick={goBack} className="px-3 py-2 text-sm text-inkSoft hover:text-ink">
          &larr; Terug
        </button>
        <button
          type="submit"
          disabled={loading}
          className="border border-line bg-surface text-ink rounded-md px-4 py-2 text-sm font-medium hover:bg-brandSoft disabled:opacity-60 transition-colors"
        >
          {editing ? "Opslaan" : "Toevoegen aan winkelmandje"}
        </button>
        <button
          type="submit"
          data-pay="true"
          disabled={loading}
          className="bg-brand text-white rounded-md px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {loading ? "Bezig..." : "Opslaan en naar betalen"}
        </button>
      </div>
    </div>
  );
}

export function wantsToPay(e: React.FormEvent): boolean {
  const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
  return submitter?.dataset.pay === "true";
}
