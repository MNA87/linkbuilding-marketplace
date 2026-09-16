"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAutoPublishAction } from "./actions";

export default function AutoPublishToggle({ initialAutoPublishEnabled }: { initialAutoPublishEnabled: boolean }) {
  const router = useRouter();
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(initialAutoPublishEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setError(null);
    const next = !autoPublishEnabled;
    const result = await setAutoPublishAction(next);
    if (!result.success) {
      setError(result.error ?? "Opslaan mislukt.");
    } else {
      setAutoPublishEnabled(next);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Automatisch publiceren naar WordPress</p>
          <p className="text-sm text-inkSoft mt-0.5">
            {autoPublishEnabled
              ? "Aan — een betaalde order met eigen content en een WordPress-koppeling gaat direct live, zonder controle."
              : "Uit — jij bekijkt en publiceert elke order zelf handmatig via Admin → Orders."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className={`shrink-0 rounded-md border px-3 py-2 text-sm disabled:opacity-60 ${
            autoPublishEnabled ? "border-brand bg-brandSoft text-brand" : "border-line text-inkSoft"
          }`}
        >
          {loading ? "Bezig..." : autoPublishEnabled ? "Zet uit (eerst controleren)" : "Zet aan (direct live)"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
