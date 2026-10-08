import { describe, expect, it } from "vitest";
import { reachableNow, whatsappDigits, whatsappUrl } from "./contact";

describe("contact", () => {
  it("turns a Dutch number into wa.me digits", () => {
    expect(whatsappDigits("06 12345678")).toBe("31612345678");
    expect(whatsappDigits("+31 6 1234 5678")).toBe("31612345678");
    expect(whatsappDigits("0031612345678")).toBe("31612345678");
    expect(whatsappDigits("+32 470 12 34 56")).toBe("32470123456");
    expect(whatsappDigits("12")).toBeNull();
    expect(whatsappDigits("")).toBeNull();
    expect(whatsappUrl("31612345678")).toBe("https://wa.me/31612345678");
  });
  it("is reachable on weekdays from 9 to 17, Dutch time", () => {
    expect(reachableNow(new Date("2026-10-08T07:30:00Z"))).toBe(true); // Thu 9:30
    expect(reachableNow(new Date("2026-10-08T06:30:00Z"))).toBe(false); // Thu 8:30
    expect(reachableNow(new Date("2026-10-08T15:30:00Z"))).toBe(false); // Thu 17:30
    expect(reachableNow(new Date("2026-10-10T10:00:00Z"))).toBe(false); // Sat
  });
});
