import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

// Mails a link to set a new password (/reset-password), valid for 15
// minutes; only its hash is kept. "account_exists": someone tried to sign
// up with an address we already know (a customer who orders by mail, say),
// so the link to choose their password stays valid for a day.
export async function sendPasswordReset(
  user: { id: string; email: string },
  kind: "password_reset" | "account_exists" = "password_reset"
) {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: createHash("sha256").update(rawToken).digest("hex"),
      passwordResetTokenExpires: new Date(Date.now() + (kind === "account_exists" ? 24 * 60 : 15) * 60_000),
    },
  });
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendPasswordResetEmail(
    user.email,
    `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`,
    kind
  );
}
