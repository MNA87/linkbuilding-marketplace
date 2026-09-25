"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { durationLabel } from "@/lib/placementPeriod";
import { renewPlacementAction } from "./actions";

export type RenewOption = { years: number; price: string; newEnd: string };

// Pick +1, +2 or +3 years; the renewal goes into the cart, where it's paid
// like any other order.
export default function RenewPanel({
  orderItemId,
  options,
  inCartYears,
}: {
  orderItemId: string;
  options: RenewOption[];
  inCartYears: number | null;
}) {
  const router = useRouter();
  const [years, setYears] = useState(inCartYears ?? options[0]?.years ?? 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = options.find((o) => o.years === years) ?? options[0];

  async function renew() {
    setLoading(true);
    setError(null);
    const result = await renewPlacementAction(orderItemId, years).catch(() => null);
    if (!result?.success) {
      setError(result?.error ?? "Er ging iets mis. Probeer het opnieuw.");
      setLoading(false);
      return;
    }
    router.push("/dashboard/cart");
    router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.years}
            type="button"
            onClick={() => setYears(o.years)}
            aria-pressed={o.years === years}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
              o.years === years ? "border-brand bg-brandSoft/40 ring-1 ring-brand" : "border-line hover:bg-gray-50"
            }`}
          >
            <div className="text-sm font-semibold text-ink">+{durationLabel(o.years)}</div>
            <div className="text-xs text-inkSoft mt-0.5">€{o.price}</div>
          </button>
        ))}
      </div>

      {chosen && (
        <div className="mt-4 text-sm">
          <div className="flex justify-between border-t border-dashed border-line py-2">
            <span className="text-inkSoft">Nieuwe einddatum</span>
            <span className="font-semibold text-ink">{chosen.newEnd}</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-line py-2">
            <span className="text-inkSoft">Bedrag</span>
            <span className="font-semibold text-ink">€{chosen.price} excl. BTW</span>
          </div>
        </div>
      )}

      {inCartYears && (
        <p className="mt-1 text-xs text-emerald-700">
          Staat al in je winkelmandje (+{durationLabel(inCartYears)}). Kies je hierboven iets anders, dan passen we dat aan.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={renew}
        disabled={loading}
        className="btn-pay mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {loading ? "Bezig..." : "Verlengen en afrekenen →"}
      </button>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-inkSoft">
        <Lock size={12} />
        Betalen met iDEAL · factuur met BTW
      </p>
    </div>
  );
}
