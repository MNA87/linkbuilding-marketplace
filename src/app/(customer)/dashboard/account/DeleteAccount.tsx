"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { deleteAccountAction } from "@/lib/actions/account";
import { inputClass } from "./ui";

// "Account verwijderen" in the Privacy tab: confirmed by typing the e-mail
// address, right there in the row.
export default function DeleteAccount({ email }: { email: string }) {
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
    <div className="border-t border-line pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-red-700">Account verwijderen</p>
          <p className="text-sm text-inkSoft">
            Je persoonsgegevens worden gewist. Orders en facturen blijven geanonimiseerd bewaard, zoals de wet vereist.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 self-start rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 sm:self-auto"
          >
            Verwijderen
          </button>
        )}
      </div>
      {open && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-4">
          <label className="block text-sm text-ink">
            Dit kan niet ongedaan worden gemaakt. Typ je e-mailadres (<strong className="font-semibold">{email}</strong>)
            ter bevestiging:
            <input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className={`${inputClass} mt-2`}
            />
          </label>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Bezig..." : "Definitief verwijderen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                setConfirmEmail("");
              }}
              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
