"use client";

import { useState, useTransition } from "react";
import { createCollectiveInvoiceAction, sendInvoiceReminderAction, setInvoicePaidAction } from "./actions";

type Result = { ok: boolean; message: string } | null;

function Message({ result }: { result: Result }) {
  if (!result) return null;
  return <span className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.message}</span>;
}

// "Factuur maken en versturen": after the concept was checked. "byMail": the
// customer orders by mail and gets nothing from the platform; you send it.
export function CreateButton({ groupKey, label, byMail }: { groupKey: string; label: string; byMail: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result>(null);
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <Message result={result} />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const what = byMail ? "maken? Je stuurt hem daarna zelf" : "maken en naar de klant mailen?";
          if (!confirm(`Factuur voor ${label} ${what}. Het factuurnummer ligt daarna vast.`)) return;
          start(async () => {
            const result = await createCollectiveInvoiceAction(groupKey);
            setResult(result);
            // The row leaves the list once the invoice exists: say it plainly.
            if (!result.ok) alert(result.message);
          });
        }}
        className="btn-pay rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      >
        {pending ? "Bezig..." : byMail ? "Factuur maken" : "Factuur maken en versturen"}
      </button>
    </span>
  );
}

export function OpenInvoiceButtons({ invoiceId, byMail }: { invoiceId: string; byMail: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result>(null);
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <Message result={result} />
      {byMail ? (
        <a
          href={`/api/invoices/${invoiceId}/pdf?download=1`}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-gray-50"
        >
          Downloaden
        </a>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setResult(await sendInvoiceReminderAction(invoiceId)))}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-gray-50 disabled:opacity-60"
        >
          Herinnering sturen
        </button>
      )}
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
