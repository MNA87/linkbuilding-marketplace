"use client";

import { useState } from "react";
import { registerSchema } from "@/lib/validations/auth";
import { registerAction } from "./actions";

export default function RegisterForm() {
  // Publisher self-registration is off for now — the platform only sells the
  // operator's own sites, so every signup is a customer.
  const accountType = "customer" as const;
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse({
      accountType,
      companyName,
      name,
      email,
      password,
      confirmPassword,
      acceptedTerms,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("accountType", accountType);
      formData.set("companyName", companyName);
      formData.set("name", name);
      formData.set("email", email);
      formData.set("password", password);
      formData.set("confirmPassword", confirmPassword);
      formData.set("acceptedTerms", String(acceptedTerms));

      const result = await registerAction({ error: null, success: false }, formData);

      if (!result.success) {
        setError(result.error ?? "Er ging iets mis, probeer het opnieuw.");
        return;
      }

      // No auto-login — the account can't be used until the verification
      // link in the email is clicked.
      setRegisteredEmail(email);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className="text-sm text-ink bg-brandSoft/50 border border-line rounded-md px-4 py-4 space-y-2">
        <p className="font-medium">Bijna klaar — bevestig je e-mailadres</p>
        <p className="text-inkSoft">
          We hebben een bevestigingslink gestuurd naar <span className="text-ink">{registeredEmail}</span>. Klik
          op die link om je account te activeren, daarna kun je inloggen.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="companyName">
          Bedrijfsnaam
        </label>
        <input
          id="companyName"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="name">
          Jouw naam
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="email">
          E-mailadres
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="password">
          Wachtwoord
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="text-xs text-inkSoft mt-1">Minimaal 10 tekens, met hoofdletter, kleine letter en cijfer.</p>
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="confirmPassword">
          Bevestig wachtwoord
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-inkSoft">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Ik ga akkoord met de{" "}
          <a href="/voorwaarden" target="_blank" className="text-brand hover:underline">
            voorwaarden
          </a>{" "}
          en het{" "}
          <a href="/privacy" target="_blank" className="text-brand hover:underline">
            privacybeleid
          </a>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={loading || !acceptedTerms}
        className="w-full btn-primary rounded-md py-2 text-sm font-medium disabled:opacity-60 transition"
      >
        {loading ? "Bezig..." : "Account aanmaken"}
      </button>
    </form>
  );
}
