import { describe, expect, it } from "vitest";
import { billingDetailsComplete, formatInvoiceNumber } from "./invoices";

describe("formatInvoiceNumber", () => {
  it("is the year plus a four-digit sequence", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("2026-0001");
    expect(formatInvoiceNumber(2026, 123)).toBe("2026-0123");
    expect(formatInvoiceNumber(2027, 12345)).toBe("2027-12345");
  });
});

describe("billingDetailsComplete", () => {
  it("needs address, postcode and city", () => {
    expect(billingDetailsComplete({ billingAddress: "Straat 1", billingPostcode: "1234 AB", billingCity: "Amsterdam" })).toBe(true);
    expect(billingDetailsComplete({ billingAddress: "Straat 1", billingPostcode: " ", billingCity: "Amsterdam" })).toBe(false);
  });
});
