"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelAndRefundOrder } from "@/lib/orderCancel";

type ActionState = { error: string | null; success: boolean };

export async function denyRefundAction(orderId: string): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "REFUND_REQUESTED") {
    return { error: "Ongeldige order.", success: false };
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  return { error: null, success: true };
}

export async function approveRefundAction(orderId: string): Promise<ActionState> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return { error: "Niet toegestaan.", success: false };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "REFUND_REQUESTED") {
    return { error: "Ongeldige order.", success: false };
  }

  const { error } = await cancelAndRefundOrder(orderId);
  return { error, success: !error };
}
