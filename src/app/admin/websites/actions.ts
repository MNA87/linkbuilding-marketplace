"use server";

import { getServerSession } from "next-auth";
import { WebsiteStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateWebsiteStatusAction(
  websiteId: string,
  status: WebsiteStatus
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const validTransitions: WebsiteStatus[] = ["SUBMITTED", "APPROVED", "ACTIVE", "PAUSED", "REJECTED"];
  if (!validTransitions.includes(status)) {
    return { error: "Ongeldige status.", success: false };
  }

  await prisma.website.update({ where: { id: websiteId }, data: { status } });
  return { error: null, success: true };
}
