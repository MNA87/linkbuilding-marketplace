import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, resetPasswordSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.nl", password: "x" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.nl", password: "" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = {
    accountType: "customer" as const,
    companyName: "Test BV",
    name: "Jan Jansen",
    email: "jan@test.nl",
    password: "Sterk12345",
    confirmPassword: "Sterk12345",
  };

  it("accepts valid input", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: "Anders12345" });
    expect(result.success).toBe(false);
  });

  it("rejects a password without an uppercase letter", () => {
    const result = registerSchema.safeParse({ ...base, password: "sterk12345", confirmPassword: "sterk12345" });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 10 characters", () => {
    const result = registerSchema.safeParse({ ...base, password: "Ab1", confirmPassword: "Ab1" });
    expect(result.success).toBe(false);
  });

  it("rejects an accountType other than customer/supplier", () => {
    const result = registerSchema.safeParse({ ...base, accountType: "admin" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "Sterk12345",
      confirmPassword: "Anders12345",
    });
    expect(result.success).toBe(false);
  });
});
