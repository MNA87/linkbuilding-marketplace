"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Check } from "lucide-react";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { PasswordField, PasswordRules } from "@/components/PasswordField";
import { activateInviteAction } from "./actions";

// Password twice and the voorwaarden; then logged in, on the dashboard.
export default function WelcomeForm({ email, token }: { email: string; token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
    if (!acceptedTerms) return setError("Ga akkoord met de voorwaarden en het privacybeleid.");

    setLoading(true);
    try {
      const result = await activateInviteAction({ email, token, password, confirmPassword, acceptedTerms });
      if (result.error) return setError(result.error);
      const login = await signIn("credentials", { email, password, remember: "1", redirect: false });
      router.push(login?.error ? "/login" : "/dashboard");
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <PasswordField
        label="Wachtwoord"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      >
        {password && <PasswordRules value={password} />}
      </PasswordField>
      <PasswordField
        label="Herhaal wachtwoord"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--btn-pay-bg)] peer-focus-visible:ring-offset-1 ${
            acceptedTerms ? "bg-[var(--btn-pay-bg)] text-white" : "border-[1.5px] border-gray-400 bg-white"
          }`}
        >
          {acceptedTerms && <Check size={13} strokeWidth={3} />}
        </span>
        <span>
          Ik ga akkoord met de{" "}
          <a href="/voorwaarden" target="_blank" className="text-[var(--btn-pay-bg)] underline underline-offset-2">
            voorwaarden
          </a>{" "}
          en het{" "}
          <a href="/privacy" target="_blank" className="text-[var(--btn-pay-bg)] underline underline-offset-2">
            privacybeleid
          </a>
        </span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="btn-pay w-full rounded-lg py-3 text-[15px] font-semibold transition disabled:opacity-60"
      >
        {loading ? "Bezig..." : "Account activeren"}
      </button>
    </form>
  );
}
