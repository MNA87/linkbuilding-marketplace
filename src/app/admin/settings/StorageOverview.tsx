"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, CircleCheck } from "lucide-react";
import { moveLegacyFilesAction } from "./actions";

// Instellingen → Systeem, while a previous bucket is still connected: how
// many of its files are not yet in the new buckets, and a button to move them.
export default function StorageOverview({ total, pending }: { total: number; pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function move() {
    setBusy(true);
    setResult(await moveLegacyFilesAction().catch(() => ({ ok: false, message: "Overzetten mislukt." })));
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Bestanden overzetten</p>
          <p className="text-sm text-inkSoft mt-0.5">
            Uploads en back-ups uit de oude opslag naar de nieuwe opslag in Amsterdam. Tot alles over is, haalt de site
            oude bestanden nog uit de oude opslag.
          </p>
        </div>
        <button
          type="button"
          onClick={move}
          disabled={busy || pending === 0}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
        >
          <ArrowRightLeft size={14} className={busy ? "animate-pulse" : ""} />
          {busy ? "Bezig..." : "Overzetten"}
        </button>
      </div>
      {pending === 0 ? (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CircleCheck size={16} className="shrink-0" />
          Alle {total} bestanden staan in de nieuwe opslag. De oude opslag kan weg.
        </p>
      ) : (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nog {pending} van de {total} bestanden over te zetten.
        </p>
      )}
      {result && <p className={`mt-3 text-sm ${result.ok ? "text-emerald-700" : "text-red-600"}`}>{result.message}</p>}
    </div>
  );
}
