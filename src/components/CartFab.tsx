"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A small floating button, bottom-right on every customer page, so you can go
// to the cart and pay from anywhere while browsing a long list — without
// scrolling up to the menu. Shows the number of links in the cart. Hidden when
// the cart is empty, and on the cart page itself (you're already there).
export default function CartFab({ count }: { count: number }) {
  const pathname = usePathname();
  if (count <= 0 || pathname?.startsWith("/dashboard/cart")) return null;

  return (
    <Link
      href="/dashboard/cart"
      aria-label={`Naar bestelling, ${count} ${count === 1 ? "link" : "links"}`}
      className="btn-pay fixed bottom-5 right-5 z-50 inline-flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold shadow-md shadow-black/10 transition hover:brightness-95"
    >
      <span>Bestelling</span>
      <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold tabular-nums text-[var(--btn-pay-bg)]">
        {count}
      </span>
    </Link>
  );
}
