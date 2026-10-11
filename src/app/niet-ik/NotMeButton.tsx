"use client";

import { useState, useTransition } from "react";
import { AuthError, AuthNotice } from "@/components/AuthCard";
import { notMeAction } from "./actions";

export default function NotMeButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  if (result)
    return (
      <div className="mt-6">
        {result.ok ? <AuthNotice>{result.message}</AuthNotice> : <AuthError>{result.message}</AuthError>}
      </div>
    );
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => setResult(await notMeAction(token)))}
      className="mt-6 block w-full rounded-lg bg-red-600 py-3 text-[15px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Bezig..." : "Overal uitloggen en nieuw wachtwoord kiezen"}
    </button>
  );
}
