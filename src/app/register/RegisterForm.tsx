"use client";

import { useState } from "react";
import { Check, Mail } from "lucide-react";
import { REFERRAL_SOURCES, registerSchema } from "@/lib/validations/auth";
import { COUNTRIES } from "@/lib/countries";
import { PasswordField, PasswordRules } from "@/components/PasswordField";
import { inputClass } from "@/app/(customer)/dashboard/account/ui";
import { registerAction, resendVerificationAction } from "./actions";

function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input {...input} className={inputClass} />
      {hint && <span className="mt-1 block text-xs text-inkSoft">{hint}</span>}
    </label>
  );
}

function Select({
  label,
  children,
  ...select
}: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {/* A select counts as read-only in CSS, so not inputClass's grey. */}
      <select {...select} className={inputClass.replace(/\S*read-only:\S+/g, "")}>
        {children}
      </select>
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--btn-pay-bg)] peer-focus-visible:ring-offset-1 ${
          checked ? "bg-[var(--btn-pay-bg)] text-white" : "border-[1.5px] border-gray-400 bg-white"
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  );
}

export default function RegisterForm() {
  // Publisher self-registration is off for now — the platform only sells the
  // operator's own sites, so every signup is a customer.
  const accountType = "customer" as const;
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    phone: "",
    country: "NL",
    referralSource: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  const bind = (name: keyof typeof values) => ({
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { accountType, ...values, acceptedTerms };
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(input)) formData.set(key, String(value));
      const result = await registerAction({ error: null, success: false }, formData);
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis, probeer het opnieuw.");
        return;
      }
      // No auto-login — the account can't be used until the verification
      // link in the email is clicked.
      setRegisteredEmail(parsed.data.email);
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className="text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
          <Mail size={28} />
        </span>
        <h1 className="font-serif text-[28px] tracking-tight text-ink">Check je e-mail</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">
          We hebben een link gestuurd naar <strong className="font-semibold">{registeredEmail}</strong>.
          <br />
          Klik erop om verder te gaan.
        </p>
        <p className="mt-5 text-[13px] text-inkSoft">
          {resent ?? (
            <>
              Niets ontvangen? Kijk in je spam, of{" "}
              <button
                type="button"
                onClick={async () =>
                  setResent(
                    (await resendVerificationAction(registeredEmail).catch(() => null))?.message ?? "Er ging iets mis."
                  )
                }
                className="font-semibold text-[var(--btn-pay-bg)] hover:underline"
              >
                stuur de link opnieuw
              </button>
              .
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="mb-6 font-serif text-[30px] tracking-tight text-ink">Account aanmaken</h1>

      <div className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Voornaam" required autoComplete="given-name" {...bind("firstName")} />
          <Field label="Achternaam" required autoComplete="family-name" {...bind("lastName")} />
        </div>
        <Field
          label="E-mailadres"
          type="email"
          required
          autoComplete="email"
          placeholder="naam@bedrijf.nl"
          {...bind("email")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordField label="Wachtwoord" required autoComplete="new-password" {...bind("password")} />
          <PasswordField
            label="Bevestig wachtwoord"
            required
            autoComplete="new-password"
            {...bind("confirmPassword")}
          />
        </div>
        {values.password && <PasswordRules value={values.password} />}
        <Field label="Bedrijfsnaam" required autoComplete="organization" {...bind("companyName")} />
        <Field label="Telefoon" type="tel" required autoComplete="tel" placeholder="06 12345678" {...bind("phone")} />
        <Select label="Land" required {...bind("country")}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Waar ken je ons van?" required {...bind("referralSource")}>
          <option value="" disabled>
            Kies een optie
          </option>
          {REFERRAL_SOURCES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>

        <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms}>
          Ik ga akkoord met de{" "}
          <a href="/voorwaarden" target="_blank" className="text-[var(--btn-pay-bg)] underline underline-offset-2">
            voorwaarden
          </a>{" "}
          en het{" "}
          <a href="/privacy" target="_blank" className="text-[var(--btn-pay-bg)] underline underline-offset-2">
            privacybeleid
          </a>
        </Checkbox>

        <button
          type="submit"
          disabled={loading}
          className="btn-pay w-full rounded-lg py-3 text-[15px] font-semibold transition disabled:opacity-60"
        >
          {loading ? "Bezig..." : "Account aanmaken"}
        </button>
        <p className="text-center text-sm text-inkSoft">
          Heb je al een account?{" "}
          <a href="/login" className="font-semibold text-[var(--btn-pay-bg)] hover:underline">
            Inloggen
          </a>
        </p>
      </div>
    </form>
  );
}
