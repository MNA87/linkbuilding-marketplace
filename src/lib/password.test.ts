import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("still accepts passwords hashed by bcryptjs ($2a$, cost 12)", async () => {
    const old = "$2a$12$vMX.iedzYIqgYxxR4zKqk.6aPAO5FkZjR2hzsgpy49LVm8TJISzve";
    expect(await verifyPassword("Loadtest-12345!", old)).toBe(true);
    expect(await verifyPassword("loadtest-12345!", old)).toBe(false);
  });

  it("hashes with cost 12 and verifies its own hashes", async () => {
    const h = await hashPassword("Geheim-123!");
    expect(h).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword("Geheim-123!", h)).toBe(true);
    expect(await verifyPassword("Geheim-124!", h)).toBe(false);
  });

  it("answers every one of many logins at once correctly", async () => {
    const old = "$2a$04$abcdefghijklmnopqrstuuTnvjpVTA8Gx4dLWykbH3jWq8lfp0xmW";
    const h = await hashPassword("x");
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => verifyPassword(i % 2 ? "x" : "y", i % 3 ? h : old))
    );
    expect(results).toEqual(Array.from({ length: 12 }, (_, i) => i % 2 === 1 && i % 3 !== 0));
  });
});
