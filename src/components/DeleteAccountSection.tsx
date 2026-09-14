"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { deleteAccountAction } from "@/lib/actions/account";

export default function DeleteAccountSection({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setError(null);
    setLoading(true);
    try {
      const result = await deleteAccountAction(confirmEmail);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      await signOut({ callbackUrl: "/login" });
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-red-200 rounded-lg p-6 mt-6">
      <h2 className="font-medium text-red-700 mb-2">Account verwijderen</h2>
      <p className="text-sm text-inkSoft mb-4">
        Dit verwijdert je persoonsgegevens permanent (naam, e-mailadres, wachtwoord). Order- en
        factuurgeschiedenis blijft geanonimiseerd bewaard, zoals wettelijk vereist. Dit kan niet ongedaan
        worden gemaakt.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="border border-red-300 text-red-700 rounded-md px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          Verwijder mijn account
        </button>
      ) : (
        <div className="space-y-3">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
          )}
          <label className="block text-sm text-ink">
            Typ je e-mailadres (<span className="font-medium">{userEmail}</span>) ter bevestiging:
          </label>
          <input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={loading || confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()}
              className="bg-red-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Bezig..." : "Definitief verwijderen"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setError(null);
                setConfirmEmail("");
              }}
              className="border border-line rounded-md px-4 py-2 text-sm text-ink hover:bg-brandSoft transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
