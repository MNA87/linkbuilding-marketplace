import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

// Mails a link to set a new password (/reset-password), valid for 15
// minutes; only its hash is kept.
export async function sendPasswordReset(user: { id: string; email: string }) {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: createHash("sha256").update(rawToken).digest("hex"),
      passwordResetTokenExpires: new Date(Date.now() + 15 * 60_000),
    },
  });
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendPasswordResetEmail(user.email, `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`);
}
