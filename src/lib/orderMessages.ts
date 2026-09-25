import { z } from "zod";

// Messages about one bought link, between customer and admin. No database
// code here: the chat box in the browser uses this file too.

export const MESSAGE_MAX_LENGTH = 2000;

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, "Typ eerst een bericht.")
  .max(MESSAGE_MAX_LENGTH, `Een bericht mag maximaal ${MESSAGE_MAX_LENGTH} tekens zijn.`);

// Short timestamp for the thread, e.g. "25-9 14:05".
export function messageTime(date: Date): string {
  const day = date.toLocaleDateString("nl-NL", { day: "numeric", month: "numeric", timeZone: "Europe/Amsterdam" });
  const time = date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
  return `${day} ${time}`;
}

type Latest = { orderItemId: string; fromAdmin: boolean; createdAt: Date };

// The newest message of every conversation, newest conversation first
// (input: messages newest first).
export function latestPerConversation<T extends Latest>(messagesNewestFirst: T[]): T[] {
  const seen = new Set<string>();
  return messagesNewestFirst.filter((m) => {
    if (seen.has(m.orderItemId)) return false;
    seen.add(m.orderItemId);
    return true;
  });
}

// A conversation waits for the admin while its newest message is the
// customer's.
export function isUnanswered(latest: { fromAdmin: boolean }): boolean {
  return !latest.fromAdmin;
}

// Answers from us the customer hasn't opened yet.
export function unreadForCustomerWhere(customerId: string) {
  return { fromAdmin: true, readAt: null, orderItem: { order: { customerId } } };
}
