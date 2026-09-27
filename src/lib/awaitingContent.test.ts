import { describe, expect, it } from "vitest";
import { contentReminderDue, isAwaitingContent } from "./awaitingContent";

const empty = { renewsOrderItemId: null, targetUrl: null, articleTitle: null, writeForMe: false, briefLinks: null };
const day = 24 * 60 * 60 * 1000;

describe("isAwaitingContent", () => {
  it("is a paid item without content", () => {
    expect(isAwaitingContent(empty, "PAID", "BLOG_POST")).toBe(true);
    expect(isAwaitingContent(empty, "IN_PROGRESS", "HOMEPAGE_LINK")).toBe(true);
  });

  it("is not an item that has its content", () => {
    expect(isAwaitingContent({ ...empty, articleTitle: "Titel" }, "PAID", "BLOG_POST")).toBe(false);
    expect(isAwaitingContent({ ...empty, targetUrl: "https://a.nl" }, "PAID", "HOMEPAGE_LINK")).toBe(false);
  });

  it("is not a cart item, a cancelled order or a placed item", () => {
    expect(isAwaitingContent(empty, "NEW", "BLOG_POST")).toBe(false);
    expect(isAwaitingContent(empty, "CANCELLED", "BLOG_POST")).toBe(false);
    expect(isAwaitingContent({ ...empty, placement: { id: "p" } }, "PAID", "BLOG_POST")).toBe(false);
  });

  it("is not a renewal", () => {
    expect(isAwaitingContent({ ...empty, renewsOrderItemId: "x" }, "PAID", "HOMEPAGE_LINK")).toBe(false);
  });
});

describe("contentReminderDue", () => {
  const paidAt = new Date("2026-09-01T10:00:00Z");
  it("sends after 3, 7 and 30 days, one at a time", () => {
    expect(contentReminderDue(paidAt, 0, new Date(paidAt.getTime() + 2 * day))).toBe(false);
    expect(contentReminderDue(paidAt, 0, new Date(paidAt.getTime() + 3 * day))).toBe(true);
    expect(contentReminderDue(paidAt, 1, new Date(paidAt.getTime() + 5 * day))).toBe(false);
    expect(contentReminderDue(paidAt, 1, new Date(paidAt.getTime() + 7 * day))).toBe(true);
    expect(contentReminderDue(paidAt, 2, new Date(paidAt.getTime() + 30 * day))).toBe(true);
  });

  it("stops after the last one", () => {
    expect(contentReminderDue(paidAt, 3, new Date(paidAt.getTime() + 90 * day))).toBe(false);
  });
});
