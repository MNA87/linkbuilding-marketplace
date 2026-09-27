"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCancelOrderAction } from "./actions";

// "Order annuleren": cancels the whole order and refunds it — asked first,
// since the money goes straight back to the customer.
export default function CancelOrderButton({ orderId, orderNumber, amount }: { orderId: string; orderNumber: number; amount: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);
    try {
      const result = await adminCancelOrderAction(orderId);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm text-red-600 hover:underline">
        Order annuleren
      </button>
    );
  }
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
      <p className="text-red-800">
        Order #{orderNumber} annuleren? De klant krijgt {amount} terug en er komt een creditfactuur. Dit kan niet
        ongedaan worden gemaakt.
      </p>
      {error && <p className="mt-1 text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-ink hover:bg-gray-50 disabled:opacity-50"
        >
          Niet annuleren
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={loading}
          className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Bezig..." : "Ja, annuleren en terugbetalen"}
        </button>
      </div>
    </div>
  );
}
