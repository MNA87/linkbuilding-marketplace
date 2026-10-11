"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { PasswordField, PasswordRules } from "@/components/PasswordField";
import { AuthError, authButton } from "@/components/AuthCard";
import { resetPasswordAction } from "./actions";

export default function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordAction({ email, token, password, confirmPassword });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      router.push("/login?reset=success");
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
      {error && <AuthError>{error}</AuthError>}
      <PasswordField
        id="password"
        label="Nieuw wachtwoord"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      >
        {password && <PasswordRules value={password} />}
      </PasswordField>
      <PasswordField
        id="confirmPassword"
        label="Herhaal wachtwoord"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <button type="submit" disabled={loading} className={authButton}>
        {loading ? "Bezig..." : "Wachtwoord opslaan"}
      </button>
    </form>
  );
}
