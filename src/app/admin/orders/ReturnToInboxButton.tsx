"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminReturnToInboxAction } from "./actions";

// A mail order made by mistake goes back to Binnengekomen, to make it again.
export default function ReturnToInboxButton({ orderItemId }: { orderItemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              "Order terugzetten naar Binnengekomen? De order wordt verwijderd en de mail staat weer bij Te doen, zodat je hem opnieuw kunt maken."
            )
          )
            return;
          setError(null);
          startTransition(async () => {
            const r = await adminReturnToInboxAction(orderItemId);
            if (r.error) setError(r.error);
            else router.push(`/admin/binnengekomen/${r.mailId}`);
          });
        }}
        className="text-sm text-brand hover:underline disabled:opacity-60"
      >
        {pending ? "Bezig..." : "← Terug naar Binnengekomen"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
