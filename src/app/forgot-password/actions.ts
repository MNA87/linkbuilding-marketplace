"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { sendPasswordReset } from "@/lib/passwordReset";
import { isRateLimited } from "@/lib/rateLimit";

const GENERIC_MESSAGE =
  "Als er een account bestaat met dit e-mailadres, hebben we een e-mail gestuurd met instructies.";

export async function forgotPasswordAction(input: unknown): Promise<{ message: string }> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`forgot-password:${ip}`, 5, 60_000)) {
    // Same generic message — don't reveal that rate limiting kicked in.
    return { message: GENERIC_MESSAGE };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always behave identically whether or not the account exists, so this
  // endpoint can't be used to enumerate registered email addresses. At most
  // one link per 10 minutes to an address, whoever asks: the one sent
  // before still works.
  const sentRecently = user?.passwordResetSentAt && Date.now() - user.passwordResetSentAt.getTime() < 10 * 60_000;
  if (user && user.status === "active" && !sentRecently) {
    await sendPasswordReset(user);
  }

  return { message: GENERIC_MESSAGE };
}
