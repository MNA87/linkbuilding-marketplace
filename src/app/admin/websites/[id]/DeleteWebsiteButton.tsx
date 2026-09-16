"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteWebsiteAction } from "../actions";

export default function DeleteWebsiteButton({ websiteId, domain }: { websiteId: string; domain: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`${domain} volledig verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminDeleteWebsiteAction(websiteId);
      if (!result.success) {
        setError(result.error ?? "Verwijderen mislukt.");
        return;
      }
      router.push("/admin/websites");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-sm px-4 py-2 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
      >
        {loading ? "Bezig..." : "Website verwijderen"}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
