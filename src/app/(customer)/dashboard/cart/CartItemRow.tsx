"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { removeCartItemAction } from "./actions";

export default function CartItemRow({
  orderItemId,
  websiteProductId,
  domain,
  anchorText,
  hasContent,
  isHomepageLink,
  price,
  details,
  isRenewal,
}: {
  orderItemId: string;
  websiteProductId: string;
  domain: string;
  anchorText: string | null;
  hasContent: boolean;
  isHomepageLink: boolean;
  price: string;
  // e.g. "2 jaar · online op 1-10-2026"
  details: string;
  isRenewal: boolean;
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
        <div className="text-sm text-ink font-medium">
          {isRenewal ? `Verlenging ${domain}` : domain}
        </div>
        <div className="text-xs text-inkSoft">{details}</div>
        {anchorText && !isRenewal && <div className="text-xs text-inkSoft">Anker: {anchorText}</div>}
        {isRenewal ? null : hasContent ? (
          <Link
            href={`/marketplace/${websiteProductId}?orderItemId=${orderItemId}`}
            className="text-xs text-brand hover:underline"
          >
            {isHomepageLink ? "Linkje bewerken" : "Artikel bewerken"}
          </Link>
        ) : (
          <Link
            href={`/marketplace/${websiteProductId}?orderItemId=${orderItemId}`}
            className="text-xs text-amber-700 font-medium hover:underline"
          >
            {isHomepageLink ? "Vul nog je linkje in →" : "Vul nog je artikel in →"}
          </Link>
        )}
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
