"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminToggleWebsiteProductAvailabilityAction, adminDeleteWebsiteProductAction } from "../actions";

export default function ToggleAvailabilityButton({
  websiteProductId,
  isAvailable,
}: {
  websiteProductId: string;
  isAvailable: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true);
    try {
      await adminToggleWebsiteProductAvailabilityAction(websiteProductId);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Dit product verwijderen? Dit kan niet ongedaan gemaakt worden.")) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminDeleteWebsiteProductAction(websiteProductId);
      if (!result.success) {
        setError(result.error ?? "Verwijderen mislukt.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors disabled:opacity-60 ${
            isAvailable
              ? "border-line text-inkSoft hover:bg-brandSoft"
              : "border-green-300 text-green-700 hover:bg-green-50"
          }`}
        >
          {isAvailable ? "Zet op inactief" : "Zet op actief"}
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          Verwijderen
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
