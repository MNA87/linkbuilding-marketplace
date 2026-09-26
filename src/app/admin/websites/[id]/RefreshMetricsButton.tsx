"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshWebsiteMetricsAction } from "../actions";

export default function RefreshMetricsButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function refresh() {
    setBusy(true);
    setResult(null);
    const res = await refreshWebsiteMetricsAction(websiteId).catch(() => ({ ok: false, message: "Ophalen mislukt." }));
    setBusy(false);
    setResult(res);
    router.refresh();
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
      >
        <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
        {busy ? "Bezig..." : "Nu vernieuwen"}
      </button>
      {result && <p className={`mt-1 text-xs ${result.ok ? "text-emerald-700" : "text-red-600"}`}>{result.message}</p>}
    </div>
  );
}
