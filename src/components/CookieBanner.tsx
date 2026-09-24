"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cookie-consent";

// No tracking is wired up yet — this only records the visitor's choice so
// it's in place before any is added. Nothing here reads or writes tracking
// cookies itself.
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage can throw in private browsing — fail open (no banner)
      // rather than break the page.
    }
  }, []);

  function choose(value: "accepted" | "declined") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore — see above
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-line px-4 py-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <p className="text-sm text-inkSoft flex-1">
          We gebruiken alleen functionele cookies om je ingelogd te houden. Zodra we ook analytische of
          marketingcookies gebruiken, vragen we hier opnieuw toestemming voor. Lees ons{" "}
          <a href="/privacy" className="text-brand hover:underline">
            privacybeleid
          </a>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose("declined")}
            className="border border-line rounded-md px-4 py-2 text-sm text-ink hover:bg-brandSoft transition-colors"
          >
            Weigeren
          </button>
          <button
            onClick={() => choose("accepted")}
            className="btn-primary rounded-md px-4 py-2 text-sm font-medium transition"
          >
            Accepteren
          </button>
        </div>
      </div>
    </div>
  );
}
