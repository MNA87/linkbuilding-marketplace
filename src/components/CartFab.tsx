"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";

// A small floating button, bottom-right on every customer page, so you can go
// to the cart and pay from anywhere while browsing a long list — without
// scrolling up to the menu. Shows the running total and the number of links.
// Hidden when the cart is empty, and on the cart page itself (you're there).
export default function CartFab({ count, total }: { count: number; total: number }) {
  const pathname = usePathname();
  if (count <= 0 || pathname?.startsWith("/dashboard/cart")) return null;

  const euro = total.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

  return (
    <Link
      href="/dashboard/cart"
      aria-label={`Naar winkelmandje, ${count} ${count === 1 ? "link" : "links"}, ${euro}`}
      className="btn-pay fixed bottom-5 right-5 z-50 inline-flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold shadow-md shadow-black/10 transition hover:brightness-95"
    >
      <ShoppingCart size={17} />
      <span className="tabular-nums">{euro}</span>
      <span className="h-4 w-px bg-white/35" aria-hidden />
      <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold tabular-nums">
        {count}
      </span>
    </Link>
  );
}
