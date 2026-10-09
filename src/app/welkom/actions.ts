"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { TERMS_VERSION } from "@/lib/terms";
import { invitedUser } from "./invite";

// "Account activeren": the password chosen, the voorwaarden accepted, the
// address confirmed (the link came to it). The form logs in right after.
export async function activateInviteAction(input: {
  email: string;
  token: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}): Promise<{ error: string | null }> {
  const parsed = resetPasswordSchema.safeParse({
    token: input.token,
    password: input.password,
    confirmPassword: input.confirmPassword,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  if (input.acceptedTerms !== true) return { error: "Ga akkoord met de voorwaarden en het privacybeleid." };
  const user = await invitedUser(input.email, parsed.data.token);
  if (!user) return { error: "Deze link is ongeldig of verlopen. Vraag Nugevonden om een nieuwe." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      passwordResetTokenHash: null,
      passwordResetTokenExpires: null,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
    },
  });
  return { error: null };
}
