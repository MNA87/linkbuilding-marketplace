"use server";

import { prisma } from "@/lib/prisma";
import { readNotMeToken } from "@/lib/loginSecurity";
import { signOutEverywhere } from "@/lib/sessionVersion";
import { sendPasswordReset } from "@/lib/passwordReset";

// "Dit was ik niet" from the mail after an admin login: the account is
// signed out on every device, and a link to choose a new password goes to its
// address. A button press, not the link itself, so a mail program opening
// links to check them can't set it off.
export async function notMeAction(token: string): Promise<{ ok: boolean; message: string }> {
  const userId = readNotMeToken(String(token));
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
    : null;
  if (!user)
    return {
      ok: false,
      message: "Deze link is ongeldig of verlopen. Kies via Inloggen → Wachtwoord vergeten een nieuw wachtwoord.",
    };
  await signOutEverywhere(user.id);
  await sendPasswordReset(user);
  return {
    ok: true,
    message: "Je account is op alle apparaten uitgelogd. We hebben je een mail gestuurd om een nieuw wachtwoord te kiezen.",
  };
}
