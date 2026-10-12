"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAlertMailsAction } from "./actions";

// Instellingen → Systeem: the mails about things that keep going wrong
// (src/lib/systemAlerts.ts), to switch off for a while if they're too many.
export default function AlertMailsToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setError(null);
    const result = await setAlertMailsAction(!enabled);
    if (!result.success) setError(result.error ?? "Opslaan mislukt.");
    else {
      setEnabled(!enabled);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Foutmeldingen per mail</p>
          <p className="text-sm text-inkSoft mt-0.5">
            {enabled
              ? "Aan — je krijgt een mail als iets op het platform blijft misgaan (mail ophalen, herinneringen, inplannen, een pagina), en één als het weer werkt. Hooguit 10 per dag."
              : "Uit — je krijgt geen foutmeldingen per mail. Zet hem weer aan zodra het kan."}{" "}
            De melding over de back-up blijft altijd aan.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className={`shrink-0 rounded-md border px-3 py-2 text-sm disabled:opacity-60 ${
            enabled ? "border-brand bg-brandSoft text-brand" : "border-line text-inkSoft"
          }`}
        >
          {loading ? "Bezig..." : enabled ? "Zet uit" : "Zet aan"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
