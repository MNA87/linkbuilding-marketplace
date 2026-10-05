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
    firstName: "Jan",
    lastName: "Jansen",
    email: "jan@test.nl",
    password: "Sterk12345",
    confirmPassword: "Sterk12345",
    companyName: "Test BV",
    phone: "06 12345678",
    country: "NL",
    referralSource: "Google",
    acceptedTerms: true as const,
  };
  const error = (input: object) => {
    const r = registerSchema.safeParse(input);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it("accepts a complete signup", () => {
    expect(registerSchema.parse(base)).toMatchObject({ firstName: "Jan", country: "NL", phone: "06 12345678" });
  });

  it("needs a company name and a phone number", () => {
    expect(error({ ...base, companyName: "" })).toBe("Vul de bedrijfsnaam in");
    expect(error({ ...base, phone: "" })).toBe("Vul je telefoonnummer in");
    expect(error({ ...base, phone: "123" })).toBe("Ongeldig telefoonnummer (bijv. 06 12345678)");
  });

  it("needs both passwords to be the same", () => {
    expect(error({ ...base, confirmPassword: "Sterk123456" })).toBe("De wachtwoorden zijn niet gelijk");
  });

  it("needs a country and where they found us", () => {
    expect(error({ ...base, country: "XX" })).toBe("Kies je land");
    expect(error({ ...base, referralSource: "" })).toBe("Kies waar je ons van kent");
  });

  it("rejects a weak password", () => {
    expect(error({ ...base, password: "sterk12345", confirmPassword: "sterk12345" })).toBe(
      "Wachtwoord moet een hoofdletter bevatten"
    );
    expect(error({ ...base, password: "Ab1", confirmPassword: "Ab1" })).toBe("Wachtwoord moet minimaal 10 tekens zijn");
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
    expect(error({ ...base, password: "kort1A", confirmPassword: "kort1A" })).toBe(
      "Wachtwoord moet minimaal 10 tekens zijn"
    );
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
      expect(allMet).toBe(
        changePasswordSchema.safeParse({ currentPassword: "x", password: pw, confirmPassword: pw }).success
      );
    }
  });
});
