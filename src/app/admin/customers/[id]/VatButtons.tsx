"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setVatStatusAction } from "../actions";

// Check again with VIES, or decide yourself.
export default function VatButtons({ companyId, canDecide }: { companyId: string; canDecide: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: "recheck" | "approved" | "invalid") =>
    startTransition(async () => {
      const r = await setVatStatusAction(companyId, action);
      setError(r.error);
      if (!r.error) router.refresh();
    });
  const outline =
    "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:bg-gray-50 disabled:opacity-60";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => run("recheck")} className={outline}>
        Opnieuw controleren
      </button>
      {canDecide && (
        <>
          <button type="button" disabled={pending} onClick={() => run("invalid")} className={outline}>
            Afwijzen (21% btw)
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("approved")}
            className="btn-pay rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
          >
            Gezien (btw verlegd)
          </button>
        </>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
