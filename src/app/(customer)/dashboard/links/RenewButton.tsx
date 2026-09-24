"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DURATION_YEARS, durationLabel } from "@/lib/placementPeriod";
import { renewPlacementAction } from "./actions";

export default function RenewButton({ orderItemId }: { orderItemId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [years, setYears] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function renew() {
    setLoading(true);
    setError(null);
    const result = await renewPlacementAction(orderItemId, years).catch(() => null);
    if (!result?.success) {
      setError(result?.error ?? "Er ging iets mis.");
      setLoading(false);
      return;
    }
    router.push("/dashboard/cart");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-brand text-sm hover:underline">
        Verlengen
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="inline-flex items-center gap-2">
        <select
          aria-label="Verlengen met"
          value={years}
          onChange={(e) => setYears(Number(e.target.value))}
          className="border border-line rounded-md px-2 py-1 text-sm"
        >
          {DURATION_YEARS.map((y) => (
            <option key={y} value={y}>
              +{durationLabel(y)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={renew}
          disabled={loading}
          className="btn-primary rounded-md px-3 py-1 text-sm disabled:opacity-60"
        >
          {loading ? "Bezig..." : "In winkelmandje"}
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
