"use server";

import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { headers } from "next/headers";
import { CompanyType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/email";
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Er bestaat al een account met dit e-mailadres.", success: false };
  }

  const role = await prisma.role.findUnique({ where: { name: accountType } });
  if (!role) {
    return { error: "Onbekend accounttype.", success: false };
  }

  const passwordHash = await bcrypt.hash(password, 12);
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

// "Niets ontvangen? Stuur de link opnieuw" after registering: a fresh link
// for an account that isn't confirmed yet. Says the same whatever the
// address, so it can't be used to find out who has an account.
export async function resendVerificationAction(email: string): Promise<{ message: string }> {
  const message = "Als dit adres nog bevestigd moet worden, hebben we een nieuwe link gestuurd.";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`resend-verification:${ip}`, 3, 15 * 60_000)) return { message };

  const user = await prisma.user.findUnique({ where: { email: String(email).trim() } });
  if (user && user.status === "active" && !user.emailVerifiedAt) {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: createHash("sha256").update(rawToken).digest("hex"),
        emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
    await sendVerificationLink(user.email, user.name ?? "", rawToken);
  }
  return { message };
}
