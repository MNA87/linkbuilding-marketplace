"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminEditWebsiteProductPriceAction } from "../actions";

export default function EditPriceField({
  websiteProductId,
  supplierPrice,
}: {
  websiteProductId: string;
  supplierPrice: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(supplierPrice.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await adminEditWebsiteProductPriceAction({ websiteProductId, supplierPrice: value });
      if (!result.success) {
        setError(result.error ?? "Opslaan mislukt.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-inkSoft hover:text-brand hover:underline"
      >
        &euro;{supplierPrice.toFixed(2)} — wijzigen
      </button>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        step="0.01"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-20 border border-line rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <button type="submit" disabled={loading} className="text-xs text-brand font-medium hover:underline disabled:opacity-60">
        Opslaan
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setValue(supplierPrice.toFixed(2));
          setError(null);
        }}
        className="text-xs text-inkSoft hover:underline"
      >
        Annuleren
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
