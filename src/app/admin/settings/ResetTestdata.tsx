"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetTestdataAction } from "./actions";
import type { ResetCounts } from "@/lib/testdataReset";

// Instellingen → Systeem: everything back to zero while testing (only shown
// while Stripe is in test mode). What goes and what stays, then WISSEN.
export default function ResetTestdata({ counts }: { counts: ResetCounts }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function wipe() {
    setLoading(true);
    setResult(null);
    const r = await resetTestdataAction(confirm);
    setResult(r);
    if (r.ok) {
      setOpen(false);
      setConfirm("");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Testdata wissen (voor livegang)</p>
          <p className="text-sm text-inkSoft mt-0.5">
            Alles terug naar nul, zo vaak als je wilt zolang Stripe in testmodus staat. Staat Stripe live, dan is deze
            knop weg.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setResult(null);
            }}
            className="shrink-0 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Wissen…
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-semibold text-red-800">Dit gaat weg:</p>
          <p className="mt-1 text-red-800">
            {counts.customers} klanten, {counts.orders} orders, {counts.payments} betalingen, {counts.invoices}{" "}
            facturen, {counts.placements} plaatsingen en {counts.mails} mails (Binnengekomen en verstuurd). De factuur-
            en ordernummers beginnen weer bij 1.
          </p>
          <p className="mt-2 text-ink">
            Dit blijft: je websites, prijzen, onderwerpen en lijsten, al je instellingen, de planning en je
            admin-account. Artikelen die al online staan op je sites blijven daar staan.
          </p>
          <p className="mt-2 text-ink">
            Eerst wordt automatisch een back-up gemaakt, zodat er altijd een weg terug is.
          </p>
          <label className="mt-3 block text-ink">
            Typ <strong>WISSEN</strong> om te bevestigen
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 block w-48 rounded-md border border-line bg-white px-3 py-2 text-sm"
              autoComplete="off"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm("");
              }}
              disabled={loading}
              className="rounded-md border border-line bg-surface px-3 py-2 text-ink hover:bg-gray-50 disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={wipe}
              disabled={loading || confirm.trim() !== "WISSEN"}
              className="rounded-md bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Bezig met back-up en wissen…" : "Alles wissen"}
            </button>
          </div>
        </div>
      )}
      {result && <p className={`mt-3 text-sm ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.message}</p>}
    </div>
  );
}
