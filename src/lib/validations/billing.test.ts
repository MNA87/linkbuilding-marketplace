import { describe, expect, it } from "vitest";
import { billingDetailsSchema, sellerDetailsSchema } from "./billing";

describe("billingDetailsSchema", () => {
  it("normalises postcode and VAT number", () => {
    const r = billingDetailsSchema.parse({
      billingAddress: " Kerkstraat 1 ",
      billingPostcode: "1234ab",
      billingCity: "Utrecht",
      vatNumber: "nl 1234.56789 b01",
    });
    expect(r).toEqual({ billingAddress: "Kerkstraat 1", billingPostcode: "1234 AB", billingCity: "Utrecht", vatNumber: "NL123456789B01" });
  });

  it("allows no VAT number", () => {
    const r = billingDetailsSchema.parse({ billingAddress: "Kerkstraat 1", billingPostcode: "1234 AB", billingCity: "Utrecht", vatNumber: "" });
    expect(r.vatNumber).toBeNull();
  });

  it("rejects a bad postcode or VAT number", () => {
    expect(billingDetailsSchema.safeParse({ billingAddress: "Kerkstraat 1", billingPostcode: "0123 AB", billingCity: "Utrecht", vatNumber: "" }).success).toBe(false);
    expect(billingDetailsSchema.safeParse({ billingAddress: "Kerkstraat 1", billingPostcode: "1234 AB", billingCity: "Utrecht", vatNumber: "BE0123" }).success).toBe(false);
  });
});

describe("sellerDetailsSchema", () => {
  const valid = {
    sellerName: "Voorbeeld BV",
    sellerAddress: "Kerkstraat 1",
    sellerPostcode: "1234 AB",
    sellerCity: "Utrecht",
    sellerKvk: "12345678",
    sellerVatNumber: "NL123456789B01",
    sellerIban: "nl91 abna 0417 1643 00",
    sellerEmail: "",
  };

  it("accepts complete details", () => {
    expect(sellerDetailsSchema.parse(valid).sellerIban).toBe("NL91ABNA0417164300");
  });

  it("requires KvK and VAT number", () => {
    expect(sellerDetailsSchema.safeParse({ ...valid, sellerKvk: "123" }).success).toBe(false);
    expect(sellerDetailsSchema.safeParse({ ...valid, sellerVatNumber: "" }).success).toBe(false);
  });
});
