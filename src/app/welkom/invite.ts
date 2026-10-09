import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// The account a /welkom link is for: the invitation (or reset) token still
// valid. Null if the link is wrong or has expired.
export async function invitedUser(email: string, token: string) {
  const user = await prisma.user.findUnique({ where: { email: String(email) } });
  const tokenHash = createHash("sha256").update(String(token)).digest("hex");
  if (
    !user ||
    user.status !== "active" ||
    user.passwordResetTokenHash !== tokenHash ||
    !user.passwordResetTokenExpires ||
    user.passwordResetTokenExpires < new Date()
  ) {
    return null;
  }
  return user;
}
