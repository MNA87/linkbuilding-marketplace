"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WebsiteStatus } from "@prisma/client";
import { updateWebsiteStatusAction } from "../actions";

// The one or two status buttons that make sense right now, top right.
export default function StatusActions({
  websiteId,
  currentStatus,
}: {
  websiteId: string;
  currentStatus: WebsiteStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<WebsiteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function set(status: WebsiteStatus) {
    setLoading(status);
    setError(null);
    try {
      const result = await updateWebsiteStatusAction(websiteId, status);
      if (!result.success) return setError(result.error ?? "Er ging iets mis.");
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(null);
    }
  }

  const buttons: { status: WebsiteStatus; label: string; primary?: boolean }[] =
    currentStatus === "ACTIVE"
      ? [{ status: "PAUSED", label: "Pauzeren" }]
      : currentStatus === "PAUSED" || currentStatus === "REJECTED"
        ? [{ status: "ACTIVE", label: "Zet op actief", primary: true }]
        : [
            { status: "REJECTED", label: "Afwijzen" },
            { status: "ACTIVE", label: "Goedkeuren", primary: true },
          ];

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {buttons.map((b) => (
          <button
            key={b.status}
            type="button"
            onClick={() => set(b.status)}
            disabled={loading !== null}
            className={`rounded-xl px-3.5 py-2 text-sm transition disabled:opacity-50 ${
              b.primary ? "btn-pay font-semibold" : "border border-line bg-surface text-ink hover:bg-gray-50"
            }`}
          >
            {loading === b.status ? "Bezig..." : b.label}
          </button>
        ))}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
