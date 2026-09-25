import { describe, expect, it } from "vitest";
import { dutchInvalidMessage } from "./formValidation";

const validity = (v: Partial<ValidityState>) => ({ valueMissing: false, typeMismatch: false, tooLong: false, tooShort: false, ...v }) as ValidityState;
const field = (opts: { aria?: string; label?: string; tag?: string; validity: Partial<ValidityState> }) => ({
  tagName: opts.tag ?? "INPUT",
  validity: validity(opts.validity),
  getAttribute: (name: string) => (name === "aria-label" ? opts.aria ?? null : null),
  labels: opts.label ? [{ textContent: opts.label }] : [],
});

describe("dutchInvalidMessage", () => {
  it("names the field that's missing", () => {
    expect(dutchInvalidMessage(field({ aria: "Ankertekst link 1", validity: { valueMissing: true } }))).toBe(
      'vul "Ankertekst link 1" in.'
    );
    expect(dutchInvalidMessage(field({ label: " Titel\n ", validity: { valueMissing: true } }))).toBe('vul "Titel" in.');
    expect(
      dutchInvalidMessage(field({ label: "Categorie op de site", tag: "SELECT", validity: { valueMissing: true } }))
    ).toBe('maak een keuze bij "Categorie op de site".');
  });
  it("covers other checks and unnamed fields", () => {
    expect(dutchInvalidMessage(field({ label: "Doel-URL", validity: { typeMismatch: true } }))).toBe(
      '"Doel-URL" is geen geldig adres.'
    );
    expect(dutchInvalidMessage(field({ validity: { valueMissing: true } }))).toBe("vul alle verplichte velden in.");
  });
});
