import { describe, expect, it } from "vitest";
import { buttonColorVars, isHexColor, textColorFor } from "./buttonColors";

describe("isHexColor", () => {
  it("accepts 6-digit hex only", () => {
    expect(isHexColor("#0d9488")).toBe(true);
    expect(isHexColor("#FFF")).toBe(false);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#0d9488; color: red")).toBe(false);
  });
});

describe("textColorFor", () => {
  it("uses white on dark and dark text on light colours", () => {
    expect(textColorFor("#1e3a8a")).toBe("#ffffff");
    expect(textColorFor("#2563eb")).toBe("#ffffff");
    expect(textColorFor("#facc15")).toBe("#1a1a1a");
    expect(textColorFor("#ffffff")).toBe("#1a1a1a");
  });
});

describe("buttonColorVars", () => {
  it("renders an outlined primary button in the primary colour", () => {
    const vars = buttonColorVars({ pay: "#0d9488", primary: "#2563eb", primaryFilled: false }) as Record<string, string>;
    expect(vars["--btn-primary-bg"]).toBe("#ffffff");
    expect(vars["--btn-primary-fg"]).toBe("#2563eb");
    expect(vars["--btn-pay-bg"]).toBe("#0d9488");
  });

  it("falls back to defaults for invalid colours", () => {
    const vars = buttonColorVars({ pay: "nope", primary: "#2563eb", primaryFilled: true }) as Record<string, string>;
    expect(vars["--btn-pay-bg"]).toBe("#0d9488");
  });
});
