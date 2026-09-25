"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setWritingPriceAction } from "./actions";

export default function WritingPriceSetting({ initialPrice }: { initialPrice: number }) {
  const router = useRouter();
  const [value, setValue] = useState(initialPrice.toFixed(2));
  const [saved, setSaved] = useState(initialPrice.toFixed(2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(value.replace(",", "."));
    if (!Number.isFinite(price)) {
      setError("Vul een bedrag in.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await setWritingPriceAction(price);
    if (!result.success) {
      setError(result.error ?? "Opslaan mislukt.");
    } else {
      setValue(price.toFixed(2));
      setSaved(price.toFixed(2));
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Prijs &ldquo;Laat ons schrijven&rdquo;</p>
          <p className="text-sm text-inkSoft mt-0.5">
            Wat de klant extra betaalt als wij het blogartikel schrijven (excl. BTW). Op €0 staat het als gratis.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-inkSoft">€</span>
          <input
            aria-label="Prijs Laat ons schrijven"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 border border-line rounded-md px-2 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={loading || value === saved}
            className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-brandSoft disabled:opacity-50 disabled:hover:bg-transparent"
          >
            {loading ? "Bezig..." : "Opslaan"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </form>
  );
}
