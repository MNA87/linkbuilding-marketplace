"use server";

import { getServerSession } from "next-auth";
import { OrderStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CANCELLABLE_STATUSES: OrderStatus[] = ["PAID", "SENT_TO_PUBLISHER", "ACCEPTED", "IN_PROGRESS"];

export async function requestRefundAction(orderId: string): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan.", success: false };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.customerId !== session.user.id) {
    return { error: "Niet toegestaan.", success: false };
  }
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return { error: "Deze order kan niet meer geannuleerd worden (al gepubliceerd of afgerond).", success: false };
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "REFUND_REQUESTED" } });
  return { error: null, success: true };
}
