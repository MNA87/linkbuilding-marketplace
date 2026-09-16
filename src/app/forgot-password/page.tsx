import type { Metadata } from "next";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Wachtwoord vergeten" };

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-lg p-8">
        <h1 className="font-serif text-2xl text-ink mb-1">Wachtwoord vergeten</h1>
        <p className="text-sm text-inkSoft mb-6">
          Vul je e-mailadres in en we sturen je een link om een nieuw wachtwoord in te stellen.
        </p>
        <ForgotPasswordForm />
        <p className="text-sm text-inkSoft mt-6">
          <a href="/login" className="text-brand hover:underline">
            Terug naar inloggen
          </a>
        </p>
      </div>
    </div>
  );
}
