"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmCompletionAction } from "./actions";

export default function ConfirmCompletionButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await confirmCompletionAction(orderId);
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

  return (
    <div>
      {error && <div className="text-xs text-red-600 mb-1">{error}</div>}
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-sm btn-primary rounded-md px-3 py-1.5 disabled:opacity-60"
      >
        {loading ? "Bezig..." : "Bevestig plaatsing klopt"}
      </button>
    </div>
  );
}
