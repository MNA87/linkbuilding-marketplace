"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeCartItemAction } from "./actions";

export default function CartItemRow({
  orderItemId,
  domain,
  anchorText,
  price,
}: {
  orderItemId: string;
  domain: string;
  anchorText: string;
  price: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    try {
      await removeCartItemAction(orderItemId);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between border border-line rounded-md px-3 py-2">
      <div>
        <div className="text-sm text-ink font-medium">{domain}</div>
        <div className="text-xs text-inkSoft">Anker: {anchorText}</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-ink">&euro;{price}</div>
        <button
          onClick={handleRemove}
          disabled={loading}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {loading ? "..." : "Verwijderen"}
        </button>
      </div>
    </div>
  );
}
