"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/lib/actions/profile";

export default function EditProfileSection({
  initialName,
  initialCompanyName,
}: {
  initialName: string;
  initialCompanyName: string;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await updateProfileAction({ name, companyName });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      await update({ name, companyName });
      router.refresh();
      setOpen(false);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-brand hover:underline">
        Gegevens bewerken
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}
      <div>
        <label className="block text-sm text-ink mb-1">Jouw naam</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
      </div>
      <div>
        <label className="block text-sm text-ink mb-1">Bedrijfsnaam</label>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 transition"
        >
          {loading ? "Bezig..." : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border border-line text-inkSoft rounded-md px-4 py-2 text-sm hover:bg-brandSoft transition-colors"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
