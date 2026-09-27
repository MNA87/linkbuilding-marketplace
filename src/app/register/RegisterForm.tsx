"use client";

import { useState } from "react";
import { Check, Mail } from "lucide-react";
import { registerSchema } from "@/lib/validations/auth";
import { PasswordField, PasswordRules } from "@/components/PasswordField";
import { inputClass } from "@/app/(customer)/dashboard/account/ui";
import { registerAction, resendVerificationAction } from "./actions";

function Field({ label, hint, ...input }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input {...input} className={inputClass} />
      {hint && <span className="mt-1 block text-xs text-inkSoft">{hint}</span>}
    </label>
  );
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
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
  const [values, setValues] = useState({ name: "", email: "", phone: "", password: "", companyName: "" });
  const [isBusiness, setIsBusiness] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  const bind = (name: keyof typeof values) => ({
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { accountType, ...values, isBusiness, acceptedTerms };
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
          Klik erop om je account te activeren.
        </p>
        <p className="mt-5 text-[13px] text-inkSoft">
          {resent ?? (
            <>
              Niets ontvangen? Kijk in je spam, of{" "}
              <button
                type="button"
                onClick={async () => setResent((await resendVerificationAction(registeredEmail).catch(() => null))?.message ?? "Er ging iets mis.")}
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
      <h1 className="font-serif text-[30px] tracking-tight text-ink">Account aanmaken</h1>
      <p className="mb-6 mt-1.5 text-sm text-inkSoft">Gratis en vrijblijvend — binnen een minuut klaar.</p>

      <div className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Field label="Naam" required autoComplete="name" placeholder="Voor- en achternaam" {...bind("name")} />
        <Field label="E-mailadres" type="email" required autoComplete="email" placeholder="naam@bedrijf.nl" {...bind("email")} />
        <Field
          label="Telefoonnummer"
          type="tel"
          autoComplete="tel"
          placeholder="06 12345678"
          hint="Optioneel — handig als we je snel willen bereiken over een order"
          {...bind("phone")}
        />
        <PasswordField label="Wachtwoord" required autoComplete="new-password" {...bind("password")}>
          <PasswordRules value={values.password} />
        </PasswordField>

        <div className="border-t border-line pt-4">
          <Checkbox checked={isBusiness} onChange={setIsBusiness}>
            Ik bestel zakelijk <span className="text-inkSoft">— de factuur komt op naam van je bedrijf</span>
          </Checkbox>
        </div>
        {isBusiness && <Field label="Bedrijfsnaam" required autoComplete="organization" {...bind("companyName")} />}

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
