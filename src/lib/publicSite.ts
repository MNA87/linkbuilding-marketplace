// Eén plek voor de cijfers en gegevens op de publieke site (publito.nl).
// Alles hieronder is een PLACEHOLDER totdat de eigenaar de echte waarden
// invult — zo staan er nooit verzonnen claims verspreid door de pagina's.

export const PUBLIC_SITE = {
  /** Aantal sites in de marktplaats, zoals op de homepage getoond. */
  siteCount: "500+",
  /** Aantal geplaatste links tot nu toe. */
  placementCount: "20.000+",
  /** Gemiddelde klantwaardering en het aantal reviews waarop die is gebaseerd. */
  rating: "4,9",
  reviewCount: "312",
  /** Vanaf-prijzen (excl. btw). Bloglink is permanent, homepagelink per jaar. */
  priceBlogFrom: "35",
  priceHomepageFrom: "67",
  /** Contactgegevens. */
  contactEmail: "info@publito.nl",
  /** Landen waarin we plaatsen. */
  countries: "Nederland en België",
} as const;

// Waar de knoppen heen leiden. De marktplaats zelf zit achter de login,
// dus "bekijk het aanbod" stuurt bezoekers naar registreren.
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
