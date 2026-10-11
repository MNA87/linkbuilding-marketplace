"use client";

import { useState } from "react";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { AuthError, AuthNotice, authButton } from "@/components/AuthCard";
import { Field } from "@/app/(customer)/dashboard/account/ui";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = await forgotPasswordAction(parsed.data);
      setMessage(result.message);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (message) {
    return (
      <div className="mt-6">
        <AuthNotice>{message}</AuthNotice>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
      {error && <AuthError>{error}</AuthError>}
      <Field
        id="email"
        label="E-mailadres"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={loading} className={authButton}>
        {loading ? "Bezig..." : "Stuur de link"}
      </button>
    </form>
  );
}
