"use client";

import Link from "next/link";

export type CartItemView = {
  id: string;
  websiteProductId: string;
  domain: string;
  anchorText: string | null;
  hasContent: boolean;
  isHomepageLink: boolean;
  isRenewal: boolean;
  price: number;
  // e.g. "2 jaar · online op 1-10-2026"
  details: string;
};

export default function CartItemRow({ item, onRemove }: { item: CartItemView; onRemove: () => void }) {
  const editHref = `/marketplace/${item.websiteProductId}?orderItemId=${item.id}`;

  return (
    <div className="flex items-center justify-between border border-line rounded-md px-3 py-2">
      <div>
        <div className="text-sm text-ink font-medium">
          {item.isRenewal ? `Verlenging ${item.domain}` : item.domain}
        </div>
        <div className="text-xs text-inkSoft">{item.details}</div>
        {item.anchorText && !item.isRenewal && <div className="text-xs text-inkSoft">Anker: {item.anchorText}</div>}
        {item.isRenewal ? null : item.hasContent ? (
          <Link href={editHref} className="text-xs text-brand hover:underline">
            {item.isHomepageLink ? "Linkje bewerken" : "Artikel bewerken"}
          </Link>
        ) : (
          <Link href={editHref} className="text-xs text-amber-700 font-medium hover:underline">
            {item.isHomepageLink ? "Vul nog je linkje in →" : "Vul nog je artikel in →"}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-ink">&euro;{item.price.toFixed(2)}</div>
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
          Verwijderen
        </button>
      </div>
    </div>
  );
}
