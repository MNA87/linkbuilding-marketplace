"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminMarkPlacementPublishedAction,
  adminPublishToWordPressAction,
  adminCancelReadyToPublishAction,
} from "./actions";

export default function PublishForm({
  orderItemId,
  wordpressConfigured,
  syncMode,
  initiallyQueued,
}: {
  orderItemId: string;
  wordpressConfigured: boolean;
  syncMode: boolean;
  initiallyQueued: boolean;
}) {
  const router = useRouter();
  const [liveUrl, setLiveUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [queued, setQueued] = useState(initiallyQueued);

  async function handlePublishNow() {
    setError(null);
    setPublishing(true);
    try {
      const result = await adminPublishToWordPressAction({ orderItemId });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      if (result.queued) {
        setQueued(true);
      }
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleCancel() {
    setError(null);
    setCancelling(true);
    try {
      const result = await adminCancelReadyToPublishAction({ orderItemId });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      setQueued(false);
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setCancelling(false);
    }
  }

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

  if (syncMode && queued) {
    return (
      <div className="space-y-1.5">
        <div className="text-xs text-inkSoft">
          In wachtrij voor synchronisatie — de site haalt dit zelf op (automatisch, of via &quot;Nu
          synchroniseren&quot; in het WordPress-dashboard van de site).
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="text-xs text-red-600 hover:underline disabled:opacity-60"
        >
          {cancelling ? "Bezig..." : "Uit wachtrij halen"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {wordpressConfigured && (
        <button
          type="button"
          onClick={handlePublishNow}
          disabled={publishing}
          className="btn-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60 transition"
        >
          {publishing ? "Bezig..." : syncMode ? "Klaarzetten voor synchronisatie" : "Publiceer nu naar WordPress"}
        </button>
      )}

      {error && <div className="text-xs text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {wordpressConfigured && (
          <span className="text-xs text-inkSoft whitespace-nowrap">Of, zelf al gepubliceerd:</span>
        )}
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
          className="bg-surface border border-line text-ink rounded-md px-3 py-1.5 text-sm font-medium hover:bg-brandSoft/40 disabled:opacity-60 transition-colors"
        >
          {loading ? "Bezig..." : "Markeer als live"}
        </button>
      </form>
    </div>
  );
}
