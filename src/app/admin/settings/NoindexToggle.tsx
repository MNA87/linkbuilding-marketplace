"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setNoindexAction } from "./actions";

export default function NoindexToggle({ initialNoindexEnabled }: { initialNoindexEnabled: boolean }) {
  const router = useRouter();
  const [noindexEnabled, setNoindexEnabled] = useState(initialNoindexEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setError(null);
    const next = !noindexEnabled;
    const result = await setNoindexAction(next);
    if (!result.success) {
      setError(result.error ?? "Opslaan mislukt.");
    } else {
      setNoindexEnabled(next);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Zoekmachines blokkeren</p>
          <p className="text-sm text-inkSoft mt-0.5">
            {noindexEnabled
              ? "Aan — de site staat op noindex, Google en andere zoekmachines nemen 'm niet op."
              : "Uit — de site is gewoon vindbaar/indexeerbaar voor zoekmachines."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className={`shrink-0 rounded-md border px-3 py-2 text-sm disabled:opacity-60 ${
            noindexEnabled ? "border-brand bg-brandSoft text-brand" : "border-line text-inkSoft"
          }`}
        >
          {loading ? "Bezig..." : noindexEnabled ? "Zet uit (maak vindbaar)" : "Zet aan (blokkeer)"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
