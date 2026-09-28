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
  plannedFor,
}: {
  orderItemId: string;
  wordpressConfigured: boolean;
  syncMode: boolean;
  initiallyQueued: boolean;
  // The customer's "Op een datum" day, e.g. "woensdag 30 september 2026", while
  // that's still ahead — the site only gets the article on that morning.
  plannedFor?: string;
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
        {plannedFor ? (
          <div className="text-sm text-ink">
            Gaat vanzelf online op <strong>{plannedFor}</strong>, &apos;s ochtends. De klant koos deze datum; je hoeft
            niets meer te doen.
          </div>
        ) : (
          <div className="text-sm text-ink">
            Wordt gepubliceerd. De site zet het artikel binnen een paar minuten online; daarna staat de live link hier.
          </div>
        )}
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="text-xs text-red-600 hover:underline disabled:opacity-60"
        >
          {cancelling ? "Bezig..." : "Toch niet publiceren"}
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
          className="btn-pay rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 transition"
        >
          {publishing ? "Bezig..." : "Publiceren"}
        </button>
      )}

      {error && <div className="text-xs text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        {wordpressConfigured && (
          <span className="w-full text-xs text-inkSoft sm:w-auto sm:whitespace-nowrap">Of, zelf al gepubliceerd:</span>
        )}
        <input
          type="url"
          placeholder="https://... (live URL)"
          value={liveUrl}
          onChange={(e) => setLiveUrl(e.target.value)}
          required
          className="min-w-0 flex-1 border border-line rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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
