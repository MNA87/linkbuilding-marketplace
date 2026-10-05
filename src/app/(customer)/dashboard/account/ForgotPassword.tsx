"use client";

import { useState } from "react";
import { sendMyPasswordResetAction } from "./actions";

// Under a "Huidig wachtwoord" field: forgot it? A link to set a new one
// goes to the account's own address.
export default function ForgotPassword() {
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function send() {
    setLoading(true);
    try {
      const result = await sendMyPasswordResetAction();
      setState(
        result.success
          ? {
              ok: true,
              text: `We hebben een link gestuurd naar ${result.email}. Daarmee stel je een nieuw wachtwoord in; hij is 15 minuten geldig.`,
            }
          : { ok: false, text: result.error ?? "Er ging iets mis." }
      );
    } catch {
      setState({ ok: false, text: "Er ging iets mis. Probeer het opnieuw." });
    } finally {
      setLoading(false);
    }
  }

  if (state?.ok) {
    return <p className="rounded-lg bg-[var(--pay-soft)] px-3 py-2 text-xs leading-relaxed text-ink">{state.text}</p>;
  }
  return (
    <p className="text-xs text-inkSoft">
      Weet je je wachtwoord niet meer?{" "}
      <button
        type="button"
        onClick={send}
        disabled={loading}
        className="font-semibold text-[var(--btn-pay-bg)] underline-offset-2 hover:underline disabled:opacity-60"
      >
        {loading ? "Bezig..." : "Stuur me een resetlink"}
      </button>
      {state && <span className="ml-1 text-red-600">{state.text}</span>}
    </p>
  );
}
