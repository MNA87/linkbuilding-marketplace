import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AuthCard, { AuthNotice, authIntro, authLink, authTitle } from "@/components/AuthCard";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Inloggen" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <AuthCard>
      <h1 className={authTitle}>Inloggen</h1>
      <p className={authIntro}>Log in op je Nugevonden-account.</p>
      {/* Back from Nieuw wachtwoord (src/app/reset-password). */}
      {reset === "success" && (
        <div className="mt-6">
          <AuthNotice>Je nieuwe wachtwoord is opgeslagen. Log er nu mee in.</AuthNotice>
        </div>
      )}
      <LoginForm />
      <p className="mt-6 text-center text-sm text-inkSoft">
        Nog geen account?{" "}
        <a href="/register" className={authLink}>
          Account aanmaken
        </a>
      </p>
    </AuthCard>
  );
}
