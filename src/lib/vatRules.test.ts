import { describe, expect, it } from "vitest";
import { vatTreatment } from "./vatRules";
import { namesMatch, splitVatNumber, statusFromVies } from "./vies";

const company = (country: string, vatNumber: string | null, vatStatus = "none", isBusiness = true) => ({
  country,
  vatNumber,
  vatStatus,
  isBusiness,
});

describe("vatTreatment", () => {
  it("charges 21% in the Netherlands, also with a VAT number", () => {
    expect(vatTreatment(company("NL", "NL123456789B01", "valid"))).toEqual({ rate: 21, note: null });
  });
  it("doesn't wait for anyone: a valid number with another name still counts", () => {
    expect(vatTreatment(company("BE", "BE0123456789", "mismatch"))).toEqual({ rate: 0, note: "reverse" });
  });
  it("reverses VAT for an EU business with a checked number", () => {
    expect(vatTreatment(company("BE", "BE0123456789", "valid"))).toEqual({ rate: 0, note: "reverse" });
    expect(vatTreatment(company("DE", "DE123456789", "approved"))).toEqual({ rate: 0, note: "reverse" });
  });
  it("charges 21% in the EU without a checked number", () => {
    expect(vatTreatment(company("BE", null)).rate).toBe(21);
    expect(vatTreatment(company("BE", "BE0123456789", "unreachable")).rate).toBe(21);
    expect(vatTreatment(company("BE", "BE0123456789", "invalid")).rate).toBe(21);
  });
  it("charges no Dutch VAT to a business outside the EU", () => {
    expect(vatTreatment(company("GB", null))).toEqual({ rate: 0, note: "outside_eu" });
  });
  it("is careful with 'Ander land' and private customers", () => {
    expect(vatTreatment(company("OTHER", null)).rate).toBe(21);
    expect(vatTreatment(company("BE", "BE0123456789", "valid", false)).rate).toBe(21);
  });
});

describe("VIES", () => {
  it("splits a VAT number", () => {
    expect(splitVatNumber("be 0123.456.789")).toEqual({ countryCode: "BE", number: "0123456789" });
  });
  it("matches names despite legal forms and accents", () => {
    expect(namesMatch("Voorbeeld BV", "VOORBEELD BVBA")).toBe(true);
    expect(namesMatch("Café Nord", "SRL CAFE NORD")).toBe(true);
    expect(namesMatch("All the way up", "All the Way Up Marketing")).toBe(true);
    expect(namesMatch("Voorbeeld BV", "Heel Ander Bedrijf NV")).toBe(false);
  });
  it("turns the answer into a status", () => {
    const answer = (valid: boolean, name: string | null) => ({
      ok: true as const,
      valid,
      name,
      address: null,
      requestIdentifier: null,
    });
    expect(statusFromVies(answer(true, "VOORBEELD BVBA"), "Voorbeeld BV")).toBe("valid");
    expect(statusFromVies(answer(true, "Iets Anders"), "Voorbeeld BV")).toBe("mismatch");
    expect(statusFromVies(answer(true, null), "Voorbeeld BV")).toBe("valid");
    expect(statusFromVies(answer(false, null), "Voorbeeld BV")).toBe("invalid");
    expect(statusFromVies({ ok: false }, "Voorbeeld BV")).toBe("unreachable");
  });
});
