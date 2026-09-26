"use server";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CART_BAR_COOKIE, cartFingerprint } from "@/lib/cartReminder";

// Closes the cart bar on the dashboard until the cart changes.
export async function hideCartBarAction(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") return;
  const items = await prisma.orderItem.findMany({
    where: { order: { customerId: session.user.id, status: "NEW" } },
    select: { id: true },
  });
  (await cookies()).set(CART_BAR_COOKIE, cartFingerprint(session.user.id, items.map((i) => i.id)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
}
