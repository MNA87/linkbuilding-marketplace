import { describe, expect, it } from "vitest";
import { renewalStart } from "./renewal";

describe("renewalStart", () => {
  const now = new Date("2026-09-25T12:00:00Z");

  it("continues from the current end date when it's still ahead", () => {
    const end = new Date("2027-03-01T00:00:00Z");
    expect(renewalStart(end, now)).toEqual(end);
  });

  it("starts today when the end date has passed or there is none", () => {
    expect(renewalStart(new Date("2026-09-01T00:00:00Z"), now)).toEqual(now);
    expect(renewalStart(null, now)).toEqual(now);
  });
});
