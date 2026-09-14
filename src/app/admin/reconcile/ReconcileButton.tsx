"use client";

import { useState } from "react";
import { reconcilePaymentsAction, type ReconcileResult } from "./actions";

export default function ReconcileButton() {
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const r = await reconcilePaymentsAction();
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : "Nu controleren"}
      </button>

      {result && (
        <div className="mt-4 bg-surface border border-line rounded-lg p-4 text-sm">
          {result.error ? (
            <div className="text-red-600">{result.error}</div>
          ) : (
            <>
              <div className="text-ink font-medium mb-2">
                {result.checked} gecontroleerd, {result.fixed} hersteld.
              </div>
              {result.details.map((d, i) => (
                <div key={i} className="text-inkSoft">
                  {d}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
