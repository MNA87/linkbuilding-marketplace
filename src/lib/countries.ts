// Countries a customer can be based in. The EU ones matter for VAT: a
// business there with a valid VAT number pays no Dutch VAT ("btw verlegd"),
// see src/lib/vatRules.ts.

export const EU_COUNTRIES = {
  NL: "Nederland",
  BE: "België",
  DE: "Duitsland",
  FR: "Frankrijk",
  ES: "Spanje",
  IT: "Italië",
  PT: "Portugal",
  AT: "Oostenrijk",
  LU: "Luxemburg",
  IE: "Ierland",
  DK: "Denemarken",
  SE: "Zweden",
  FI: "Finland",
  PL: "Polen",
  CZ: "Tsjechië",
  SK: "Slowakije",
  HU: "Hongarije",
  SI: "Slovenië",
  HR: "Kroatië",
  RO: "Roemenië",
  BG: "Bulgarije",
  GR: "Griekenland",
  CY: "Cyprus",
  MT: "Malta",
  EE: "Estland",
  LV: "Letland",
  LT: "Litouwen",
} as const;

export const NON_EU_COUNTRIES = {
  GB: "Verenigd Koninkrijk",
  CH: "Zwitserland",
  NO: "Noorwegen",
  US: "Verenigde Staten",
} as const;

export type CountryCode = keyof typeof EU_COUNTRIES | keyof typeof NON_EU_COUNTRIES | "OTHER";

// Nederland first, then the rest of the EU and the others by name, and
// "Ander land" last.
export const COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: "NL", name: EU_COUNTRIES.NL },
  ...(Object.entries({ ...EU_COUNTRIES, ...NON_EU_COUNTRIES }) as [CountryCode, string][])
    .filter(([code]) => code !== "NL")
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl")),
  { code: "OTHER", name: "Ander land" },
];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [CountryCode, ...CountryCode[]];

export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

export const isEuCountry = (code: string) => code in EU_COUNTRIES;

export const isNonEuCountry = (code: string) => code in NON_EU_COUNTRIES;

// A VAT number starts with the country's code — Greece uses EL, not GR.
export const vatPrefix = (code: string) => (code === "GR" ? "EL" : code);
