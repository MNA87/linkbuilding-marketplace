import { describe, expect, it } from "vitest";
import { companyDomain, companyNameFromEmail, emailDomain } from "./inboundCustomer";

describe("inbound customer helpers", () => {
  it("takes the domain of an address", () => {
    expect(emailDomain("Tim@AllTheWayUp.nl")).toBe("allthewayup.nl");
    expect(emailDomain("geen-adres")).toBeNull();
  });
  it("doesn't treat free mail as a company", () => {
    expect(companyDomain("jan@gmail.com")).toBeNull();
    expect(companyDomain("tim@allthewayup.nl")).toBe("allthewayup.nl");
  });
  it("suggests a company name from the domain", () => {
    expect(companyNameFromEmail("tim@allthewayup.nl")).toBe("Allthewayup");
    expect(companyNameFromEmail("jan@hotmail.com")).toBe("");
  });
});
