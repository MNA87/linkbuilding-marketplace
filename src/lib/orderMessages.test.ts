import { describe, expect, it } from "vitest";
import { isUnanswered, latestPerConversation, messageBodySchema, messageTime } from "./orderMessages";

describe("messageBodySchema", () => {
  it("trims and refuses empty or too long messages", () => {
    expect(messageBodySchema.parse("  Hallo  ")).toBe("Hallo");
    expect(messageBodySchema.safeParse("   ").success).toBe(false);
    expect(messageBodySchema.safeParse("x".repeat(2001)).success).toBe(false);
  });
});

describe("messageTime", () => {
  it("shows day-month and Dutch time", () => {
    expect(messageTime(new Date("2026-09-25T12:05:00Z"))).toBe("25-9 14:05");
  });
});

describe("conversations", () => {
  const m = (orderItemId: string, fromAdmin: boolean, minutes: number) => ({
    orderItemId,
    fromAdmin,
    createdAt: new Date(minutes * 60000),
  });

  it("keeps only the newest message per link and spots the unanswered ones", () => {
    const newestFirst = [m("a", false, 50), m("b", true, 40), m("a", true, 30), m("c", false, 20), m("b", false, 10)];
    const latest = latestPerConversation(newestFirst);
    expect(latest.map((x) => x.orderItemId)).toEqual(["a", "b", "c"]);
    expect(latest.filter(isUnanswered).map((x) => x.orderItemId)).toEqual(["a", "c"]);
  });
});
