import Link from "next/link";
import { ArrowRight, ShoppingCart } from "lucide-react";

// A clean, fixed "naar winkelmandje" button at the bottom of the marketplace,
// so a customer can reach the cart after scrolling a long list without going
// back to the top. Only shown when there's something in the cart. Warm sand —
// a calm second tone, so it doesn't pile more green onto the green "add"
// buttons. The count sits on the right in a dark chip (white reads only on a
// dark background, not on the light sand).
export default function MarketplaceCartBar({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <Link
        href="/dashboard/cart"
        aria-label={`Naar winkelmandje, ${count} ${count === 1 ? "item" : "items"}`}
        className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-[#e3d9c2] bg-[#f0ebe0] px-5 py-3 text-sm font-semibold text-[#3f3a2f] shadow-lg transition hover:brightness-[0.97]"
      >
        <ShoppingCart size={18} strokeWidth={2.2} />
        Naar winkelmandje
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#3f3a2f] px-1.5 text-xs font-bold text-white tabular-nums">
          {count}
        </span>
        <ArrowRight size={16} strokeWidth={2.2} className="opacity-60" />
      </Link>
    </div>
  );
}
