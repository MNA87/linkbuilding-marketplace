import type { Metadata } from "next";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

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
    <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-lg p-8">
        <h1 className="font-serif text-2xl text-ink mb-1">E-mailadres bevestigen</h1>
        <p className={`text-sm mt-4 ${result.ok ? "text-inkSoft" : "text-red-600"}`}>{result.message}</p>
        {result.ok && (
          <a href="/login" className="inline-block mt-4 text-sm text-brand hover:underline">
            Naar inloggen
          </a>
        )}
      </div>
    </div>
  );
}
