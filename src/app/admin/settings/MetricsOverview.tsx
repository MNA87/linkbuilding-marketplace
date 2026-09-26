"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshWebsiteMetricsAction } from "../websites/actions";
import { refreshAllMetricsAction } from "./actions";

export type SiteRefreshRow = { id: string; domain: string; lastRun: string | null; nextRun: string };

// Instellingen → Koppelingen: per website when its figures were last fetched
// and when the monthly run comes round again, with a button per site and
// one for all.
export default function MetricsOverview({ sites }: { sites: SiteRefreshRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function refreshAll() {
    const n = sites.length;
    if (!confirm(`De cijfers van alle ${n} websites nu ophalen? Dat kost ongeveer ${(n * 160).toLocaleString("nl-NL")} Ahrefs-units en ${n * 3} credits.`))
      return;
    setBusy("all");
    setResult(await refreshAllMetricsAction().catch(() => ({ ok: false, message: "Starten mislukt." })));
    setBusy(null);
  }

  async function refreshOne(site: SiteRefreshRow) {
    setBusy(site.id);
    const res = await refreshWebsiteMetricsAction(site.id).catch(() => ({ ok: false, message: "Ophalen mislukt." }));
    setResult({ ok: res.ok, message: `${site.domain}: ${res.message}` });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Websitecijfers</p>
          <p className="text-sm text-inkSoft mt-0.5">
            DR, verkeer, verwijzende domeinen, DA, TF en IP-adres. Een nieuwe website wordt meteen opgehaald, daarna elke 30
            dagen vanzelf opnieuw.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={busy !== null || sites.length === 0}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={busy === "all" ? "animate-spin" : ""} />
          Alle websites nu vernieuwen
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-line text-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_150px_150px_36px] gap-x-3 bg-gray-50 px-3 py-2 text-xs font-medium text-inkSoft">
          <span>Website</span>
          <span>Laatst bijgewerkt</span>
          <span>Volgende update</span>
          <span />
        </div>
        {sites.map((site) => (
          <div
            key={site.id}
            className="grid grid-cols-[minmax(0,1fr)_150px_150px_36px] items-center gap-x-3 border-t border-line px-3 py-2"
          >
            <span className="truncate text-ink">{site.domain}</span>
            <span className="text-inkSoft tabular-nums">{site.lastRun ?? "Nog nooit"}</span>
            <span className="text-inkSoft tabular-nums">{site.nextRun}</span>
            <button
              type="button"
              onClick={() => refreshOne(site)}
              disabled={busy !== null}
              title="Nu vernieuwen"
              aria-label={`${site.domain} nu vernieuwen`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-inkSoft hover:bg-gray-100 hover:text-ink disabled:opacity-50"
            >
              <RefreshCw size={14} className={busy === site.id ? "animate-spin" : ""} />
            </button>
          </div>
        ))}
        {sites.length === 0 && <div className="border-t border-line px-3 py-4 text-center text-inkSoft">Nog geen websites.</div>}
      </div>

      {result && <p className={`mt-2 text-sm ${result.ok ? "text-emerald-700" : "text-red-600"}`}>{result.message}</p>}
    </div>
  );
}
