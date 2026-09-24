"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4">
      <div className="text-center max-w-sm">
        <div className="font-serif text-2xl text-ink mb-2">Er ging iets mis</div>
        <p className="text-sm text-inkSoft mb-6">
          Onze excuses, er is een onverwachte fout opgetreden. We zijn hiervan op de hoogte gebracht.
        </p>
        <button
          onClick={reset}
          className="btn-primary rounded-md px-4 py-2 text-sm font-medium transition"
        >
          Probeer opnieuw
        </button>
      </div>
    </div>
  );
}
