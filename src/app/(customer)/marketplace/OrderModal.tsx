"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

// The order popup over the marketplace. It is driven by the URL (?invullen=<id>)
// instead of an intercepting route, so a refresh keeps it open — the server
// re-renders the list with the popup on top. Closing (×, Esc, backdrop) just
// drops the "invullen" parameter, keeping the customer's filters and page.
export default function OrderModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const close = useCallback(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("invullen");
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="relative my-4 w-full max-w-4xl rounded-2xl bg-surface shadow-2xl">
        <button
          type="button"
          onClick={close}
          aria-label="Sluiten"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-inkSoft transition hover:bg-gray-100 hover:text-ink"
        >
          <X size={20} />
        </button>
        <div className="p-5 sm:p-7">{children}</div>
      </div>
    </div>
  );
}
