import type { Metadata } from "next";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmailChangedEmail } from "@/lib/email";

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

  await sendEmailChangedEmail(oldEmail, newEmail);
  return { ok: true, message: `Je e-mailadres is gewijzigd. Voortaan log je in met ${newEmail}.` };
}

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = token
    ? await confirm(token)
    : { ok: false, message: "Ongeldige link — controleer of je de volledige link uit de e-mail hebt gebruikt." };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-lg p-8">
        <h1 className="font-serif text-2xl text-ink mb-1">Nieuw e-mailadres</h1>
        <p className={`text-sm mt-4 ${result.ok ? "text-inkSoft" : "text-red-600"}`}>{result.message}</p>
        <a href="/dashboard/account?tab=inloggen" className="inline-block mt-4 text-sm text-brand hover:underline">
          Naar je account
        </a>
      </div>
    </div>
  );
}
