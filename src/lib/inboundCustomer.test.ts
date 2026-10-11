import { describe, expect, it } from "vitest";
import { companyDomain, companyNameFromEmail, emailDomain, isOwnAddress, suggestCustomer } from "./inboundCustomer";

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

  describe("suggestCustomer", () => {
    const customers = [
      { id: "1", company: "All the way up" },
      { id: "2", company: "Bakker Media" },
      { id: "3", company: "AB" },
    ];
    const suggest = (fromEmail: string, fromName: string | null) =>
      suggestCustomer({ fromEmail, fromName }, customers)?.id;
    it("finds the company in the sender's name, without 'Team' and the like", () => {
      expect(suggest("team@atwu-mail.com", "Team ALL the way UP")).toBe("1");
      expect(suggest("tim@gmail.com", "Tim van All the Way Up")).toBe("1");
    });
    it("finds it from the domain under another extension", () => {
      expect(suggest("tim@allthewayup.com", null)).toBe("1");
      expect(suggest("info@bakker-media.de", "Info")).toBe("2");
    });
    it("suggests nothing when nothing is close enough", () => {
      expect(suggest("jan@gmail.com", "Jan")).toBeUndefined();
      expect(suggest("info@ab.nl", "AB")).toBeUndefined();
      expect(suggest("x@gmail.com", null)).toBeUndefined();
    });
  });
});
