import { describe, expect, it } from "vitest";
import { accountDetailsSchema, emailChangeSchema } from "./account";

const base = {
  name: "Jan de Vries",
  phone: "",
  companyName: "SEO Bureau",
  billingAddress: "Keizersgracht 123",
  billingPostcode: "1015cj",
  billingCity: "Amsterdam",
  vatNumber: "",
};
const error = (input: object) => {
  const r = accountDetailsSchema.safeParse(input);
  return r.success ? null : r.error.issues[0]?.message;
};

describe("accountDetailsSchema", () => {
  it("accepts the details without a phone number", () => {
    const r = accountDetailsSchema.parse(base);
    expect(r.phone).toBeNull();
    expect(r.billingPostcode).toBe("1015 CJ");
  });

  it("accepts Dutch and international phone numbers", () => {
    expect(accountDetailsSchema.parse({ ...base, phone: " 06 12345678 " }).phone).toBe("06 12345678");
    expect(error({ ...base, phone: "+31 (0)20-1234567" })).toBeNull();
  });

  it("rejects a phone number that isn't one", () => {
    expect(error({ ...base, phone: "0612" })).toBe("Ongeldig telefoonnummer (bijv. 06 12345678)");
    expect(error({ ...base, phone: "bel mij" })).toBe("Ongeldig telefoonnummer (bijv. 06 12345678)");
  });

  it("needs a name and a company name", () => {
    expect(error({ ...base, name: " " })).toBe("Naam moet minimaal 2 tekens zijn");
    expect(error({ ...base, companyName: "" })).toBe("Bedrijfsnaam moet minimaal 2 tekens zijn");
  });
});

describe("emailChangeSchema", () => {
  it("needs a valid address and the current password", () => {
    expect(emailChangeSchema.safeParse({ newEmail: "jan@bureau.nl", currentPassword: "x" }).success).toBe(true);
    expect(emailChangeSchema.safeParse({ newEmail: "jan@", currentPassword: "x" }).success).toBe(false);
    expect(emailChangeSchema.safeParse({ newEmail: "jan@bureau.nl", currentPassword: "" }).success).toBe(false);
  });
});
