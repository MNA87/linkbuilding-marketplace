"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchInboundMail } from "@/lib/mailbox";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
}

// "Nu ophalen": the same as the timer, straight away.
export async function fetchMailNowAction(): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const result = await fetchInboundMail();
  revalidatePath("/admin", "layout");
  return result;
}

// Ignore a mail, or put it back among the new ones.
export async function setMailStatusAction(id: string, status: "new" | "ignored"): Promise<void> {
  if (!(await requireAdmin())) return;
  if (status !== "new" && status !== "ignored") return;
  await prisma.inboundMail.updateMany({ where: { id: String(id), status: { not: "done" } }, data: { status } });
  revalidatePath("/admin", "layout");
}
