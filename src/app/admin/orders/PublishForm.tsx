"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminMarkPlacementPublishedAction } from "./actions";

export default function PublishForm({ orderItemId }: { orderItemId: string }) {
  const router = useRouter();
  const [liveUrl, setLiveUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await adminMarkPlacementPublishedAction({ orderItemId, liveUrl });
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <input
        type="url"
        placeholder="https://... (live URL)"
        value={liveUrl}
        onChange={(e) => setLiveUrl(e.target.value)}
        required
        className="flex-1 border border-line rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-brand text-white rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : "Markeer als live"}
      </button>
    </form>
  );
}
