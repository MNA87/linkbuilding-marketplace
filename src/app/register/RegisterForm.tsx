"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerSchema } from "@/lib/validations/auth";
import { registerAction } from "./actions";

export default function RegisterForm() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"customer" | "supplier">("customer");
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.set("accountType", accountType);
    formData.set("companyName", companyName);
    formData.set("name", name);
    formData.set("email", email);
    formData.set("password", password);
    formData.set("confirmPassword", confirmPassword);

    const result = await registerAction({ error: null, success: false }, formData);

    if (!result.success) {
      setError(result.error ?? "Er ging iets mis, probeer het opnieuw.");
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (signInResult?.error) {
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm text-ink mb-1">Ik ben een</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAccountType("customer")}
            className={`rounded-md border px-3 py-2 text-sm ${
              accountType === "customer" ? "border-brand bg-brandSoft text-brand" : "border-line text-inkSoft"
            }`}
          >
            Klant (links inkopen)
          </button>
          <button
            type="button"
            onClick={() => setAccountType("supplier")}
            className={`rounded-md border px-3 py-2 text-sm ${
              accountType === "supplier" ? "border-brand bg-brandSoft text-brand" : "border-line text-inkSoft"
            }`}
          >
            Publisher (websites aanbieden)
          </button>
        </div>
      </div>

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

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand text-white rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {loading ? "Bezig..." : "Account aanmaken"}
      </button>
    </form>
  );
}
