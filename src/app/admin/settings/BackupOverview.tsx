"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, DatabaseBackup, Download } from "lucide-react";
import { backupDownloadUrlAction, backupNowAction } from "./actions";

export type BackupRow = { key: string; when: string; size: string };

// Instellingen → Systeem: whether the hourly database copies are running,
// how big they are, and the latest ones to download.
export default function BackupOverview({
  configured,
  healthy,
  latest,
  duration,
  lastError,
  count,
  totalSize,
  rows,
}: {
  configured: boolean;
  healthy: boolean;
  latest: string | null;
  duration: string | null;
  lastError: string | null;
  count: number;
  totalSize: string;
  rows: BackupRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function makeNow() {
    setBusy(true);
    setResult(await backupNowAction().catch(() => ({ ok: false, message: "Kopie maken mislukt." })));
    setBusy(false);
    router.refresh();
  }

  async function download(key: string) {
    const { url } = await backupDownloadUrlAction(key).catch(() => ({ url: null }));
    if (url) window.location.href = url;
    else setResult({ ok: false, message: "Downloaden lukte niet." });
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Back-ups van de database</p>
          <p className="text-sm text-inkSoft mt-0.5">
            Elk uur een volledige kopie in de bestandsopslag. Bewaard: alle kopieën van de laatste 48 uur, en daarna één per
            dag voor 14 dagen.
          </p>
        </div>
        <button
          type="button"
          onClick={makeNow}
          disabled={busy || !configured}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
        >
          <DatabaseBackup size={14} className={busy ? "animate-pulse" : ""} />
          {busy ? "Bezig..." : "Nu een kopie maken"}
        </button>
      </div>

      {!configured ? (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          De bestandsopslag is niet ingesteld, dus er worden geen kopieën gemaakt.
        </p>
      ) : (
        <>
          <div
            className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              healthy ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"
            }`}
          >
            {healthy ? <CircleCheck size={16} className="mt-0.5 shrink-0" /> : <CircleAlert size={16} className="mt-0.5 shrink-0" />}
            <div>
              {latest ? `Laatste kopie: ${latest}` : "Nog geen kopie gemaakt."}
              {duration && <span className="text-inkSoft"> · duurde {duration}</span>}
              {!healthy && lastError && <div className="mt-0.5 text-xs">Laatste foutmelding: {lastError}</div>}
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-line px-3 py-2">
              <dt className="text-xs text-inkSoft">Aantal kopieën</dt>
              <dd className="text-ink tabular-nums">{count}</dd>
            </div>
            <div className="rounded-md border border-line px-3 py-2">
              <dt className="text-xs text-inkSoft">Ruimte in gebruik</dt>
              <dd className="text-ink tabular-nums">{totalSize}</dd>
            </div>
          </dl>

          {rows.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-md border border-line text-sm">
              <div className="grid grid-cols-[minmax(0,1fr)_90px_36px] gap-x-3 bg-gray-50 px-3 py-2 text-xs font-medium text-inkSoft">
                <span>Kopie van</span>
                <span className="text-right">Grootte</span>
                <span />
              </div>
              {rows.map((row) => (
                <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_90px_36px] items-center gap-x-3 border-t border-line px-3 py-2">
                  <span className="text-ink">{row.when}</span>
                  <span className="text-right text-inkSoft tabular-nums">{row.size}</span>
                  <button
                    type="button"
                    onClick={() => download(row.key)}
                    aria-label={`Kopie van ${row.when} downloaden`}
                    title="Downloaden"
                    className="justify-self-end text-inkSoft hover:text-ink"
                  >
                    <Download size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {result && (
        <p className={`mt-3 text-sm ${result.ok ? "text-emerald-700" : "text-red-600"}`}>{result.message}</p>
      )}
    </div>
  );
}
