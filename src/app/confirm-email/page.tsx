import type { Metadata } from "next";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmailChangedEmail } from "@/lib/email";
import { signOutEverywhere } from "@/lib/sessionVersion";
import AuthCard, { authButton, authIntro, authTitle } from "@/components/AuthCard";

export const metadata: Metadata = { title: "Nieuw e-mailadres bevestigen" };

// Opened from the link sent to a new e-mail address (Account → Inloggen):
// from now on the customer logs in with it, and the old address hears so.
async function confirm(token: string): Promise<{ ok: boolean; message: string }> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findUnique({ where: { pendingEmailTokenHash: tokenHash } });

  if (!user?.pendingEmail || !user.pendingEmailTokenExpires || user.pendingEmailTokenExpires < new Date()) {
    return {
      ok: false,
      message: "Deze link is ongeldig of verlopen. Vraag onder Account → Inloggen een nieuwe aan.",
    };
  }

  const oldEmail = user.email;
  const newEmail = user.pendingEmail;
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        emailVerifiedAt: new Date(),
        pendingEmail: null,
        pendingEmailTokenHash: null,
        pendingEmailTokenExpires: null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, message: "Dit e-mailadres is inmiddels in gebruik bij een ander account." };
    }
    throw err;
  }

  // Logged out everywhere: from now on it's the new address that logs in.
  await signOutEverywhere(user.id);
  await sendEmailChangedEmail(oldEmail, newEmail);
  return { ok: true, message: `Je e-mailadres is gewijzigd. Log opnieuw in met ${newEmail}.` };
}

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = token
    ? await confirm(token)
    : { ok: false, message: "Ongeldige link — controleer of je de volledige link uit de e-mail hebt gebruikt." };

  return (
    <AuthCard>
      <h1 className={authTitle}>{result.ok ? "E-mailadres gewijzigd" : "Deze link werkt niet"}</h1>
      <p className={authIntro}>{result.message}</p>
      <a href={result.ok ? "/login" : "/dashboard/account?tab=inloggen"} className={`mt-6 ${authButton}`}>
        {result.ok ? "Naar inloggen" : "Naar je account"}
      </a>
    </AuthCard>
  );
}
