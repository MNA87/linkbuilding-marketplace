"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";

// A small floating button, bottom-right on every customer page, so you can go
// to the cart and pay from anywhere while browsing a long list — without
// scrolling up to the menu. Hidden when the cart is empty, and on the cart
// page itself (you're already there).
export default function CartFab({ count }: { count: number }) {
  const pathname = usePathname();
  if (count <= 0 || pathname?.startsWith("/dashboard/cart")) return null;

  return (
    <Link
      href="/dashboard/cart"
      aria-label={`Naar winkelmandje, ${count} ${count === 1 ? "link" : "links"}`}
      className="btn-pay fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg shadow-black/15 transition hover:brightness-95"
    >
      <ShoppingCart size={18} />
      <span>Naar mandje</span>
      <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-[13px] font-bold tabular-nums">
        {count}
      </span>
    </Link>
  );
}
