"use server";

import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { headers } from "next/headers";
import { CompanyType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/email";
import { sendPasswordReset } from "@/lib/passwordReset";
import { TERMS_VERSION } from "@/lib/terms";

export type RegisterState = {
  error: string | null;
  success: boolean;
};

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Registration writes to the DB and hashes a password (expensive) before
  // any other check — rate-limit it same as login, so it can't be used to
  // spam-create accounts or hammer bcrypt.
  if (isRateLimited(`register:${ip}`, 5, 60_000)) {
    return { error: "Te veel pogingen. Probeer het over een minuut opnieuw.", success: false };
  }

  const parsed = registerSchema.safeParse({
    accountType: formData.get("accountType"),
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword") ?? "",
    companyName: formData.get("companyName") ?? "",
    phone: formData.get("phone") ?? "",
    country: formData.get("country"),
    referralSource: formData.get("referralSource"),
    acceptedTerms: formData.get("acceptedTerms") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }

  const { accountType, firstName, lastName, email, phone, password, companyName, country, referralSource } =
    parsed.data;
  const name = `${firstName} ${lastName}`;

  // Hashed before anything else, so a known address takes as long to answer
  // as a new one.
  const passwordHash = await bcrypt.hash(password, 12);

  // An address we already know gets the same "Check je e-mail" as a new
  // one, so the form can't be used to find out who is a customer; what the
  // mail says differs (see mailKnownAddress).
  const existing = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (existing) {
    await mailKnownAddress(existing);
    return { error: null, success: true };
  }

  const role = await prisma.role.findUnique({ where: { name: accountType } });
  if (!role) {
    return { error: "Onbekend accounttype.", success: false };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  try {
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          isBusiness: true,
          country,
          type: accountType === "customer" ? CompanyType.CUSTOMER : CompanyType.PUBLISHER,
        },
      });
      await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          phone,
          referralSource,
          // The voorwaarden ticked when registering: which version, and when.
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: new Date(),
          roleId: role.id,
          companyId: company.id,
          emailVerificationTokenHash: tokenHash,
          emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60_000),
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Er bestaat al een account met dit e-mailadres.", success: false };
    }
    throw err;
  }

  await sendVerificationLink(email, name, rawToken);
  return { error: null, success: true };
}

async function sendVerificationLink(email: string, name: string, rawToken: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await sendVerificationEmail(
    email,
    name,
    `${appUrl}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`
  );
}

// Someone signs up (or asks for the link again) with an address that has an
// account. Signed up themselves but not confirmed yet: a fresh confirm link.
// Otherwise a customer (e.g. one who orders by mail, with a password nobody
// knows) gets a link to choose their password. Admin and publisher
// accounts get nothing. At most one such mail per address per 10 minutes,
// whoever asks (the link sent before stays valid).
const MAIL_GAP_MS = 10 * 60_000;
const LINK_MS = 24 * 60 * 60_000;
// When the link with this expiry was sent (it's valid for a day).
const sentRecently = (expires: Date | null) => !!expires && expires.getTime() - LINK_MS > Date.now() - MAIL_GAP_MS;

async function mailKnownAddress(user: {
  id: string;
  email: string;
  name: string | null;
  status: string;
  emailVerifiedAt: Date | null;
  emailVerificationTokenHash: string | null;
  emailVerificationTokenExpires: Date | null;
  passwordResetTokenExpires: Date | null;
  role: { name: string };
}) {
  if (user.status !== "active" || user.role.name !== "customer") return;
  if (!user.emailVerifiedAt && user.emailVerificationTokenHash) {
    if (sentRecently(user.emailVerificationTokenExpires)) return;
    const rawToken = randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: createHash("sha256").update(rawToken).digest("hex"),
        emailVerificationTokenExpires: new Date(Date.now() + LINK_MS),
      },
    });
    await sendVerificationLink(user.email, user.name ?? "", rawToken);
    return;
  }
  if (sentRecently(user.passwordResetTokenExpires)) return;
  await sendPasswordReset(user, "account_exists");
}

// "Niets ontvangen? Stuur de link opnieuw" after registering: the mail
// again. Says the same whatever the address, so it can't be used to find
// out who has an account.
export async function resendVerificationAction(email: string): Promise<{ message: string }> {
  const message = "Als dit adres nog bevestigd moet worden, hebben we een nieuwe link gestuurd.";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`resend-verification:${ip}`, 3, 15 * 60_000)) return { message };

  const user = await prisma.user.findUnique({ where: { email: String(email).trim() }, include: { role: true } });
  if (user) await mailKnownAddress(user);
  return { message };
}
