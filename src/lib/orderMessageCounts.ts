import { prisma } from "@/lib/prisma";
import { isUnanswered, latestPerConversation } from "@/lib/orderMessages";

// How many conversations wait for an answer — the red count at
// Admin → Berichten. Fine at this scale; one row per message is read.
export async function unansweredCount(): Promise<number> {
  const messages = await prisma.orderMessage.findMany({
    orderBy: { createdAt: "desc" },
    select: { orderId: true, fromAdmin: true, createdAt: true },
  });
  return latestPerConversation(messages).filter(isUnanswered).length;
}
