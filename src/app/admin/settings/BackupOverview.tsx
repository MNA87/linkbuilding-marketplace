"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, DatabaseBackup, Download, RotateCcw } from "lucide-react";
import { backupDownloadUrlAction, backupNowAction, restoreBackupAction, setOwnBackupsAction } from "./actions";

export type BackupRow = { key: string; when: string; size: string; safety: boolean };

// Instellingen → Systeem: whether the hourly database copies are running,
// how big they are, and the latest ones to download.
export default function BackupOverview({
  configured,
  enabled,
  restored,
  healthy,
  latest,
  duration,
  lastError,
  count,
  totalSize,
  rows,
}: {
  configured: boolean;
  enabled: boolean;
  restored: string | null;
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
  const [restoring, setRestoring] = useState<BackupRow | null>(null);
  const [confirmText, setConfirmText] = useState("");

  async function toggle(next: boolean) {
    setBusy(true);
    await setOwnBackupsAction(next).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  async function restore(row: BackupRow) {
    setBusy(true);
    setResult(await restoreBackupAction(row.key, confirmText).catch(() => ({ ok: false, message: "Terugzetten mislukt." })));
    setBusy(false);
    setRestoring(null);
    setConfirmText("");
    router.refresh();
  }

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
          disabled={busy || !configured || !enabled}
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
          {!enabled ? (
            <p className="mt-3 rounded-md border border-line bg-gray-50 px-3 py-2 text-sm text-inkSoft">
              Eigen back-ups staan uit. Er worden geen nieuwe kopieën gemaakt en er komen geen waarschuwingen; de bestaande
              kopieën blijven tot ze verlopen.
            </p>
          ) : (
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
          )}
          {restored && <p className="mt-2 text-xs text-inkSoft">{restored}</p>}

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
              <div className="grid grid-cols-[minmax(0,1fr)_90px_110px_36px] gap-x-3 bg-gray-50 px-3 py-2 text-xs font-medium text-inkSoft">
                <span>Kopie van</span>
                <span className="text-right">Grootte</span>
                <span />
                <span />
              </div>
              {rows.map((row) => (
                <div key={row.key} className="border-t border-line">
                <div className="grid grid-cols-[minmax(0,1fr)_90px_110px_36px] items-center gap-x-3 px-3 py-2">
                  <span className="text-ink">
                    {row.when}
                    {row.safety && <span className="ml-2 text-xs text-inkSoft">stand vóór terugzetten</span>}
                  </span>
                  <span className="text-right text-inkSoft tabular-nums">{row.size}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRestoring(restoring?.key === row.key ? null : row);
                      setConfirmText("");
                    }}
                    disabled={busy}
                    className="inline-flex items-center justify-end gap-1 text-xs text-inkSoft hover:text-ink disabled:opacity-60"
                  >
                    <RotateCcw size={13} />
                    Terugzetten
                  </button>
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
                {restoring?.key === row.key && (
                  <div className="mx-3 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
                    <p>
                      Hiermee zet je de hele database terug naar <strong>{row.when}</strong>. Alles wat daarna is gebeurd
                      (orders, berichten, wijzigingen) gaat verloren. De huidige stand wordt eerst als extra kopie bewaard.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Typ TERUGZETTEN"
                        aria-label="Typ TERUGZETTEN om te bevestigen"
                        className="w-44 rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-sm text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => restore(row)}
                        disabled={busy || confirmText.trim() !== "TERUGZETTEN"}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {busy ? "Bezig..." : "Terugzetten"}
                      </button>
                      <button type="button" onClick={() => setRestoring(null)} className="text-sm text-red-800 underline-offset-2 hover:underline">
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {configured && (
        <label className="mt-4 flex items-start gap-2.5 border-t border-line pt-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => toggle(e.target.checked)}
            className="mt-0.5 accent-[var(--btn-primary-bg,#2563eb)]"
          />
          <span>
            <span className="text-ink">Eigen back-ups aan</span>
            <span className="block text-xs text-inkSoft">
              Zet dit uit zodra je Railway Pro hebt en daar de back-ups aanstaan. Dan maakt de site zelf geen kopieën meer.
            </span>
          </span>
        </label>
      )}

      {result && (
        <p className={`mt-3 text-sm ${result.ok ? "text-emerald-700" : "text-red-600"}`}>{result.message}</p>
      )}
    </div>
  );
}
