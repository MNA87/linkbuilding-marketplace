"use client";

import { useState, useTransition } from "react";
import { fetchMailNowAction, setMailStatusAction } from "./actions";

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

export function StatusButton({ id, ignored }: { id: string; ignored: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setMailStatusAction(id, ignored ? "new" : "ignored"))}
      className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
    >
      {ignored ? "Terugzetten" : "Negeren"}
    </button>
  );
}
