"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Archiveren in Mijn orders: de klant legt een afgehandelde order weg zodat de
// lijst overzichtelijk blijft. Dit staat los van de admin-archivering
// (Order.archivedAt) — we gebruiken een eigen veld, customerArchivedAt. Een
// order blijft gewoon bestaan; hij verdwijnt alleen uit de standaardlijst en
// staat onder "Gearchiveerd", waar je 'm altijd terug kunt zetten.
export async function setOrderArchivedAction(
  orderId: string,
  archived: boolean
): Promise<{ error: string | null; success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan.", success: false };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true, status: true } });
  if (!order || order.customerId !== session.user.id) {
    return { error: "Niet toegestaan.", success: false };
  }
  // Een order in het winkelmandje (NEW) is nog geen echte order; die hoort niet
  // in Mijn orders en kan dus ook niet gearchiveerd worden.
  if (order.status === "NEW") {
    return { error: "Deze bestelling staat nog in je mandje.", success: false };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { customerArchivedAt: archived ? new Date() : null },
  });
  revalidatePath("/dashboard/orders");
  return { error: null, success: true };
}

// Meerdere orders tegelijk archiveren of terugzetten (de selectievakjes +
// groene balk in Mijn orders). Alleen de eigen, echte orders worden geraakt;
// mandje-orders (NEW) worden overgeslagen.
export async function setOrdersArchivedAction(
  orderIds: string[],
  archived: boolean
): Promise<{ error: string | null; count: number }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") {
    return { error: "Niet toegestaan.", count: 0 };
  }
  const ids = Array.from(new Set(orderIds)).filter(Boolean);
  if (ids.length === 0) return { error: null, count: 0 };

  const res = await prisma.order.updateMany({
    where: { id: { in: ids }, customerId: session.user.id, status: { not: "NEW" } },
    data: { customerArchivedAt: archived ? new Date() : null },
  });
  revalidatePath("/dashboard/orders");
  return { error: null, count: res.count };
}
