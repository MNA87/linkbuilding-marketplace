"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2, "Naam moet minimaal 2 tekens zijn").max(200),
  targetWebsite: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function createProjectAction(input: unknown): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) {
    return { error: "Niet toegestaan.", success: false };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer", success: false };
  }

  await prisma.project.create({
    data: {
      name: parsed.data.name,
      targetWebsite: parsed.data.targetWebsite || null,
      notes: parsed.data.notes || null,
      customerCompanyId: session.user.companyId,
    },
  });

  return { error: null, success: true };
}
