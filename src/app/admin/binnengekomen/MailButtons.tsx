"use client";

import { useState, useTransition } from "react";
import { fetchMailNowAction, refetchDocAction, setMailStatusAction } from "./actions";

export function FetchNowButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await fetchMailNowAction()))}
        className="inline-flex shrink-0 items-center rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? "Ophalen..." : "Nu ophalen"}
      </button>
      {result && <span className={`text-xs ${result.ok ? "text-inkSoft" : "text-red-600"}`}>{result.message}</span>}
    </div>
  );
}

export function StatusButton({ id, ignored, reply = false }: { id: string; ignored: boolean; reply?: boolean }) {
  const [pending, startTransition] = useTransition();
  const next = ignored ? "new" : reply ? "done" : "ignored";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setMailStatusAction(id, next))}
      className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
    >
      {ignored ? "Terugzetten" : reply ? "Gelezen" : "Negeren"}
    </button>
  );
}

// The Google Doc couldn't be read: try again (e.g. after it was shared).
export function RefetchDocButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await refetchDocAction(id)))}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? "Bezig..." : "Opnieuw ophalen"}
      </button>
      {result && <span className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.message}</span>}
    </span>
  );
}
