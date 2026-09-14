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

// A supplier marking a link "live" isn't the same as a customer confirming
// it's actually correct — this closes that gap without a full moderation
// queue: the customer checks the live placement themselves and confirms it.
export async function confirmCompletionAction(orderId: string): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan.", success: false };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.customerId !== session.user.id) {
    return { error: "Niet toegestaan.", success: false };
  }
  if (order.status !== "PUBLISHED") {
    return { error: "Deze order staat nog niet als gepubliceerd.", success: false };
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "COMPLETED" } });
  return { error: null, success: true };
}
