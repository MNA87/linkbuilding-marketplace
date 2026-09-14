"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WebsiteStatus } from "@prisma/client";
import { updateWebsiteStatusAction } from "../actions";

export default function StatusActions({
  websiteId,
  currentStatus,
}: {
  websiteId: string;
  currentStatus: WebsiteStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(status: WebsiteStatus) {
    setLoading(status);
    setError(null);
    try {
      const result = await updateWebsiteStatusAction(websiteId, status);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(null);
    }
  }

  const buttons: { status: WebsiteStatus; label: string; className: string }[] = [
    { status: "APPROVED", label: "Goedkeuren", className: "bg-brand text-white hover:opacity-90" },
    { status: "ACTIVE", label: "Zet op actief", className: "border border-green-300 text-green-700 hover:bg-green-50" },
    { status: "PAUSED", label: "Pauzeren", className: "border border-line text-inkSoft hover:bg-brandSoft" },
    { status: "REJECTED", label: "Afwijzen", className: "border border-red-300 text-red-700 hover:bg-red-50" },
  ];

  return (
    <div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{error}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.status}
            onClick={() => handleClick(b.status)}
            disabled={loading !== null || currentStatus === b.status}
            className={`text-sm px-4 py-2 rounded-md transition-colors disabled:opacity-40 ${b.className}`}
          >
            {loading === b.status ? "Bezig..." : b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
