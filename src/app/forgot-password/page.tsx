import type { Metadata } from "next";
import AuthCard, { authIntro, authLink, authTitle } from "@/components/AuthCard";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Wachtwoord vergeten" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard>
      <h1 className={authTitle}>Wachtwoord vergeten</h1>
      <p className={authIntro}>Vul je e-mailadres in. We sturen je een link om een nieuw wachtwoord te kiezen.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-inkSoft">
        <a href="/login" className={authLink}>
          Terug naar inloggen
        </a>
      </p>
    </AuthCard>
  );
}
