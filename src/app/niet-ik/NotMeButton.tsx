"use client";

import { useState, useTransition } from "react";
import { notMeAction } from "./actions";

export default function NotMeButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  if (result) return <p className={`mt-4 text-sm ${result.ok ? "text-ink" : "text-red-600"}`}>{result.message}</p>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => setResult(await notMeAction(token)))}
      className="mt-5 w-full rounded-md bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Bezig..." : "Overal uitloggen en nieuw wachtwoord kiezen"}
    </button>
  );
}
