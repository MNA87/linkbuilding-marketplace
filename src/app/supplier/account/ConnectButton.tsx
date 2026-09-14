"use client";

import { useState } from "react";
import { createStripeOnboardingLink } from "./actions";

export default function ConnectButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await createStripeOnboardingLink();
      if (result.error || !result.url) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      window.location.href = result.url;
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{error}</div>
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : "Verbind Stripe-account"}
      </button>
    </div>
  );
}
