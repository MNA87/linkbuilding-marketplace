"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBulkOrderingAction } from "../actions";

// Pick this customer's account type: Bureau (on = orders on account /
// verzamelfactuur) or Regulier (off = pays straight away). Same ordering
// screen either way — only the checkout differs.
export default function BulkOrderingToggle({ companyId, enabled }: { companyId: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const r = await setBulkOrderingAction(companyId, next);
      if (r.error) {
        setOn(!next);
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-4">
      <div>
        <div className="font-medium text-ink">Bureau — op rekening</div>
        <p className="mt-0.5 text-sm text-inkSoft">
          Aan = <span className="font-medium text-ink">Bureau</span>: bestelt op rekening (verzamelfactuur). Uit ={" "}
          <span className="font-medium text-ink">Regulier</span>: rekent direct af via betalen. Het bestelscherm is in
          beide gevallen hetzelfde — alleen de afrekening verschilt.
        </p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={toggle}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          on ? "bg-[var(--btn-pay-bg)]" : "bg-gray-300"
        }`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
