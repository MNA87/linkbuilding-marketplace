"use server";

import { randomBytes, createHash } from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { isRateLimited } from "@/lib/rateLimit";

const GENERIC_MESSAGE =
  "Als er een account bestaat met dit e-mailadres, hebben we een e-mail gestuurd met instructies.";

export async function forgotPasswordAction(input: unknown): Promise<{ message: string }> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }

  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`forgot-password:${ip}`, 5, 60_000)) {
    // Same generic message — don't reveal that rate limiting kicked in.
    return { message: GENERIC_MESSAGE };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always behave identically whether or not the account exists, so this
  // endpoint can't be used to enumerate registered email addresses.
  if (user && user.status === "active") {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExpires: new Date(Date.now() + 15 * 60_000),
      },
    });

    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  return { message: GENERIC_MESSAGE };
}
