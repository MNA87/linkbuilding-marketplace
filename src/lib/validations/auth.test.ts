import { describe, it, expect } from "vitest";
import { changePasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./auth";

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
    acceptedTerms: true as const,
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

  it("rejects registration without accepting the terms", () => {
    const result = registerSchema.safeParse({ ...base, acceptedTerms: false });
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

describe("changePasswordSchema", () => {
  const base = { currentPassword: "Oud1234567", password: "Nieuw12345", confirmPassword: "Nieuw12345" };
  const error = (input: object) => {
    const r = changePasswordSchema.safeParse(input);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it("accepts a new, strong password", () => {
    expect(error(base)).toBeNull();
  });

  it("needs the current password", () => {
    expect(error({ ...base, currentPassword: "" })).toBe("Vul je huidige wachtwoord in");
  });

  it("rejects a weak or mismatched new password", () => {
    expect(error({ ...base, password: "kort1A", confirmPassword: "kort1A" })).toBe("Wachtwoord moet minimaal 10 tekens zijn");
    expect(error({ ...base, confirmPassword: "Anders12345" })).toBe("Wachtwoorden komen niet overeen");
  });

  it("rejects the same password as now", () => {
    expect(error({ ...base, currentPassword: "Nieuw12345" })).toBe("Kies een ander wachtwoord dan je huidige");
  });
});
