"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { changePasswordAction } from "./actions";
import { Card, Message, SubmitButton } from "./ui";
import { PasswordField, PasswordRules } from "@/components/PasswordField";
import ForgotPassword from "./ForgotPassword";

const EMPTY = { currentPassword: "", password: "", confirmPassword: "" };

export default function PasswordForm() {
  const [values, setValues] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const bind = (name: keyof typeof EMPTY) => ({
    name,
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
        setMessage({ ok: true, text: "Je wachtwoord is gewijzigd. Op andere apparaten ben je uitgelogd." });
      } else {
        setMessage({ ok: false, text: result.error ?? "Wijzigen mislukt." });
      }
    } catch {
      setMessage({ ok: false, text: "Wijzigen mislukt. Probeer het opnieuw." });
    } finally {
      setLoading(false);
    }
  }

  const matches = values.confirmPassword !== "" && values.confirmPassword === values.password;

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
        <div className="space-y-4">
          <PasswordField label="Huidig wachtwoord" autoComplete="current-password" {...bind("currentPassword")}>
            <div className="mt-1.5">
              <ForgotPassword />
            </div>
          </PasswordField>
          <PasswordField label="Nieuw wachtwoord" autoComplete="new-password" {...bind("password")}>
            <PasswordRules value={values.password} />
          </PasswordField>
          <PasswordField label="Herhaal nieuw wachtwoord" autoComplete="new-password" {...bind("confirmPassword")}>
            {matches && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
                <Check size={13} strokeWidth={3} /> Komt overeen
              </p>
            )}
          </PasswordField>
        </div>
      </Card>
    </form>
  );
}
