import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A link's own page became a block on its order's page; old links (the
// expiry reminder, bookmarks) land there with that link opened.
export default async function CustomerLinkRedirect({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { orderId: true, order: { select: { customerId: true } } },
  });
  if (!item || item.order.customerId !== session.user.id) notFound();
  redirect(`/dashboard/orders/${item.orderId}?link=${itemId}`);
}
