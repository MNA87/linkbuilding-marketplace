"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminRemoveWritingFeeAction } from "./actions";

// Takes the writing fee off a mail order that isn't invoiced yet.
export default function RemoveWritingFeeButton({ orderItemId, fee }: { orderItemId: string; fee: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Schrijfkosten (${fee}) weghalen bij deze order?`)) return;
          setError(null);
          startTransition(async () => {
            const r = await adminRemoveWritingFeeAction(orderItemId);
            if (r.error) setError(r.error);
            else router.refresh();
          });
        }}
        className="text-sm font-medium text-brand hover:underline disabled:opacity-60"
      >
        {pending ? "Bezig..." : "Weghalen"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
