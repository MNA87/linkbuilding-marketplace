"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestRefundAction } from "./actions";

export default function RefundButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const result = await requestRefundAction(orderId);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-sm text-red-600 hover:underline">
        Annuleren / restitutie aanvragen
      </button>
    );
  }

  return (
    <div className="text-sm">
      {error && <div className="text-red-600 mb-1">{error}</div>}
      <span className="text-inkSoft">Weet je het zeker? </span>
      <button onClick={handleConfirm} disabled={loading} className="text-red-600 font-medium hover:underline mr-3">
        {loading ? "Bezig..." : "Ja, annuleren"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-inkSoft hover:underline">
        Nee
      </button>
    </div>
  );
}
