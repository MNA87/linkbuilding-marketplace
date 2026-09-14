"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { loginSchema } from "@/lib/validations/auth";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("E-mailadres of wachtwoord onjuist.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
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
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm text-ink" htmlFor="password">
            Wachtwoord
          </label>
          <a href="/forgot-password" className="text-xs text-brand hover:underline">
            Wachtwoord vergeten?
          </a>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand text-white rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : "Inloggen"}
      </button>
    </form>
  );
}
