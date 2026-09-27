import { describe, expect, it } from "vitest";
import type { Company } from "@prisma/client";
import { billingDetailsComplete, formatInvoiceNumber, invoiceCustomer } from "./invoices";

describe("formatInvoiceNumber", () => {
  it("is digits only: the year plus a four-digit sequence", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("20260001");
    expect(formatInvoiceNumber(2026, 123)).toBe("20260123");
    expect(formatInvoiceNumber(2027, 12345)).toBe("202712345");
  });
});

describe("billingDetailsComplete", () => {
  it("needs address, postcode and city", () => {
    expect(billingDetailsComplete({ billingAddress: "Straat 1", billingPostcode: "1234 AB", billingCity: "Amsterdam" })).toBe(true);
    expect(billingDetailsComplete({ billingAddress: "Straat 1", billingPostcode: " ", billingCity: "Amsterdam" })).toBe(false);
  });
});

describe("invoiceCustomer", () => {
  const company = {
    name: "Nieuwe Naam BV",
    billingAddress: "Nieuwstraat 1",
    billingPostcode: "1000 AA",
    billingCity: "Utrecht",
    vatNumber: null,
  } as Company;
  const issued = {
    companyName: "Oude Naam BV",
    contactName: "Jan",
    email: "jan@oud.nl",
    address: "Oudstraat 9",
    postcode: "2000 BB",
    city: "Leiden",
    vatNumber: "NL123456789B01",
  };

  it("is who the invoice was addressed to, whatever changed since", () => {
    expect(invoiceCustomer({ customerDetails: issued, customerCompany: company })).toEqual(issued);
  });

  it("falls back to the company as it is now for invoices without the details", () => {
    expect(invoiceCustomer({ customerDetails: null, customerCompany: company })).toMatchObject({
      companyName: "Nieuwe Naam BV",
      address: "Nieuwstraat 1",
    });
  });
});
