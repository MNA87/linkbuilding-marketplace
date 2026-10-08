"use client";

import { useState, useTransition } from "react";
import { askToShareDocAction, fetchMailNowAction, refetchDocAction, setMailStatusAction } from "./actions";

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
export function RefetchDocButton({ id, label = "Opnieuw ophalen" }: { id: string; label?: string }) {
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
        {pending ? "Bezig..." : label}
      </button>
      {/* A failure shows once, at the Google Doc above (the page reloads). */}
      {result?.ok && <span className="text-xs text-emerald-700">{result.message}</span>}
    </span>
  );
}

// The Google Doc isn't shared: ask the customer, with how to do it.
export function AskShareButton({ id, askedOn }: { id: string; askedOn: string | null }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await askToShareDocAction(id)))}
        className="btn-pay rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Bezig..." : askedOn ? "Nog eens vragen" : "Vraag klant om te delen"}
      </button>
      {result ? (
        <span className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.message}</span>
      ) : (
        askedOn && <span className="text-xs text-inkSoft">Gevraagd op {askedOn}</span>
      )}
    </span>
  );
}
