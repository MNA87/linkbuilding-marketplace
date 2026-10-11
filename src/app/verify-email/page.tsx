import type { Metadata } from "next";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import AuthCard, { authButton, authIntro, authTitle } from "@/components/AuthCard";

export const metadata: Metadata = { title: "E-mailadres bevestigen" };

async function verify(token: string, email: string): Promise<{ ok: boolean; message: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  const tokenHash = createHash("sha256").update(token).digest("hex");

  if (user?.emailVerifiedAt) {
    return { ok: true, message: "Je e-mailadres is al bevestigd. Je kunt inloggen." };
  }

  if (
    !user ||
    !user.emailVerificationTokenHash ||
    !user.emailVerificationTokenExpires ||
    user.emailVerificationTokenHash !== tokenHash ||
    user.emailVerificationTokenExpires < new Date()
  ) {
    return { ok: false, message: "Deze link is ongeldig of verlopen. Registreer opnieuw om een nieuwe te krijgen." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationTokenExpires: null },
  });

  return { ok: true, message: "Je e-mailadres is bevestigd. Je kunt nu inloggen." };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;

  const result =
    token && email
      ? await verify(token, email)
      : { ok: false, message: "Ongeldige link — controleer of je de volledige link uit de e-mail hebt gebruikt." };

  return (
    <AuthCard>
      <h1 className={authTitle}>{result.ok ? "E-mailadres bevestigd" : "Deze link werkt niet"}</h1>
      <p className={authIntro}>{result.message}</p>
      {result.ok && (
        <a href="/login" className={`mt-6 ${authButton}`}>
          Naar inloggen
        </a>
      )}
    </AuthCard>
  );
}
