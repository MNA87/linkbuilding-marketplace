"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleAlert, KeyRound } from "lucide-react";
import type { CredentialStatus } from "@/lib/apiCredentials";
import { deleteApiKeyAction, saveApiKeyAction, testApiKeyAction } from "./actions";

// One block per external service: the key itself is only ever typed in —
// afterwards just its last four characters show.
type TestResult = { ok: boolean; message: string };

function ApiKeyBlock({ status, balance }: { status: CredentialStatus; balance: TestResult | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(status.source === null || status.unreadable);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Checked when the tab opens (what's left, or why it doesn't work); the
  // button checks again.
  const [test, setTest] = useState<TestResult | null>(balance);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    setTest(null);
    const result = await saveApiKeyAction(status.provider, value).catch(() => null);
    setBusy(null);
    if (!result?.success) {
      setError(result?.error ?? "Opslaan mislukt.");
      return;
    }
    setValue("");
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Sleutel van ${status.label} verwijderen?`)) return;
    setBusy("delete");
    setTest(null);
    await deleteApiKeyAction(status.provider).catch(() => null);
    setBusy(null);
    router.refresh();
  }

  async function runTest() {
    setBusy("test");
    setTest(null);
    setTest(await testApiKeyAction(status.provider).catch(() => ({ ok: false, message: "Testen mislukt." })));
    setBusy(null);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">{status.label}</p>
          <p className="text-sm text-inkSoft mt-0.5">Voor: {status.what}.</p>
        </div>
        {status.source && !editing && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CircleCheck size={13} /> Ingesteld
          </span>
        )}
      </div>

      {status.unreadable && (
        <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          De opgeslagen sleutel kan niet meer gelezen worden. Vul hem opnieuw in.
        </p>
      )}

      {!editing && status.source ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-line bg-gray-50 px-3 py-2 font-mono text-sm text-ink">
            <KeyRound size={14} className="text-inkSoft" />
            ••••••••{status.last4}
          </span>
          {status.source === "railway" && <span className="text-xs text-inkSoft">uit Railway</span>}
          <button
            type="button"
            onClick={runTest}
            disabled={busy !== null}
            className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "test" ? "Testen..." : "Test verbinding"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-gray-50"
          >
            Vervangen
          </button>
          {status.source === "admin" && (
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="px-2 py-2 text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              Verwijderen
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={save} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-label={`API-sleutel ${status.label}`}
            placeholder="Plak hier de API-sleutel"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-w-0 flex-1 border border-line rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={busy !== null || !value.trim()}
            className="btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy === "save" ? "Bezig..." : "Opslaan"}
          </button>
          {status.source && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue("");
                setError(null);
              }}
              className="px-2 py-2 text-sm text-inkSoft hover:text-ink"
            >
              Annuleren
            </button>
          )}
        </form>
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {test && (
        <p className={`mt-2 flex items-center gap-1.5 text-sm ${test.ok ? "text-emerald-700" : "text-red-600"}`}>
          {test.ok ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
          {test.message}
        </p>
      )}
    </div>
  );
}

export default function ApiKeysSettings({
  statuses,
  balances,
}: {
  statuses: CredentialStatus[];
  balances: Partial<Record<string, TestResult>>;
}) {
  return (
    <>
      <p className="text-sm text-inkSoft">
        De sleutels worden versleuteld bewaard. Na opslaan zie je alleen de laatste vier tekens; de sleutel zelf is nergens
        meer terug te lezen.
      </p>
      {statuses.map((s) => (
        // Remounted when the key changes, so a fresh check shows.
        <ApiKeyBlock key={`${s.provider}-${s.last4}`} status={s} balance={balances[s.provider] ?? null} />
      ))}
    </>
  );
}
