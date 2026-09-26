import { describe, expect, it } from "vitest";
import { findNumber, isProvider } from "./apiCredentials";

describe("findNumber", () => {
  it("finds a number by key, however deep", () => {
    const body = { limits_and_usage: { units_limit_workspace: 200000, units_usage_workspace: "1500" } };
    expect(findNumber(body, /units_limit/i)).toBe(200000);
    expect(findNumber(body, /units_usage/i)).toBe(1500);
    expect(findNumber({ Credits: 2318 }, /^credits$/i)).toBe(2318);
  });

  it("gives null when it isn't there", () => {
    expect(findNumber({ result: "error" }, /^credits$/i)).toBeNull();
    expect(findNumber(null, /x/)).toBeNull();
  });
});

describe("isProvider", () => {
  it("knows the services", () => {
    expect(isProvider("ahrefs")).toBe(true);
    expect(isProvider("seometrics")).toBe(true);
    expect(isProvider("__proto__")).toBe(false);
  });
});
