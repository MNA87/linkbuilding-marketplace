"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { loginSchema } from "@/lib/validations/auth";

// As thrown by authorize() in src/lib/auth.ts (not imported: that file is server-only).
const CODE_NEEDED = "CODE_NODIG";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Tweestapsverificatie: after the password, the code from the app (or a
  // reservecode when the phone is lost).
  const [step, setStep] = useState<"password" | "code">("password");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
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
        code: step === "code" ? code : "",
        redirect: false,
      });

      if (result?.error === CODE_NEEDED) {
        setStep("code");
        return;
      }
      if (result?.error) {
        // NextAuth reports a plain "CredentialsSignin" when authorize()
        // returns null (bad credentials); anything else is a message we
        // threw ourselves (e.g. unverified email) and should show as-is.
        setError(result.error === "CredentialsSignin" ? "E-mailadres of wachtwoord onjuist." : result.error);
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

  if (step === "code") {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}
        <div>
          <p className="text-sm font-semibold text-ink">Nog één stap</p>
          <p className="mt-1 text-sm text-inkSoft">
            {backup
              ? "Vul een van je reservecodes in. Elke code werkt één keer."
              : "Open je authenticator-app (bijv. Google Authenticator) en vul de code van 6 cijfers in."}
          </p>
        </div>
        <input
          key={backup ? "backup" : "app"}
          autoFocus
          aria-label={backup ? "Reservecode" : "Code uit je app"}
          value={code}
          onChange={(e) =>
            setCode(backup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          placeholder={backup ? "XXXX-XXXX" : "123456"}
          className="w-full rounded-md border border-line px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]"
        />
        <button
          type="submit"
          disabled={loading || (backup ? code.trim().length < 8 : code.length !== 6)}
          className="w-full btn-pay rounded-md py-2.5 text-sm font-semibold disabled:opacity-60 transition"
        >
          {loading ? "Bezig..." : "Inloggen"}
        </button>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep("password");
              setCode("");
              setError(null);
            }}
            className="text-inkSoft hover:text-ink"
          >
            ← Terug
          </button>
          <button
            type="button"
            onClick={() => {
              setBackup((b) => !b);
              setCode("");
              setError(null);
            }}
            className="text-[var(--btn-pay-bg)] hover:underline"
          >
            {backup ? "Code uit de app gebruiken" : "Telefoon kwijt? Gebruik een reservecode"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
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
        className="w-full btn-pay rounded-md py-2.5 text-sm font-semibold disabled:opacity-60 transition"
      >
        {loading ? "Bezig..." : "Inloggen"}
      </button>
    </form>
  );
}
