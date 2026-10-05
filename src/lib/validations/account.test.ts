import { describe, expect, it } from "vitest";
import { emailChangeSchema, invoiceDetailsOf, parseAccountDetails } from "./account";

const person = {
  name: "Jan de Vries",
  address: "Keizersgracht 123",
  postcode: "1015cj",
  city: "Amsterdam",
  phone: "",
  isBusiness: false,
  sameAddress: true,
};
const business = { ...person, isBusiness: true, companyName: "SEO Bureau", vatNumber: "" };
const own = {
  ...business,
  sameAddress: false,
  billingAddress: "Herengracht 45",
  billingPostcode: "1017 bs",
  billingCity: "Amsterdam",
};

describe("parseAccountDetails", () => {
  it("accepts a private customer", () => {
    const { data } = parseAccountDetails(person);
    expect(data).toMatchObject({ isBusiness: false, postcode: "1015 CJ", phone: null });
  });

  it("checks the phone number only when there is one", () => {
    expect(parseAccountDetails({ ...person, phone: "+31 (0)20-1234567" }).error).toBeNull();
    expect(parseAccountDetails({ ...person, phone: "0612" }).error).toBe("Ongeldig telefoonnummer (bijv. 06 12345678)");
  });

  it("needs the person's name and address", () => {
    expect(parseAccountDetails({ ...person, name: " " }).error).toBe("Naam moet minimaal 2 tekens zijn");
    expect(parseAccountDetails({ ...person, address: "" }).error).toBe("Vul je adres in");
    expect(parseAccountDetails({ ...person, postcode: "123" }).error).toBe("Ongeldige postcode (bijv. 1234 AB)");
  });

  it("ignores the company fields of a private customer", () => {
    expect(parseAccountDetails({ ...person, companyName: "", billingPostcode: "x" }).error).toBeNull();
  });

  it("needs a company name for a business, the VAT number is optional", () => {
    expect(parseAccountDetails({ ...business, companyName: "" }).error).toBe("Vul de bedrijfsnaam in");
    expect(parseAccountDetails({ ...business, vatNumber: "NL123" }).error).toBe(
      "Ongeldig BTW-nummer (bijv. NL123456789B01)"
    );
    expect(parseAccountDetails(business).data).toMatchObject({ isBusiness: true, sameAddress: true, vatNumber: null });
  });

  it("needs the company's own address only when it's elsewhere", () => {
    expect(parseAccountDetails({ ...business, billingAddress: "" }).error).toBeNull();
    expect(parseAccountDetails({ ...own, billingAddress: "" }).error).toBe("Vul het adres van je bedrijf in");
    expect(parseAccountDetails(own).data).toMatchObject({ billingPostcode: "1017 BS" });
  });
});

describe("invoiceDetailsOf", () => {
  it("puts a private customer's own name and address on the invoice", () => {
    expect(invoiceDetailsOf(parseAccountDetails(person).data!)).toEqual({
      isBusiness: false,
      name: "Jan de Vries",
      vatNumber: null,
      billingAddress: "Keizersgracht 123",
      billingPostcode: "1015 CJ",
      billingCity: "Amsterdam",
      country: "NL",
    });
  });

  it("takes a foreign postcode and VAT number by the country", () => {
    const be = {
      ...person,
      country: "BE",
      postcode: "1000",
      isBusiness: true,
      sameAddress: true,
      companyName: "Test BV",
    };
    expect(parseAccountDetails(be).error).toBeNull();
    expect(parseAccountDetails({ ...be, vatNumber: "be 0123.456.789" }).data).toMatchObject({
      vatNumber: "BE0123456789",
    });
    expect(parseAccountDetails({ ...be, vatNumber: "DE123456789" }).error).toBe(
      "Een btw-nummer uit België begint met BE"
    );
    expect(parseAccountDetails({ ...person, postcode: "1000" }).error).toBe("Ongeldige postcode (bijv. 1234 AB)");
  });

  it("puts the company on it, at the person's address or its own", () => {
    expect(invoiceDetailsOf(parseAccountDetails(business).data!)).toMatchObject({
      isBusiness: true,
      name: "SEO Bureau",
      billingAddress: "Keizersgracht 123",
    });
    expect(invoiceDetailsOf(parseAccountDetails(own).data!)).toMatchObject({
      name: "SEO Bureau",
      billingAddress: "Herengracht 45",
      billingPostcode: "1017 BS",
    });
  });
});

describe("emailChangeSchema", () => {
  it("needs a valid address and the current password", () => {
    expect(emailChangeSchema.safeParse({ newEmail: "jan@bureau.nl", currentPassword: "x" }).success).toBe(true);
    expect(emailChangeSchema.safeParse({ newEmail: "jan@", currentPassword: "x" }).success).toBe(false);
    expect(emailChangeSchema.safeParse({ newEmail: "jan@bureau.nl", currentPassword: "" }).success).toBe(false);
  });
});
