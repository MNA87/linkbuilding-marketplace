import { describe, expect, it } from "vitest";
import { cartFingerprint } from "./cartReminder";

describe("cartFingerprint", () => {
  it("is the same for the same links, in any order", () => {
    expect(cartFingerprint("u1", ["a", "b"])).toBe(cartFingerprint("u1", ["b", "a"]));
  });

  it("changes when a link is added or removed, or for another customer", () => {
    const base = cartFingerprint("u1", ["a", "b"]);
    expect(cartFingerprint("u1", ["a", "b", "c"])).not.toBe(base);
    expect(cartFingerprint("u1", ["a"])).not.toBe(base);
    expect(cartFingerprint("u2", ["a", "b"])).not.toBe(base);
  });
});
