import { describe, expect, it } from "vitest";
import { WORLD_COUNTRIES, WORLD_LANGUAGES, worldName, worldSuggestions } from "./worldLists";

describe("worldLists", () => {
  it("has each code once, with the Dutch names", () => {
    for (const list of [WORLD_COUNTRIES, WORLD_LANGUAGES]) {
      expect(new Set(list.map((e) => e.code)).size).toBe(list.length);
    }
    expect(worldName(WORLD_COUNTRIES, "de")).toBe("Duitsland");
    expect(worldName(WORLD_LANGUAGES, "EN")).toBe("Engels");
  });
  it("suggests names starting with what's typed first, leaving out what's there", () => {
    expect(worldSuggestions(WORLD_COUNTRIES, "dui", []).map((e) => e.code)).toEqual(["DE"]);
    expect(worldSuggestions(WORLD_COUNTRIES, "dui", ["DE"])).toEqual([]);
    expect(worldSuggestions(WORLD_LANGUAGES, "", [])).toEqual([]);
    const land = worldSuggestions(WORLD_COUNTRIES, "land", [], 50).map((e) => e.name);
    expect(land.length).toBeGreaterThan(5);
  });
});
