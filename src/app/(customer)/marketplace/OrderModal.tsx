"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

// The order popup over the marketplace. It is driven by the URL (?invullen=<id>)
// instead of an intercepting route, so a refresh keeps it open — the server
// re-renders the list with the popup on top. Closing (×, Esc, backdrop) drops
// the popup's URL parameters, keeping the customer's filters and page. The item
// is already in the cart (as "Actie nodig"), so closing never removes it.
export default function OrderModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const close = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("invullen");
    p.delete("orderItemId");
    p.delete("nieuw");
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
  }, [router, pathname, searchParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <div
      // On phones the form is a page's worth of work, so it fills the screen;
      // from sm up it's a centered card over the marketplace.
      className="fixed inset-0 z-50 flex justify-center bg-black/50 sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* A column: the close bar stays put at the top, only the body below it
          scrolls — so the × never slides away with the content. */}
      <div className="flex h-full w-full flex-col bg-surface shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl">
        <div className="flex shrink-0 justify-end border-b border-line bg-surface px-3 py-2.5 sm:rounded-t-2xl">
          <button
            type="button"
            onClick={close}
            aria-label="Sluiten"
            className="flex h-9 w-9 items-center justify-center rounded-full text-inkSoft transition hover:bg-gray-100 hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 pt-5 sm:p-7 sm:pt-6">{children}</div>
      </div>
    </div>
  );
}
