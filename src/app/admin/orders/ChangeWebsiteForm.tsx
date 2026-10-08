"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminChangeWebsiteAction } from "./actions";

// The wrong site chosen: pick another before the article goes online.
export default function ChangeWebsiteForm({
  orderItemId,
  current,
  websites,
  repriced,
}: {
  orderItemId: string;
  current: { id: string; domain: string };
  websites: { id: string; domain: string }[];
  // True: the price follows the new site (a mail order not invoiced yet).
  repriced: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [site, setSite] = useState(current.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-brand hover:underline">
        Website wijzigen
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-line bg-gray-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={site}
          onChange={(e) => setSite(e.target.value)}
          aria-label="Website"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          {websites.map((w) => (
            <option key={w.id} value={w.id}>
              {w.domain}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-gray-50"
        >
          Annuleren
        </button>
        <button
          type="button"
          disabled={pending || site === current.id}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await adminChangeWebsiteAction(orderItemId, site);
              if (r.error) setError(r.error);
              else {
                setOpen(false);
                router.refresh();
              }
            })
          }
          className="btn-pay rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Bezig..." : "Opslaan"}
        </button>
      </div>
      <div className="mt-1.5 text-xs text-inkSoft">
        {repriced
          ? "De prijs gaat mee met de nieuwe website (zoals afgesproken met de klant)."
          : "De klant heeft al betaald: de prijs blijft zoals betaald."}
      </div>
      {error && <div className="mt-1.5 text-sm text-red-700">{error}</div>}
    </div>
  );
}
