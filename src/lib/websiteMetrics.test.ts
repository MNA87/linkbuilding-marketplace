import { describe, expect, it } from "vitest";
import { bareDomain, cBlock, isCloudflareIp } from "./websiteMetrics";

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
