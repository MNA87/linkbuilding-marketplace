"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCancelReadyToPublishAction } from "./actions";

// Under the order, once Publiceren was clicked: it's queued for the site's
// plugin, with a way back. Publiceren itself is in EditItemForm.
export default function PublishForm({
  orderItemId,
  syncMode,
  initiallyQueued,
  plannedFor,
}: {
  orderItemId: string;
  syncMode: boolean;
  initiallyQueued: boolean;
  // The customer's "Op een datum" day, e.g. "woensdag 30 september 2026", while
  // that's still ahead — the site only gets the article on that morning.
  plannedFor?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const queued = initiallyQueued;

  async function handleCancel() {
    setError(null);
    setCancelling(true);
    try {
      const result = await adminCancelReadyToPublishAction({ orderItemId });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setCancelling(false);
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
            Wordt gepubliceerd. Binnen een paar minuten staat het op de site; daarna staat de live link hier.
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

  return null;
}
