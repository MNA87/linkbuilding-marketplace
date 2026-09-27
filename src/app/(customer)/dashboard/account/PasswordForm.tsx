"use client";

import { useState } from "react";
import { changePasswordAction } from "./actions";
import { Card, Field, Message, SubmitButton } from "./ui";
import ForgotPassword from "./ForgotPassword";

const EMPTY = { currentPassword: "", password: "", confirmPassword: "" };

export default function PasswordForm() {
  const [values, setValues] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const bind = (name: keyof typeof EMPTY) => ({
    name,
    type: "password",
    required: true,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setMessage(null);
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const result = await changePasswordAction(values);
      if (result.success) {
        setValues(EMPTY);
        setMessage({ ok: true, text: "Je wachtwoord is gewijzigd." });
      } else {
        setMessage({ ok: false, text: result.error ?? "Wijzigen mislukt." });
      }
    } catch {
      setMessage({ ok: false, text: "Wijzigen mislukt. Probeer het opnieuw." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card
        title="Wachtwoord wijzigen"
        description="Kies een lang wachtwoord dat je nergens anders gebruikt."
        footer={
          <>
            <Message message={message} />
            <SubmitButton loading={loading}>Wachtwoord wijzigen</SubmitButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Field label="Huidig wachtwoord" autoComplete="current-password" {...bind("currentPassword")} />
            <ForgotPassword />
          </div>
          <Field
            label="Nieuw wachtwoord"
            autoComplete="new-password"
            hint="Minstens 10 tekens, met een hoofdletter, kleine letter en cijfer"
            {...bind("password")}
          />
          <Field label="Herhaal nieuw wachtwoord" autoComplete="new-password" {...bind("confirmPassword")} />
        </div>
      </Card>
    </form>
  );
}
