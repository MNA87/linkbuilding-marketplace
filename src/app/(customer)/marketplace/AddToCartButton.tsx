"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addEmptyToCartAction } from "./actions";

export default function AddToCartButton({ websiteProductId }: { websiteProductId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await addEmptyToCartAction({ websiteProductId });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      setAdded(true);
      // Refreshes the cart badge in the sidebar/top bar (server-rendered in
      // the layout) without leaving the marketplace list.
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-block bg-brand text-white rounded-md px-4 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : added ? "Toegevoegd ✓" : "Voeg toe"}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
