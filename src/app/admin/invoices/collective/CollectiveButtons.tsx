"use client";

import { useState, useTransition } from "react";
import { createCollectiveInvoiceAction, sendInvoiceReminderAction, setInvoicePaidAction } from "./actions";

type Result = { ok: boolean; message: string } | null;

function Message({ result }: { result: Result }) {
  if (!result) return null;
  return <span className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.message}</span>;
}

// "Factuur maken en versturen": after the concept was checked.
export function CreateButton({ groupKey, label }: { groupKey: string; label: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result>(null);
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <Message result={result} />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Factuur voor ${label} maken en naar de klant mailen? Het factuurnummer ligt daarna vast.`))
            return;
          start(async () => {
            const result = await createCollectiveInvoiceAction(groupKey);
            setResult(result);
            // The row leaves the list once the invoice exists: say it plainly.
            if (!result.ok) alert(result.message);
          });
        }}
        className="btn-pay rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      >
        {pending ? "Bezig..." : "Factuur maken en versturen"}
      </button>
    </span>
  );
}

export function OpenInvoiceButtons({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result>(null);
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <Message result={result} />
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await sendInvoiceReminderAction(invoiceId)))}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-gray-50 disabled:opacity-60"
      >
        Herinnering sturen
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await setInvoicePaidAction(invoiceId, true)))}
        className="btn-pay rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      >
        Betaald
      </button>
    </span>
  );
}

export function UndoPaidButton({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setInvoicePaidAction(invoiceId, false)))}
      className="text-xs text-inkSoft hover:text-ink hover:underline disabled:opacity-60"
    >
      Toch niet betaald
    </button>
  );
}
