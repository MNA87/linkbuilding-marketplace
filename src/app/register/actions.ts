"use server";

import bcrypt from "bcryptjs";
import { CompanyType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";

export type RegisterState = {
  error: string | null;
  success: boolean;
};

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    accountType: formData.get("accountType"),
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
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
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Er bestaat al een account met dit e-mailadres.", success: false };
    }
    throw err;
  }

  return { error: null, success: true };
}
