"use client";

import { useState } from "react";
import { checkoutCartAction } from "./actions";

export default function CheckoutButton({ orderId }: { orderId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const result = await checkoutCartAction(orderId);
      if (result.error || !result.checkoutUrl) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      window.location.href = result.checkoutUrl;
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
        {loading ? "Bezig..." : "Afrekenen"}
      </button>
    </div>
  );
}
