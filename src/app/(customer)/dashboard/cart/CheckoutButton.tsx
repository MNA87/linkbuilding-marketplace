"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Lock } from "lucide-react";
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

  // Not payable yet: grey with a lock, so it doesn't pass for a live button.
  const locked = disabled && !loading;

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        className={`${
          locked ? "bg-gray-200 border border-gray-200 text-gray-500 cursor-not-allowed" : "btn-pay disabled:opacity-60"
        } w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition`}
      >
        {locked ? <Lock size={15} /> : <CreditCard size={16} />}
        {loading ? "Bezig..." : testMode ? "Simuleer betaling" : "Afrekenen"}
      </button>
    </div>
  );
}
