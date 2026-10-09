"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInvoiceEmailAction } from "../actions";

// "Facturen naar": another address for the verzamelfactuur; empty = the
// customer's own email (shown as the placeholder).
export default function InvoiceEmailForm({
  companyId,
  current,
  fallback,
}: {
  companyId: string;
  current: string;
  fallback: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = () =>
    startTransition(async () => {
      const r = await saveInvoiceEmailAction(companyId, value);
      setMessage(r.error ? { ok: false, text: r.error } : { ok: true, text: "Opgeslagen." });
      if (!r.error) router.refresh();
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <input
        type="email"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMessage(null);
        }}
        placeholder={fallback || "e-mailadres"}
        className="w-full max-w-sm rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
      />
      <button
        type="submit"
        disabled={pending || value.trim() === current}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-60"
      >
        Opslaan
      </button>
      {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</span>}
    </form>
  );
}
