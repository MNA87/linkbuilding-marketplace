"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setEmailTemplateSchema } from "@/lib/validations/emailTemplate";

export type EmailTemplateActionState = { error: string | null; success: boolean };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
}

export async function adminSetEmailTemplateAction(input: unknown): Promise<EmailTemplateActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  const parsed = setEmailTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }
  const { key, subject, bodyHtml } = parsed.data;

  await prisma.emailTemplate.upsert({
    where: { key },
    create: { key, subject, bodyHtml },
    update: { subject, bodyHtml },
  });

  return { error: null, success: true };
}

// Deleting the override row is exactly "reset to default" — the sender in
// src/lib/email.ts falls back to the built-in text the moment no row
// exists for this key.
export async function adminResetEmailTemplateAction(key: string): Promise<EmailTemplateActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };

  await prisma.emailTemplate.deleteMany({ where: { key } });
  return { error: null, success: true };
}
