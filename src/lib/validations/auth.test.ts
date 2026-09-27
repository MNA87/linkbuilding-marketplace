import { describe, it, expect } from "vitest";
import { PASSWORD_RULES, changePasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./auth";

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
    name: "Jan Jansen",
    email: "jan@test.nl",
    phone: "",
    password: "Sterk12345",
    isBusiness: false,
    companyName: "",
    acceptedTerms: true as const,
  };
  const error = (input: object) => {
    const r = registerSchema.safeParse(input);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it("accepts a private customer without a company or phone", () => {
    expect(registerSchema.parse(base)).toMatchObject({ isBusiness: false, phone: null });
  });

  it("needs the company name only when ordering as a business", () => {
    expect(error({ ...base, isBusiness: true })).toBe("Vul de bedrijfsnaam in");
    expect(error({ ...base, isBusiness: true, companyName: "Test BV" })).toBeNull();
  });

  it("checks a phone number when there is one", () => {
    expect(error({ ...base, phone: "06 12345678" })).toBeNull();
    expect(error({ ...base, phone: "123" })).toBe("Ongeldig telefoonnummer (bijv. 06 12345678)");
  });

  it("rejects a weak password", () => {
    expect(error({ ...base, password: "sterk12345" })).toBe("Wachtwoord moet een hoofdletter bevatten");
    expect(error({ ...base, password: "Ab1" })).toBe("Wachtwoord moet minimaal 10 tekens zijn");
  });

  it("rejects an accountType other than customer", () => {
    expect(registerSchema.safeParse({ ...base, accountType: "admin" }).success).toBe(false);
  });

  it("rejects registration without accepting the terms", () => {
    expect(error({ ...base, acceptedTerms: false })).toBe("Je moet akkoord gaan met de voorwaarden");
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

describe("PASSWORD_RULES", () => {
  it("are met exactly when the schema accepts the password", () => {
    for (const pw of ["Sterk12345", "sterk12345", "STERK12345", "Sterkwachtwoord", "Kort1"]) {
      const allMet = PASSWORD_RULES.every((r) => r.test(pw));
      expect(allMet).toBe(changePasswordSchema.safeParse({ currentPassword: "x", password: pw, confirmPassword: pw }).success);
    }
  });
});
