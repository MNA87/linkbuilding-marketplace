"use server";

import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";

export type ResetPasswordState = { error: string | null; success: boolean };

export async function resetPasswordAction(
  input: { email: string } & Record<string, unknown>
): Promise<ResetPasswordState> {
  const { email, ...rest } = input;
  const parsed = resetPasswordSchema.safeParse(rest);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

  if (
    !user ||
    user.status !== "active" ||
    !user.passwordResetTokenHash ||
    !user.passwordResetTokenExpires ||
    user.passwordResetTokenHash !== tokenHash ||
    user.passwordResetTokenExpires < new Date()
  ) {
    return { error: "Deze resetlink is ongeldig of verlopen. Vraag een nieuwe aan.", success: false };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpires: null,
    },
  });

  return { error: null, success: true };
}
