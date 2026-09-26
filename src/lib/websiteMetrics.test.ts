import { describe, expect, it } from "vitest";
import { bareDomain, cBlock, isCloudflareIp, manualMetricRow } from "./websiteMetrics";

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

describe("manualMetricRow", () => {
  const figures = { domainRating: 40, domainAuthority: 30, organicTraffic: 1200, referringDomains: 300 };
  const prev = {
    ...figures,
    trustFlow: 22,
    citationFlow: 28,
    spamScore: 2,
    ipAddress: "35.214.159.211",
    behindCloudflare: false,
    aiCited: null,
  };

  it("keeps TF, CF and IP when the typed figures change", () => {
    const row = manualMetricRow(prev, { ...figures, domainRating: 45 });
    expect(row).toMatchObject({ domainRating: 45, trustFlow: 22, citationFlow: 28, ipAddress: "35.214.159.211" });
  });

  it("stores nothing when the typed figures are unchanged", () => {
    expect(manualMetricRow(prev, figures)).toBeNull();
  });

  it("fills gaps left by an earlier form save from the latest fetch", () => {
    const broken = { ...prev, trustFlow: null, citationFlow: null, ipAddress: null };
    const row = manualMetricRow(broken, { ...figures, domainRating: 45 }, prev);
    expect(row).toMatchObject({ trustFlow: 22, citationFlow: 28, ipAddress: "35.214.159.211" });
  });

  it("starts empty for a site without figures", () => {
    expect(manualMetricRow(null, figures)).toMatchObject({ trustFlow: null, ipAddress: null, source: "manual" });
  });
});
