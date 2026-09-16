"use server";

import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { headers } from "next/headers";
import { CompanyType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/email";

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
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptedTerms: formData.get("acceptedTerms") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }

  const { accountType, companyName, name, email, password } = parsed.data;

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
          type: accountType === "customer" ? CompanyType.CUSTOMER : CompanyType.PUBLISHER,
        },
      });
      await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
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

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;
  await sendVerificationEmail(email, verifyUrl);

  return { error: null, success: true };
}
