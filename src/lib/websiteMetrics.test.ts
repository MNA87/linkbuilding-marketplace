import { describe, expect, it } from "vitest";
import { bareDomain, cBlock, isCloudflareIp, rowCount } from "./websiteMetrics";

describe("bareDomain", () => {
  it("strips scheme, www and path", () => {
    expect(bareDomain("https://www.Digikeur.nl/blog?x=1")).toBe("digikeur.nl");
    expect(bareDomain("a2f.nl")).toBe("a2f.nl");
  });
});

describe("cBlock", () => {
  it("is the first three parts of an IPv4 address", () => {
    expect(cBlock("35.214.139.114")).toBe("35.214.139");
    expect(cBlock("2001:db8::1")).toBeNull();
  });
});

describe("isCloudflareIp", () => {
  it("knows Cloudflare's ranges", () => {
    expect(isCloudflareIp("104.21.33.10")).toBe(true);
    expect(isCloudflareIp("172.67.1.1")).toBe(true);
    expect(isCloudflareIp("188.114.97.3")).toBe(true);
  });

  it("leaves other addresses alone", () => {
    expect(isCloudflareIp("35.214.139.114")).toBe(false);
    expect(isCloudflareIp("not an ip")).toBe(false);
  });
});

describe("rowCount", () => {
  it("counts the rows of an Ahrefs list answer", () => {
    expect(rowCount({ ai_responses: [{ question: "a" }, { question: "b" }] })).toBe(2);
    expect(rowCount({ ai_responses: [] })).toBe(0);
    expect(rowCount([1])).toBe(1);
  });

  it("is null for anything else", () => {
    expect(rowCount({ error: "no access" })).toBeNull();
    expect(rowCount(null)).toBeNull();
  });
});
