"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";

// A dialog that overlays the marketplace, used by the intercepting route. The
// parallel "@modal" slot keeps its content on a client navigation, so the
// popup hides itself the moment the URL is no longer a /marketplace/<id> order
// screen — i.e. after the form navigates to the list, the cart or checkout.
// Closing by hand (×, Esc, backdrop) navigates back, which also unmasks the URL.
export default function RouteModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const open = (pathname ?? "").startsWith("/marketplace/");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div className="relative my-4 w-full max-w-4xl rounded-2xl bg-surface shadow-2xl">
        <button
          type="button"
          onClick={() => router.back()}
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
