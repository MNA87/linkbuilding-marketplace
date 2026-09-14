"use server";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(2, "Naam moet minimaal 2 tekens zijn").max(200),
  companyName: z.string().trim().min(2, "Bedrijfsnaam moet minimaal 2 tekens zijn").max(200),
});

export async function updateProfileAction(input: unknown): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: session.user.id }, data: { name: parsed.data.name } }),
    prisma.company.update({ where: { id: session.user.companyId }, data: { name: parsed.data.companyName } }),
  ]);

  return { error: null, success: true };
}
