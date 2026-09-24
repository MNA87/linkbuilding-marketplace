"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { checkoutCartAction } from "./actions";

export default function CheckoutButton({
  orderId,
  testMode,
  itemIds,
  disabled,
}: {
  orderId: string;
  testMode?: boolean;
  itemIds?: string[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const result = await checkoutCartAction(orderId, itemIds);
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
    <div>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        className="btn-pay w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60 transition"
      >
        <CreditCard size={16} />
        {loading ? "Bezig..." : testMode ? "Simuleer betaling" : "Afrekenen"}
      </button>
    </div>
  );
}
