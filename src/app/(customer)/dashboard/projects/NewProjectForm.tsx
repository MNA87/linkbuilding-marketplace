"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction } from "./actions";

export default function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetWebsite, setTargetWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await createProjectAction({ name, targetWebsite, notes });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      setName("");
      setTargetWebsite("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}
      <div>
        <label className="block text-sm text-ink mb-1">Naam</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
      </div>
      <div>
        <label className="block text-sm text-ink mb-1">Doelwebsite (optioneel)</label>
        <input
          value={targetWebsite}
          onChange={(e) => setTargetWebsite(e.target.value)}
          className={inputClass}
          placeholder="jouwsite.nl"
        />
      </div>
      <div>
        <label className="block text-sm text-ink mb-1">Notities (optioneel)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : "Aanmaken"}
      </button>
    </form>
  );
}
