"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps a page's server-rendered numbers current without reloading: a new
// order paid in another tab (or through Stripe) shows up by itself, both in
// the lists and in the red counts in the menu. Refreshes now and then while
// the tab is in view, and right away when coming back to it. What's typed
// in a form stays as it is.
export default function AutoRefresh({ everySeconds = 20 }: { everySeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, everySeconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router, everySeconds]);
  return null;
}
