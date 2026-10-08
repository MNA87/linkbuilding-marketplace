import { describe, expect, it } from "vitest";
import { companyDomain, companyNameFromEmail, emailDomain, isOwnAddress } from "./inboundCustomer";

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
  it("knows your own addresses and their company domain", () => {
    const own = ["info@mnamediainvest.nl", "modernnl@gmail.com"];
    expect(isOwnAddress("Info@MNAmediainvest.nl", own)).toBe(true);
    expect(isOwnAddress("tim@mnamediainvest.nl", own)).toBe(true);
    expect(isOwnAddress("modernnl@gmail.com", own)).toBe(true);
    expect(isOwnAddress("jan@gmail.com", own)).toBe(false);
    expect(isOwnAddress("linkbuilding-aanvragen@traffictoday.nl", own)).toBe(false);
    expect(isOwnAddress("", own)).toBe(false);
  });
});
