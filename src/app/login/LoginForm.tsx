"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { loginSchema } from "@/lib/validations/auth";
import { AuthError, authButton, authLink } from "@/components/AuthCard";
import { Field } from "@/app/(customer)/dashboard/account/ui";

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
  // "Onthoud mij": 30 days logged in instead of 1 (an admin always 1), and
  // with tweestapsverificatie no code on this device for 30 days.
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Scroll a fresh error into view — on a phone/tablet the banner sits above
  // the fields, behind the on-screen keyboard, so it's easy to miss.
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Read the values straight from the form, not from React state: on iOS
    // Safari, autofilled (and sometimes typed) values don't reliably reach a
    // controlled input's state, which left the fields blank on submit — the
    // login then silently did nothing. On the password step we also stash the
    // values so the second step (the 2FA code) can reuse them.
    const fd = new FormData(e.currentTarget);
    let em = email;
    let pw = password;
    if (step === "password") {
      em = String(fd.get("email") ?? "").trim();
      pw = String(fd.get("password") ?? "");
      setEmail(em);
      setPassword(pw);
    }
    const codeValue = step === "code" ? String(fd.get("code") ?? code) : "";

    const parsed = loginSchema.safeParse({ email: em, password: pw });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        code: codeValue,
        remember: remember ? "1" : "0",
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

  const rememberBox = (label: string) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={remember}
        onChange={(e) => setRemember(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded accent-[var(--btn-pay-bg)]"
      />
      {label}
    </label>
  );

  if (step === "code") {
    return (
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <div ref={errorRef}>
            <AuthError>{error}</AuthError>
          </div>
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
          name="code"
          aria-label={backup ? "Reservecode" : "Code uit je app"}
          value={code}
          onChange={(e) =>
            setCode(backup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          placeholder={backup ? "XXXX-XXXX" : "123456"}
          className="w-full rounded-lg border border-line px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]"
        />
        {rememberBox("Onthoud dit apparaat 30 dagen")}
        <button
          type="submit"
          disabled={loading || (backup ? code.trim().length < 8 : code.length !== 6)}
          className={authButton}
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
            className={authLink}
          >
            {backup ? "Code uit de app gebruiken" : "Telefoon kwijt? Gebruik een reservecode"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
      {error && <AuthError>{error}</AuthError>}
      <Field
        id="email"
        name="email"
        label="E-mailadres"
        type="email"
        autoComplete="email"
        required
        defaultValue={email}
      />
      {/* Bewust een gewoon wachtwoordveld (geen toon/verberg-oog): het wisselen
          van het veldtype liet op iPad-Safari het wachtwoord wissen en werkte
          daar niet. Zo gedraagt dit veld zich net als het e-mailveld. */}
      <Field
        id="password"
        name="password"
        label="Wachtwoord"
        type="password"
        autoComplete="current-password"
        required
        defaultValue={password}
      />
      <div className="flex items-center justify-between gap-3">
        {rememberBox("Onthoud mij")}
        <a href="/forgot-password" className={`text-sm ${authLink}`}>
          Wachtwoord vergeten?
        </a>
      </div>
      <button type="submit" disabled={loading} className={authButton}>
        {loading ? "Bezig..." : "Inloggen"}
      </button>
    </form>
  );
}
