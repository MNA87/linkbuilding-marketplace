import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/email", () => ({ sendSystemAlertEmail: vi.fn() }));

import { jobFailedMail, jobOkMail, newAlertState, pageErrorMail } from "./systemAlerts";

const MIN = 60_000;
const HOUR = 60 * MIN;
const boom = new Error("Failed to establish connection in required time");

describe("system alerts", () => {
  it("mails nothing for a passing hiccup, and nothing when it works again", () => {
    const s = newAlertState();
    expect(jobFailedMail(s, "Mail ophalen", boom, 0)).toBeNull();
    expect(jobFailedMail(s, "Mail ophalen", boom, 3 * MIN)).toBeNull();
    expect(jobOkMail(s, "Mail ophalen", 6 * MIN)).toBeNull();
    // The count starts again after a success.
    for (let i = 0; i < 4; i++) expect(jobFailedMail(s, "Mail ophalen", boom, (9 + 3 * i) * MIN)).toBeNull();
  });

  it("mails once when a job keeps failing, again only after 12 hours, and once when it's fixed", () => {
    const s = newAlertState();
    let mails = 0;
    for (let i = 0; i < 100; i++) if (jobFailedMail(s, "Mail ophalen", boom, i * 3 * MIN)) mails++;
    expect(mails).toBe(1); // 5 hours of failures
    const again = jobFailedMail(s, "Mail ophalen", boom, 13 * HOUR);
    expect(again?.subject).toBe("Nog steeds: Mail ophalen lukt niet");
    expect(jobOkMail(s, "Mail ophalen", 14 * HOUR)?.subject).toBe("Opgelost: Mail ophalen werkt weer");
    expect(jobOkMail(s, "Mail ophalen", 15 * HOUR)).toBeNull();
  });

  it("warns about an hourly job after two failures in a row", () => {
    const s = newAlertState();
    expect(jobFailedMail(s, "Geplande plaatsingen publiceren", boom, 0)).toBeNull();
    const mail = jobFailedMail(s, "Geplande plaatsingen publiceren", boom, HOUR);
    expect(mail?.subject).toBe("Probleem: Geplande plaatsingen publiceren lukt niet");
    expect(mail?.message).toContain("Failed to establish connection");
  });

  it("mails a page error at most once per page per 6 hours, and skips closed pages", () => {
    const s = newAlertState();
    expect(pageErrorMail(s, "/dashboard", new Error("x is undefined"), 0)).not.toBeNull();
    expect(pageErrorMail(s, "/dashboard", new Error("x is undefined"), HOUR)).toBeNull();
    expect(pageErrorMail(s, "/admin/orders", new Error("y"), HOUR)).not.toBeNull();
    expect(pageErrorMail(s, "/dashboard", new Error("x"), 7 * HOUR)).not.toBeNull();
    expect(pageErrorMail(s, "/login", new Error("The destination stream closed early."), 0)).toBeNull();
  });

  it("never sends more than 10 alert mails a day", () => {
    const s = newAlertState();
    let mails = 0;
    for (let i = 0; i < 30; i++) if (pageErrorMail(s, `/page-${i}`, new Error("x"), i * MIN)) mails++;
    expect(mails).toBe(10);
    expect(pageErrorMail(s, "/later", new Error("x"), 25 * HOUR)).not.toBeNull();
  });
});
