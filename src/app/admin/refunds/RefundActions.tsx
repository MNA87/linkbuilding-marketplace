"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveRefundAction, denyRefundAction } from "./actions";

export default function RefundActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "approve" | "deny") {
    setLoading(action);
    setError(null);
    try {
      const result = action === "approve" ? await approveRefundAction(orderId) : await denyRefundAction(orderId);
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

  return (
    <div className="text-right">
      {error && <div className="text-xs text-red-600 mb-1 max-w-xs">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={() => handle("deny")}
          disabled={loading !== null}
          className="text-sm border border-line text-inkSoft rounded-md px-3 py-1.5 hover:bg-brandSoft disabled:opacity-50"
        >
          {loading === "deny" ? "Bezig..." : "Afwijzen"}
        </button>
        <button
          onClick={() => handle("approve")}
          disabled={loading !== null}
          className="text-sm bg-red-600 text-white rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
        >
          {loading === "approve" ? "Bezig..." : "Restitueren"}
        </button>
      </div>
    </div>
  );
}
