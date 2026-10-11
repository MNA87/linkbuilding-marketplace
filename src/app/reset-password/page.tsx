import type { Metadata } from "next";
import AuthCard, { authIntro, authLink, authTitle } from "@/components/AuthCard";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Nieuw wachtwoord" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;

  if (!token || !email) {
    return (
      <AuthCard>
        <h1 className={authTitle}>Deze link werkt niet</h1>
        <p className={authIntro}>
          Vraag een nieuwe aan via{" "}
          <a href="/forgot-password" className={authLink}>
            wachtwoord vergeten
          </a>
          .
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className={authTitle}>Nieuw wachtwoord</h1>
      <p className={authIntro}>Kies een nieuw wachtwoord voor je account.</p>
      <ResetPasswordForm token={token} email={email} />
    </AuthCard>
  );
}
