import { describe, expect, it } from "vitest";
import { DEFAULT_MENU_COLORS, safeMenuColors } from "./menuColors";

describe("safeMenuColors", () => {
  it("keeps valid colours", () => {
    const colors = { buy: "#111111", manage: "#222222", admin: "#333333" };
    expect(safeMenuColors(colors)).toEqual(colors);
  });

  it("falls back to the default for an invalid colour", () => {
    expect(
      safeMenuColors({ buy: "blue", manage: "#222222", admin: "" }),
    ).toEqual({
      buy: DEFAULT_MENU_COLORS.buy,
      manage: "#222222",
      admin: DEFAULT_MENU_COLORS.admin,
    });
  });
});
