import { describe, expect, it } from "vitest";
import { stillToCome } from "./liveMails";

describe("stillToCome", () => {
  const now = new Date("2026-09-28T12:00:00Z");

  it("names the day a planned link goes online", () => {
    expect(stillToCome([{ domain: "a2f.nl", publishAt: new Date("2026-10-05T06:00:00Z") }], now)).toEqual([
      "a2f.nl komt online op 5 oktober",
    ]);
  });

  it("says the rest follows soon", () => {
    expect(stillToCome([{ domain: "digikeur.nl", publishAt: null }], now)).toEqual(["digikeur.nl volgt binnenkort"]);
  });
});
