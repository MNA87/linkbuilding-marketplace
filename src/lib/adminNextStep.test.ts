import { describe, expect, it } from "vitest";
import { adminNextStep } from "./adminNextStep";

const paid = {
  orderStatus: "PAID" as const,
  isRenewal: false,
  placementStatus: null,
  liveUrl: null,
  awaitingContent: false,
  writeForMe: false,
  hasArticle: true,
  readyToPublish: false,
  publishAt: null,
};

describe("adminNextStep", () => {
  it("asks us to publish a paid link with its content", () => {
    expect(adminNextStep(paid)).toEqual({ label: "Publiceren", yours: true });
  });

  it("asks us to write when we write it and there's no article yet", () => {
    expect(adminNextStep({ ...paid, writeForMe: true, hasArticle: false })).toEqual({ label: "Artikel schrijven", yours: true });
  });

  it("asks us to finish a WordPress draft", () => {
    expect(adminNextStep({ ...paid, placementStatus: "draft" })).toEqual({ label: "Concept publiceren", yours: true });
  });

  it("waits on the customer's content", () => {
    expect(adminNextStep({ ...paid, awaitingContent: true, hasArticle: false })).toEqual({ label: "Wacht op klant", yours: false });
  });

  it("waits for the planned day, or for the site to pick it up", () => {
    const now = new Date("2026-09-27T10:00:00Z");
    expect(adminNextStep({ ...paid, readyToPublish: true, publishAt: new Date("2026-09-30T08:00:00Z"), now })).toEqual({
      label: "Gepland 30 sep",
      yours: false,
    });
    expect(adminNextStep({ ...paid, readyToPublish: true, now })).toEqual({ label: "Wordt geplaatst", yours: false });
  });

  it("has nothing left once live, expired, cancelled or a renewal", () => {
    expect(adminNextStep({ ...paid, liveUrl: "https://a.nl/x", placementStatus: "published" })).toBeNull();
    expect(adminNextStep({ ...paid, placementStatus: "expired" })).toBeNull();
    expect(adminNextStep({ ...paid, orderStatus: "CANCELLED" })).toBeNull();
    expect(adminNextStep({ ...paid, isRenewal: true })).toBeNull();
  });
});
