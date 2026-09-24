"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type DetailsField = { name: string; label: string; placeholder?: string; optional?: boolean; wide?: boolean };

// A plain labelled form for a handful of text fields (invoice details), saved
// through a server action that validates and normalises them.
export default function DetailsForm({
  fields,
  initialValues,
  action,
  submitLabel = "Opslaan",
}: {
  fields: DetailsField[];
  initialValues: Record<string, string>;
  // `values` on success: the saved, normalised version (e.g. "1234ab" →
  // "1234 AB"), shown in the form from then on.
  action: (
    values: Record<string, string>
  ) => Promise<{ error: string | null; success: boolean; values?: Record<string, string> }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await action(values);
      setMessage(result.success ? { ok: true, text: "Opgeslagen." } : { ok: false, text: result.error ?? "Opslaan mislukt." });
      if (result.success) {
        if (result.values) setValues(result.values);
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Opslaan mislukt. Probeer het opnieuw." });
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((f) => (
        <label key={f.name} className={`block ${f.wide ? "sm:col-span-2" : ""}`}>
          <span className="block text-sm text-ink mb-1">
            {f.label}
            {f.optional && <span className="text-inkSoft"> (optioneel)</span>}
          </span>
          <input
            name={f.name}
            value={values[f.name] ?? ""}
            placeholder={f.placeholder}
            required={!f.optional}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      ))}
      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Bezig..." : submitLabel}
        </button>
        {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</span>}
      </div>
    </form>
  );
}
