"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkoutCartAction } from "./actions";

export default function CheckoutButton({ orderId, testMode }: { orderId: string; testMode?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const result = await checkoutCartAction(orderId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.testMode && result.orderId) {
        router.push(`/dashboard/orders/${result.orderId}?checkout=success&test=true`);
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setError("Er ging iets mis.");
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      {error && <div className="text-xs text-red-600 mb-1">{error}</div>}
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : testMode ? "Simuleer betaling" : "Afrekenen"}
      </button>
    </div>
  );
}
