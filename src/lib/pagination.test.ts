import { describe, expect, it } from "vitest";
import { currentPage, pageNumbers } from "./pagination";

describe("pageNumbers", () => {
  it("lists every page when there are few", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("shows the ends and the pages around the current one", () => {
    expect(pageNumbers(1, 12)).toEqual([1, 2, null, 12]);
    expect(pageNumbers(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageNumbers(12, 12)).toEqual([1, null, 11, 12]);
  });
});

describe("currentPage", () => {
  it("keeps the page within range", () => {
    expect(currentPage(undefined, 3)).toBe(1);
    expect(currentPage("2", 3)).toBe(2);
    expect(currentPage("9", 3)).toBe(3);
    expect(currentPage("abc", 3)).toBe(1);
    expect(currentPage("2", 0)).toBe(1);
  });
});
