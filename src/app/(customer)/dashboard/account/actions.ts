"use server";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rateLimit";
import { sendEmailChangeEmail, sendPasswordChangedEmail } from "@/lib/email";
import { signOutEverywhere } from "@/lib/sessionVersion";
import { sendPasswordReset } from "@/lib/passwordReset";
import { changePasswordSchema } from "@/lib/validations/auth";
import { refreshVatCheck } from "@/lib/vatCheck";
import {
  type AccountDetails,
  emailChangeSchema,
  invoiceDetailsOf,
  parseAccountDetails,
} from "@/lib/validations/account";

async function customerSession() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "customer" && session.user.companyId ? session : null;
}

// "Mijn gegevens": the person, and what goes on the invoices — the
// company, or for a private customer their own name and address.
export async function saveAccountDetailsAction(
  input: unknown
): Promise<{ error: string | null; success: boolean; saved?: AccountDetails; vatStatus?: string }> {
  const session = await customerSession();
  if (!session) return { error: "Niet toegestaan.", success: false };
  const { data, error } = parseAccountDetails(input);
  if (!data) return { error, success: false };

  const before = await prisma.company.findUnique({ where: { id: session.user.companyId! } });
  const invoice = invoiceDetailsOf(data);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { name: data.name, phone: data.phone, address: data.address, postcode: data.postcode, city: data.city },
    }),
    prisma.company.update({ where: { id: session.user.companyId! }, data: invoice }),
  ]);
  // A new VAT number, company name or country is checked again with VIES.
  const changed =
    !before ||
    before.vatNumber !== invoice.vatNumber ||
    before.name !== invoice.name ||
    before.country !== invoice.country ||
    before.isBusiness !== invoice.isBusiness;
  const vatStatus = changed ? await refreshVatCheck(session.user.companyId!) : before.vatStatus;
  // Normalised (postcode "1234 AB", VAT number in capitals), for the form.
  return { error: null, success: true, saved: data, vatStatus };
}

// Checks the current password of the signed-in customer. Guessing it from
// an open session is slowed down just like logging in.
async function checkPassword(userId: string, password: string, what: string) {
  if (isRateLimited(`${what}:${userId}`, 5, 15 * 60_000)) {
    return { error: "Te veel pogingen. Probeer het over een kwartier opnieuw.", user: null };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "active") return { error: "Niet toegestaan.", user: null };
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Je huidige wachtwoord klopt niet.", user: null };
  }
  return { error: null, user };
}

export async function changePasswordAction(input: unknown): Promise<{ error: string | null; success: boolean }> {
  const session = await customerSession();
  if (!session) return { error: "Niet toegestaan.", success: false };
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };

  const { error, user } = await checkPassword(session.user.id, parsed.data.currentPassword, "change-password");
  if (!user) return { error, success: false };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      // A reset link asked for earlier no longer applies.
      passwordResetTokenHash: null,
      passwordResetTokenExpires: null,
    },
  });
  // Anyone else still logged in with the old password is out now.
  await signOutEverywhere(user.id, { keepThisLogin: true });
  await sendPasswordChangedEmail(user.email);
  return { error: null, success: true };
}

// "Wachtwoord vergeten?" while logged in: the reset link goes to the
// account's own address.
export async function sendMyPasswordResetAction(): Promise<{ error: string | null; success: boolean; email?: string }> {
  const session = await customerSession();
  if (!session) return { error: "Niet toegestaan.", success: false };
  if (isRateLimited(`reset-from-account:${session.user.id}`, 3, 15 * 60_000)) {
    return { error: "Te vaak aangevraagd. Probeer het over een kwartier opnieuw.", success: false };
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.status !== "active") return { error: "Niet toegestaan.", success: false };

  await sendPasswordReset(user);
  return { error: null, success: true, email: user.email };
}

// A fresh link for the new address; only its hash is kept.
async function sendEmailChangeLink(userId: string, newEmail: string) {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail: newEmail,
      pendingEmailTokenHash: createHash("sha256").update(rawToken).digest("hex"),
      pendingEmailTokenExpires: new Date(Date.now() + 24 * 60 * 60_000),
    },
  });
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendEmailChangeEmail(newEmail, `${appUrl}/confirm-email?token=${rawToken}`);
}

const emailTaken = async (email: string, userId: string) =>
  Boolean(
    await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, id: { not: userId } },
      select: { id: true },
    })
  );

// The login address changes only once the link sent to the new address is
// opened (/confirm-email); until then the customer logs in as before.
export async function requestEmailChangeAction(input: unknown): Promise<{ error: string | null; success: boolean }> {
  const session = await customerSession();
  if (!session) return { error: "Niet toegestaan.", success: false };
  const parsed = emailChangeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };

  const { error, user } = await checkPassword(session.user.id, parsed.data.currentPassword, "change-email");
  if (!user) return { error, success: false };

  const newEmail = parsed.data.newEmail;
  if (newEmail.toLowerCase() === user.email.toLowerCase()) {
    return { error: "Dit is al je e-mailadres.", success: false };
  }
  if (await emailTaken(newEmail, user.id)) {
    return { error: "Dit e-mailadres is al in gebruik bij een ander account.", success: false };
  }

  await sendEmailChangeLink(user.id, newEmail);
  return { error: null, success: true };
}

export async function resendEmailChangeAction(): Promise<{ error: string | null; success: boolean }> {
  const session = await customerSession();
  if (!session) return { error: "Niet toegestaan.", success: false };
  if (isRateLimited(`resend-email-change:${session.user.id}`, 3, 15 * 60_000)) {
    return { error: "Te vaak opnieuw gestuurd. Probeer het over een kwartier opnieuw.", success: false };
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.pendingEmail) return { error: "Er is geen wijziging om te bevestigen.", success: false };

  await sendEmailChangeLink(user.id, user.pendingEmail);
  return { error: null, success: true };
}

export async function cancelEmailChangeAction(): Promise<{ error: string | null; success: boolean }> {
  const session = await customerSession();
  if (!session) return { error: "Niet toegestaan.", success: false };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { pendingEmail: null, pendingEmailTokenHash: null, pendingEmailTokenExpires: null },
  });
  return { error: null, success: true };
}
