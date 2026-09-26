"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addEmptyToCartAction } from "./actions";

export default function AddToCartButton({ websiteProductId }: { websiteProductId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
      // Meteen door naar het invulscherm — voor blog en homepage-link gelijk,
      // zodat je na "Voeg toe" direct verder kunt met invullen. router.push
      // alleen laat het winkelmandje-aantal in de layout (elders server-side
      // opgehaald) stale staan — refresh() ernaast forceert dat die meetelt.
      router.push(`/marketplace/${websiteProductId}?orderItemId=${result.orderItemId}&nieuw=1`);
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
      setLoading(false);
    }
  }

  // Buying: the call-to-action colour, like "Bekijk aanbod" on the dashboard.
  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-block whitespace-nowrap btn-pay rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-60 transition"
      >
        {loading ? "Bezig..." : "Voeg toe"}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
