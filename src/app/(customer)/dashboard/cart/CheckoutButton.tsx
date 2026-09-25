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
  onError,
}: {
  orderId: string;
  testMode?: boolean;
  itemIds?: string[];
  disabled?: boolean;
  // Shown in the cart's own message box at the top, not by the button.
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const setError = onError;
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
