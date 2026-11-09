// Waar de knoppen op de publieke site (publito.nl) heen leiden. De marktplaats
// zelf zit achter de login, dus "bekijk het aanbod" stuurt bezoekers naar
// registreren. Teksten, cijfers en contactgegevens staan in het CMS
// (src/lib/cms/pages.ts + Admin → Publieke site).
export const PUBLIC_LINKS = {
  register: "/register",
  login: "/login",
  prices: "/prijzen",
  outsource: "/uitbesteden",
  about: "/over-ons",
  contact: "/contact",
  terms: "/voorwaarden",
  privacy: "/privacy",
} as const;
