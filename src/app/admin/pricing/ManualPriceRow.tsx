"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setManualPriceAction } from "./actions";

export default function ManualPriceRow({
  websiteProductId,
  domain,
  productName,
  supplierPrice,
  currentManualPrice,
}: {
  websiteProductId: string;
  domain: string;
  productName: string;
  supplierPrice: string;
  currentManualPrice: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentManualPrice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const price = value.trim() === "" ? null : Number(value);
      const result = await setManualPriceAction(websiteProductId, price);
      if (!result.success) setError(result.error ?? "Fout");
      else router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3 text-ink">{domain}</td>
      <td className="px-4 py-3 text-inkSoft">{productName}</td>
      <td className="px-4 py-3 text-inkSoft">&euro;{supplierPrice}</td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="automatisch"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 border border-line rounded-md px-2 py-1 text-sm"
        />
        {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={handleSave}
          disabled={loading || value === currentManualPrice}
          className="text-brand text-sm hover:underline disabled:opacity-40"
        >
          {loading ? "Bezig..." : "Opslaan"}
        </button>
      </td>
    </tr>
  );
}
