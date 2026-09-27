"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelEmailChangeAction, requestEmailChangeAction, resendEmailChangeAction } from "./actions";
import { Card, Field, Message, SubmitButton } from "./ui";
import ForgotPassword from "./ForgotPassword";
import { PasswordField } from "./PasswordField";

// Changing the login address: a link goes to the new address, and only
// once that's opened does it change (see /confirm-email).
export default function EmailForm({ email, pendingEmail }: { email: string; pendingEmail: string | null }) {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: () => Promise<{ error: string | null; success: boolean }>, done: string) {
    setLoading(true);
    setMessage(null);
    try {
      const result = await action();
      if (result.success) {
        setNewEmail("");
        setCurrentPassword("");
        setMessage(done ? { ok: true, text: done } : null);
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error ?? "Er ging iets mis." });
      }
    } catch {
      setMessage({ ok: false, text: "Er ging iets mis. Probeer het opnieuw." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => requestEmailChangeAction({ newEmail, currentPassword }), "");
      }}
    >
      <Card
        title="E-mailadres"
        description="Hiermee log je in en hierop krijg je onze e-mails."
        footer={
          <>
            <Message message={message} />
            <SubmitButton loading={loading}>Bevestigingslink sturen</SubmitButton>
          </>
        }
      >
        {pendingEmail && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            <strong className="font-semibold">Bijna klaar:</strong> we hebben een link gestuurd naar{" "}
            <strong className="font-semibold">{pendingEmail}</strong>. Klik erop om je nieuwe e-mailadres te
            bevestigen. Tot die tijd log je in met je huidige adres.
            <span className="mt-1.5 flex gap-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => run(resendEmailChangeAction, "De link is opnieuw gestuurd.")}
                className="font-semibold underline underline-offset-2 hover:no-underline"
              >
                Opnieuw sturen
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => run(cancelEmailChangeAction, "")}
                className="font-semibold underline underline-offset-2 hover:no-underline"
              >
                Annuleren
              </button>
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Huidig e-mailadres" value={email} readOnly tabIndex={-1} />
          <Field
            label="Nieuw e-mailadres"
            type="email"
            required
            autoComplete="email"
            placeholder="naam@bedrijf.nl"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setMessage(null);
            }}
          />
          <div className="sm:col-span-2">
            <PasswordField
              label="Huidig wachtwoord"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setMessage(null);
              }}
            >
              <p className="mt-1 text-xs text-inkSoft">
                Ter controle dat jij het bent. We sturen een link naar je nieuwe adres om het te bevestigen.
              </p>
              <div className="mt-1">
                <ForgotPassword />
              </div>
            </PasswordField>
          </div>
        </div>
      </Card>
    </form>
  );
}
