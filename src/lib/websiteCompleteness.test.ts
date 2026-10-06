import { describe, expect, it } from "vitest";
import { missingDetails } from "./websiteCompleteness";

const complete = {
  maxLinks: 2,
  exampleUrl: "https://example.nl/a",
  hasMetrics: true,
  offeredProducts: 1,
};

describe("missingDetails", () => {
  it("is empty for a complete site", () => {
    expect(missingDetails(complete)).toEqual([]);
  });
  it("lists what is missing, most important first", () => {
    expect(missingDetails({ ...complete, offeredProducts: 0, exampleUrl: null })).toEqual([
      "prijs",
      "voorbeeldartikel",
    ]);
    expect(missingDetails({ ...complete, hasMetrics: false, maxLinks: null })).toEqual(["cijfers", "max links"]);
  });
});
