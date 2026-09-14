import { describe, it, expect } from "vitest";
import { isRateLimited } from "./rateLimit";

describe("isRateLimited", () => {
  it("allows requests under the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(key, 5, 60_000)).toBe(false);
    }
  });

  it("blocks once the limit is exceeded", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) isRateLimited(key, 5, 60_000);
    expect(isRateLimited(key, 5, 60_000)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) isRateLimited(keyA, 5, 60_000);
    expect(isRateLimited(keyA, 5, 60_000)).toBe(true);
    expect(isRateLimited(keyB, 5, 60_000)).toBe(false);
  });
});
