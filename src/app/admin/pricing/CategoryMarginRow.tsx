"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCategoryMarginAction } from "./actions";

export default function CategoryMarginRow({
  categoryId,
  categoryName,
  currentMargin,
}: {
  categoryId: string;
  categoryName: string;
  currentMargin: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentMargin));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const result = await setCategoryMarginAction(categoryId, Number(value));
      if (!result.success) setError(result.error ?? "Fout");
      else router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3 text-ink">{categoryName}</td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 border border-line rounded-md px-2 py-1 text-sm"
        />
        {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={handleSave}
          disabled={loading || value === String(currentMargin)}
          className="text-brand text-sm hover:underline disabled:opacity-40"
        >
          {loading ? "Bezig..." : "Opslaan"}
        </button>
      </td>
    </tr>
  );
}
